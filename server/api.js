import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { randomUUID, createHmac, createHash } from 'crypto';
import pg from 'pg';
import { createAuthRouter } from './authRoutes.js';
import { createOwnerRouter } from './ownerRoutes.js';
import { validateTelegramPayload } from './telegramAuth.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;
const PORT = process.env.PORT || 3000;
const TELEGRAM_AUTH_TTL = Number(process.env.TELEGRAM_AUTH_TTL || 600);

if (!process.env.DATABASE_URL) {
  console.warn('[api] DATABASE_URL is not set; server will start but database requests will fail');
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
  console.error('[api] ⚠️  WARNING: JWT_SECRET is not set or using default value! This is insecure for production!');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // максимум соединений в пуле
  min: 2, // минимум соединений
  idleTimeoutMillis: 30000, // закрывать неиспользуемые соединения через 30 сек
  connectionTimeoutMillis: 10000, // таймаут подключения 10 сек
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

// Test endpoint
app.get('/api/test', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0' });
});

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

// Telegram WebApp callback handler (Express wrapper around telegramAuth.js)
const telegramCallbackHandler = async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  const httpsOnly = process.env.TELEGRAM_HTTPS_ONLY !== 'false';
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toString().split(',')[0].trim();
  if (httpsOnly && proto !== 'https') {
    return res.status(400).json({ error: 'HTTPS is required', hint: 'Set TELEGRAM_HTTPS_ONLY=false for local testing without TLS' });
  }

  // Accept both GET (query) and POST (body)
  const payload = req.method === 'GET' ? req.query : (req.body || {});

  const now = Math.floor(Date.now() / 1000);
  const validation = validateTelegramPayload(botToken, payload, now, TELEGRAM_AUTH_TTL);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const user = {
    id: Number(payload.id),
    first_name: payload.first_name,
    last_name: payload.last_name,
    username: payload.username,
    photo_url: payload.photo_url,
    language_code: payload.language_code,
  };

  const exp = now + 3600;
  const tokenPayload = Buffer.from(JSON.stringify({ sub: user.id, iat: now, exp })).toString('base64url');
  const tokenSignature = createHmac('sha256', createHash('sha256').update(botToken).digest())
    .update(tokenPayload)
    .digest('base64url');
  const token = `${tokenPayload}.${tokenSignature}`;

  // Optionally persist the user as a client for later mixes linking
  await withClient(async (client) => {
    await client.query(
      `insert into clients (id, first_name, last_name, username, language_code, last_seen_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name,
         username = excluded.username, language_code = excluded.language_code, last_seen_at = now()`,
      [user.id, user.first_name, user.last_name, user.username, user.language_code],
    );
  }, res);

  if (res.headersSent) return; // withClient may have sent 500

  return res.status(200).json({ user, token, expires_in: exp - now });
};

// Register Telegram callback after handler definition
app.all('/api/auth/telegram/callback', telegramCallbackHandler);

// Эндпоинт GET /api/venues перемещен ниже с улучшенным запросом (COALESCE)

app.post('/api/venues', async (req, res) => {
  const { id, title, name, city, logo, subscription_until, visible, flavor_schema, slug, bowl_capacity, allow_brand_mixing } = req.body || {};
  await withClient(async (client) => {
    // Convert empty strings to null for database fields that expect null or valid values
    const subscriptionUntilValue = subscription_until === '' ? null : subscription_until;
    const logoValue = logo === '' ? null : logo;
    const flavorSchemaValue = flavor_schema === '' ? null : flavor_schema;
    const slugValue = slug === '' ? null : slug;
    const nameValue = name || title || null;
    
    // Primary attempt: insert with full column set
    try {
      await client.query(
        `insert into venues (id, name, city, logo, subscription_until, visible, flavor_schema, slug, bowl_capacity, allow_brand_mixing)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set name = excluded.name, city = excluded.city, logo = excluded.logo,
           subscription_until = excluded.subscription_until, visible = excluded.visible, flavor_schema = excluded.flavor_schema,
           slug = excluded.slug, bowl_capacity = excluded.bowl_capacity, allow_brand_mixing = excluded.allow_brand_mixing`,
        [id, nameValue, city, logoValue, subscriptionUntilValue, visible, flavorSchemaValue, slugValue, bowl_capacity ?? 18, allow_brand_mixing ?? true],
      );
    } catch (err) {
      // Fallback: minimal schema support when some columns are missing in DB
      // Try inserting only id, name, city, visible
      try {
        await client.query(
          `insert into venues (id, name, city, visible)
           values ($1, $2, $3, $4)
           on conflict (id) do update set name = excluded.name, city = excluded.city, visible = excluded.visible`,
          [id, nameValue, city, visible ?? true],
        );
      } catch (err2) {
        // As a last resort, try columns (id, title, city, visible) if DB uses 'title'
        try {
          await client.query(
            `insert into venues (id, title, city, visible)
             values ($1, $2, $3, $4)
             on conflict (id) do update set title = excluded.title, city = excluded.city, visible = excluded.visible`,
            [id, nameValue, city, visible ?? true],
          );
        } catch (err3) {
          throw err3;
        }
      }
    }
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

  let client;
  try {
    client = await pool.connect();
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
  } catch (error) {
    if (client) {
      try {
        await client.query('rollback');
      } catch (rollbackError) {
        console.error('[api] rollback failed', rollbackError);
      }
    }
    console.error('[api] flavors update failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Database error' });
    }
  } finally {
    client?.release();
  }
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

app.get('/api/venues', async (_req, res) => {
  await withClient(async (client) => {
    const result = await client.query(
      `SELECT id,
              COALESCE(title, name) AS title,
              city, address, logo, subscription_until, visible, admin_pin, flavor_schema,
              bowl_capacity, allow_brand_mixing, slug
         FROM venues
         ORDER BY COALESCE(title, name) ASC`
    );
    res.json(result.rows);
  }, res);
});

app.get('/api/mixes', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  await withClient(async (client) => {
    const result = await client.query(
      `select id, user_id, name, ingredients, is_favorite, venue_snapshot, created_at
       from mixes
       where user_id = $1
       order by created_at desc`,
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
