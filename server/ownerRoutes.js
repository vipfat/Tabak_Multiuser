import express from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from './authMiddleware.js';

export function createOwnerRouter(pool) {
  const router = express.Router();

  // All routes require authentication
  router.use(requireAuth);

  /**
   * GET /api/owner/profile
   * Get owner profile
   */
  router.get('/profile', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, email, full_name, phone, email_verified, created_at
         FROM venue_owners
         WHERE id = $1`,
        [req.owner.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const owner = result.rows[0];

      res.json({
        id: owner.id,
        email: owner.email,
        fullName: owner.full_name,
        phone: owner.phone,
        emailVerified: owner.email_verified,
        createdAt: owner.created_at
      });

    } catch (error) {
      console.error('[owner] Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    } finally {
      client?.release();
    }
  });

  /**
   * PATCH /api/owner/profile
   * Update owner profile
   */
  router.patch('/profile', async (req, res) => {
    const { fullName, phone } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `UPDATE venue_owners
         SET full_name = $1, phone = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, full_name, phone, email_verified`,
        [fullName, phone || null, req.owner.id]
      );

      const owner = result.rows[0];

      res.json({
        success: true,
        owner: {
          id: owner.id,
          email: owner.email,
          fullName: owner.full_name,
          phone: owner.phone,
          emailVerified: owner.email_verified
        }
      });

    } catch (error) {
      console.error('[owner] Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    } finally {
      client?.release();
    }
  });

  /**
   * GET /api/owner/venues
   * Get all venues owned by this owner
   */
  router.get('/venues', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, title, city, address, logo, slug, bowl_capacity, 
                allow_brand_mixing, subscription_until, visible, created_at, updated_at
         FROM venues
         WHERE owner_id = $1
         ORDER BY created_at DESC`,
        [req.owner.id]
      );

      res.json(result.rows);

    } catch (error) {
      console.error('[owner] Get venues error:', error);
      res.status(500).json({ error: 'Failed to fetch venues' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/owner/applications
   * Submit venue application
   */
  router.post('/applications', async (req, res) => {
    const { venueName, city, address, phone, email, description } = req.body;

    if (!venueName || !city) {
      return res.status(400).json({ 
        error: 'Venue name and city are required' 
      });
    }

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `INSERT INTO venue_applications 
         (owner_id, venue_name, city, address, phone, email, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          req.owner.id,
          venueName,
          city,
          address || null,
          phone || null,
          email || null,
          description || null
        ]
      );

      res.status(201).json({
        success: true,
        application: result.rows[0]
      });

    } catch (error) {
      console.error('[owner] Create application error:', error);
      res.status(500).json({ error: 'Failed to submit application' });
    } finally {
      client?.release();
    }
  });

  /**
   * GET /api/owner/applications
   * Get all applications by this owner
   */
  router.get('/applications', async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, venue_name, city, address, phone, email, description, 
                status, admin_notes, created_at, updated_at
         FROM venue_applications
         WHERE owner_id = $1
         ORDER BY created_at DESC`,
        [req.owner.id]
      );

      res.json(result.rows);

    } catch (error) {
      console.error('[owner] Get applications error:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    } finally {
      client?.release();
    }
  });

  /**
   * GET /api/owner/venues/:id
   * Get specific venue details
   */
  router.get('/venues/:id', async (req, res) => {
    const venueId = req.params.id;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT * FROM venues
         WHERE id = $1 AND owner_id = $2`,
        [venueId, req.owner.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error('[owner] Get venue error:', error);
      res.status(500).json({ error: 'Failed to fetch venue' });
    } finally {
      client?.release();
    }
  });

  /**
   * PATCH /api/owner/venues/:id
   * Update venue details
   */
  router.patch('/venues/:id', async (req, res) => {
    const venueId = req.params.id;
    const { title, city, address, logo, slug, bowlCapacity, allowBrandMixing, visible } = req.body;

    let client;
    try {
      client = await pool.connect();

      // First verify ownership
      const ownerCheck = await client.query(
        'SELECT id FROM venues WHERE id = $1 AND owner_id = $2',
        [venueId, req.owner.id]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(title);
      }
      if (city !== undefined) {
        updates.push(`city = $${paramCount++}`);
        values.push(city);
      }
      if (address !== undefined) {
        updates.push(`address = $${paramCount++}`);
        values.push(address);
      }
      if (logo !== undefined) {
        updates.push(`logo = $${paramCount++}`);
        values.push(logo);
      }
      if (slug !== undefined) {
        updates.push(`slug = $${paramCount++}`);
        values.push(slug);
      }
      if (bowlCapacity !== undefined) {
        updates.push(`bowl_capacity = $${paramCount++}`);
        values.push(bowlCapacity);
      }
      if (allowBrandMixing !== undefined) {
        updates.push(`allow_brand_mixing = $${paramCount++}`);
        values.push(allowBrandMixing);
      }
      if (visible !== undefined) {
        updates.push(`visible = $${paramCount++}`);
        values.push(visible);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(venueId);

      const query = `
        UPDATE venues
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);

      res.json({
        success: true,
        venue: result.rows[0]
      });

    } catch (error) {
      console.error('[owner] Update venue error:', error);
      
      // Handle unique constraint violation for slug
      if (error.code === '23505' && error.constraint === 'venues_slug_key') {
        return res.status(409).json({ error: 'This slug is already taken' });
      }

      res.status(500).json({ error: 'Failed to update venue' });
    } finally {
      client?.release();
    }
  });

  /**
   * DELETE /api/owner/venues/:id
   * Delete venue (soft delete - set visible to false)
   */
  router.delete('/venues/:id', async (req, res) => {
    const venueId = req.params.id;

    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `UPDATE venues
         SET visible = false, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2
         RETURNING id`,
        [venueId, req.owner.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      res.json({ success: true });

    } catch (error) {
      console.error('[owner] Delete venue error:', error);
      res.status(500).json({ error: 'Failed to delete venue' });
    } finally {
      client?.release();
    }
  });

  /**
   * GET /api/owner/venues/:id/stats
   * Get venue statistics (popular mixes, etc.)
   */
  router.get('/venues/:id/stats', async (req, res) => {
    const venueId = req.params.id;

    let client;
    try {
      client = await pool.connect();

      // Verify ownership
      const ownerCheck = await client.query(
        'SELECT id FROM venues WHERE id = $1 AND owner_id = $2',
        [venueId, req.owner.id]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Venue not found' });
      }

      // Get total mixes count
      const totalMixes = await client.query(
        `SELECT COUNT(*) as count
         FROM mixes
         WHERE venue_snapshot->>'id' = $1`,
        [venueId]
      );

      // Get unique users count
      const uniqueUsers = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM mixes
         WHERE venue_snapshot->>'id' = $1`,
        [venueId]
      );

      // Get most popular flavors (top 10)
      const popularFlavors = await client.query(
        `SELECT 
           jsonb_array_elements(ingredients)->>'flavor' as flavor_name,
           COUNT(*) as usage_count
         FROM mixes
         WHERE venue_snapshot->>'id' = $1
           AND jsonb_typeof(ingredients) = 'array'
         GROUP BY flavor_name
         ORDER BY usage_count DESC
         LIMIT 10`,
        [venueId]
      );

      // Recent activity (last 30 days)
      const recentActivity = await client.query(
        `SELECT DATE(created_at) as date, COUNT(*) as mixes_count
         FROM mixes
         WHERE venue_snapshot->>'id' = $1
           AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [venueId]
      );

      res.json({
        totalMixes: parseInt(totalMixes.rows[0]?.count || 0),
        uniqueUsers: parseInt(uniqueUsers.rows[0]?.count || 0),
        popularFlavors: popularFlavors.rows,
        recentActivity: recentActivity.rows
      });

    } catch (error) {
      console.error('[owner] Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    } finally {
      client?.release();
    }
  });

  return router;
}
