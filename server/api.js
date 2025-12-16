import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { createAuthRouter } from './authRoutes.js';
import { createOwnerRouter } from './ownerRoutes.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.warn('[api] DATABASE_URL is not set; server will start but database requests will fail');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
// Respond to CORS preflight requests so browsers can POST JSON payloads without
// seeing "405 Method Not Allowed" when the API is behind certain proxies/CDNs.
app.options('*', cors());

// Trust proxy to get correct IP addresses
app.set('trust proxy', true);

// Mount auth and owner routers
app.use('/api/auth', createAuthRouter(pool));
app.use('/api/owner', createOwnerRouter(pool));

const withClient = async (handler, res) => {
  let client;

  try {
    client = await pool.connect();
    return await handler(client);
  } catch (error) {
    console.error('[api] database connection/query failed', error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Database error' });
    }

    return null;
  } finally {
    client?.release();
  }
};

app.get('/api/venues', async (_req, res) => {
  await withClient(async (client) => {
    const result = await client.query(
      'select id, title, city, logo, subscription_until, visible, flavor_schema, slug, bowl_capacity, allow_brand_mixing from venues order by title asc',
    );
    res.json(result.rows);
  }, res);
});

app.post('/api/venues', async (req, res) => {
  const { id, title, city, logo, subscription_until, visible, flavor_schema, slug, bowl_capacity, allow_brand_mixing } = req.body || {};
  await withClient(async (client) => {
    // Convert empty strings to null for database fields that expect null or valid values
    const subscriptionUntilValue = subscription_until === '' ? null : subscription_until;
    const logoValue = logo === '' ? null : logo;
    const flavorSchemaValue = flavor_schema === '' ? null : flavor_schema;
    const slugValue = slug === '' ? null : slug;
    
    await client.query(
      `insert into venues (id, title, city, logo, subscription_until, visible, flavor_schema, slug, bowl_capacity, allow_brand_mixing)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set title = excluded.title, city = excluded.city, logo = excluded.logo,
         subscription_until = excluded.subscription_until, visible = excluded.visible, flavor_schema = excluded.flavor_schema,
         slug = excluded.slug, bowl_capacity = excluded.bowl_capacity, allow_brand_mixing = excluded.allow_brand_mixing`,
      [id, title, city, logoValue, subscriptionUntilValue, visible, flavorSchemaValue, slugValue, bowl_capacity ?? 18, allow_brand_mixing ?? true],
    );
    res.json({ success: true });
  }, res);
});

app.delete('/api/venues/:id', async (req, res) => {
  const venueId = req.params.id;
  await withClient(async (client) => {
    await client.query('delete from venues where id = $1', [venueId]);
    res.json({ success: true });
  }, res);
});

app.get('/api/flavors', async (req, res) => {
  const venueId = req.query.venueId;
  if (!venueId) return res.json({ flavors: [], brands: [] });

  await withClient(async (client) => {
    const flavorsPromise = client.query('select * from flavors where venue_id = $1 order by name asc', [venueId]);
    const brandsPromise = client.query('select name from brands where venue_id = $1 order by name asc', [venueId]);
    const [flavors, brands] = await Promise.all([flavorsPromise, brandsPromise]);
    res.json({ flavors: flavors.rows, brands: brands.rows });
  }, res);
});

app.put('/api/flavors', async (req, res) => {
  const { venueId, flavors = [], brands = [] } = req.body || {};
  if (!venueId) return res.status(400).json({ error: 'venueId is required' });

  await withClient(async (client) => {
    await client.query('begin');
    await client.query('delete from flavors where venue_id = $1', [venueId]);
    await client.query('delete from brands where venue_id = $1', [venueId]);

    if (flavors.length > 0) {
      const values = flavors.map((_, idx) => `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`).join(',');
      const params = flavors.flatMap((f) => [
        f.id || randomUUID(),
        venueId,
        f.name,
        f.brand,
        f.description,
        f.color,
        f.is_available !== false,
      ]);
      await client.query(
        `insert into flavors (id, venue_id, name, brand, description, color, is_available) values ${values}`,
        params,
      );
    }

    if (brands.length > 0) {
      const values = brands.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
      const params = brands.flatMap((b) => [b.name, venueId]);
      await client.query(`insert into brands (name, venue_id) values ${values}`, params);
    }

    await client.query('commit');
    res.json({ success: true });
  }, res);
});

app.post('/api/pin', async (req, res) => {
  const { venueId, pin } = req.body || {};
  if (!venueId) return res.status(400).json({ error: 'venueId is required' });

  await withClient(async (client) => {
    await client.query('update venues set admin_pin = $1 where id = $2', [pin, venueId]);
    res.json({ success: true });
  }, res);
});

app.post('/api/pin/verify', async (req, res) => {
  const { venueId, pin } = req.body || {};
  if (!venueId || !pin) return res.json({ valid: false });

  await withClient(async (client) => {
    const result = await client.query('select id from venues where id = $1 and admin_pin = $2 limit 1', [venueId, pin]);
    res.json({ valid: result.rowCount > 0 });
  }, res);
});

app.post('/api/pin/update', async (req, res) => {
  const { venueId, currentPin, newPin } = req.body || {};
  if (!venueId) return res.status(400).json({ success: false, message: 'venueId is required' });

  await withClient(async (client) => {
    const result = await client.query(
      'update venues set admin_pin = $1 where id = $2 and admin_pin = $3 returning id',
      [newPin, venueId, currentPin],
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'Текущий ПИН неверный' });
    }

    res.json({ success: true });
  }, res);
});

app.post('/api/clients', async (req, res) => {
  const { id, first_name, last_name, username, language_code } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  await withClient(async (client) => {
    await client.query(
      `insert into clients (id, first_name, last_name, username, language_code, last_seen_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name,
         username = excluded.username, language_code = excluded.language_code, last_seen_at = now()`,
      [id, first_name, last_name, username, language_code],
    );
    res.json({ success: true });
  }, res);
});

app.get('/api/mixes', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isFinite(userId)) return res.json([]);

  await withClient(async (client) => {
    const result = await client.query(
      'select * from mixes where user_id = $1 order by created_at desc',
      [userId],
    );
    res.json(result.rows);
  }, res);
});

app.post('/api/mixes', async (req, res) => {
  const { user_id, name, ingredients, venue_snapshot } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  await withClient(async (client) => {
    const id = randomUUID();
    const result = await client.query(
      `insert into mixes (id, user_id, name, ingredients, is_favorite, venue_snapshot, created_at)
       values ($1, $2, $3, $4, false, $5, now())
       returning *`,
      [id, user_id, name || 'Мой микс', JSON.stringify(ingredients || []), venue_snapshot ? JSON.stringify(venue_snapshot) : null],
    );
    res.json(result.rows[0]);
  }, res);
});

app.post('/api/mixes/:id/favorite', async (req, res) => {
  const { value, userId } = req.body || {};
  const mixId = req.params.id;
  if (!mixId || !userId) return res.status(400).json({ error: 'mixId and userId are required' });

  await withClient(async (client) => {
    await client.query('update mixes set is_favorite = $1 where id = $2 and user_id = $3', [
      Boolean(value),
      mixId,
      userId,
    ]);
    res.json({ success: true });
  }, res);
});

app.delete('/api/mixes/:id', async (req, res) => {
  const mixId = req.params.id;
  const { userId } = req.body || {};
  if (!mixId) return res.status(400).json({ error: 'mixId is required' });

  await withClient(async (client) => {
    await client.query('delete from mixes where id = $1 and ($2::bigint is null or user_id = $2)', [mixId, userId ?? null]);
    res.json({ success: true });
  }, res);
});

app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
});
