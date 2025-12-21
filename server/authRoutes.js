import express from 'express';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
  getRefreshTokenExpiration,
  verifyAccessToken
} from './authService.js';
import { requireAuth } from './authMiddleware.js';

export function createAuthRouter(pool) {
  const router = express.Router();

  /**
   * POST /api/auth/register
   * Register new venue owner
   */
  router.post('/register', async (req, res) => {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ 
        error: 'Email, password, and full name are required' 
      });
    }

    // Basic email validation
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    let client;
    try {
      client = await pool.connect();

      // Check if email already exists
      const existingUser = await client.query(
        'SELECT id FROM venue_owners WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);
      const verificationToken = generateVerificationToken();

      // Insert new owner
      const result = await client.query(
        `INSERT INTO venue_owners (email, password_hash, full_name, phone, verification_token, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, full_name, phone, email_verified, created_at`,
        [email.toLowerCase(), passwordHash, fullName, phone || null, verificationToken, false]
      );

      const owner = result.rows[0];

      // Generate tokens
      const accessToken = generateAccessToken(owner.id, owner.email);
      const refreshToken = generateRefreshToken();
      const refreshExpires = getRefreshTokenExpiration();

      // Store refresh token
      await client.query(
        `INSERT INTO owner_sessions (owner_id, refresh_token, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          owner.id,
          refreshToken,
          refreshExpires,
          req.headers['user-agent'] || null,
          req.ip || null
        ]
      );

      res.status(201).json({
        success: true,
        owner: {
          id: owner.id,
          email: owner.email,
          fullName: owner.full_name,
          phone: owner.phone,
          emailVerified: owner.email_verified
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      console.error('[auth] Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let client;
    try {
      client = await pool.connect();

      // Find user
      const result = await client.query(
        `SELECT id, email, password_hash, full_name, phone, email_verified 
         FROM venue_owners 
         WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const owner = result.rows[0];

      // Verify password
      const valid = await comparePassword(password, owner.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate tokens
      const accessToken = generateAccessToken(owner.id, owner.email);
      const refreshToken = generateRefreshToken();
      const refreshExpires = getRefreshTokenExpiration();

      // Store refresh token
      await client.query(
        `INSERT INTO owner_sessions (owner_id, refresh_token, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          owner.id,
          refreshToken,
          refreshExpires,
          req.headers['user-agent'] || null,
          req.ip || null
        ]
      );

      res.json({
        success: true,
        owner: {
          id: owner.id,
          email: owner.email,
          fullName: owner.full_name,
          phone: owner.phone,
          emailVerified: owner.email_verified
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      console.error('[auth] Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let client;
    try {
      client = await pool.connect();

      // Find valid session
      const result = await client.query(
        `SELECT os.owner_id, os.expires_at, vo.email
         FROM owner_sessions os
         JOIN venue_owners vo ON vo.id = os.owner_id
         WHERE os.refresh_token = $1 AND os.expires_at > NOW()`,
        [refreshToken]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const session = result.rows[0];

      // Generate new access token
      const accessToken = generateAccessToken(session.owner_id, session.email);

      res.json({
        success: true,
        accessToken
      });

    } catch (error) {
      console.error('[auth] Refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/auth/logout
   * Logout and invalidate refresh token
   */
  router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.json({ success: true }); // Already logged out
    }

    let client;
    try {
      client = await pool.connect();

      await client.query(
        'DELETE FROM owner_sessions WHERE refresh_token = $1',
        [refreshToken]
      );

      res.json({ success: true });

    } catch (error) {
      console.error('[auth] Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    } finally {
      client?.release();
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated owner
   */
  router.get('/me', requireAuth, async (req, res) => {
    let client;
    try {
      client = await pool.connect();

      const result = await client.query(
        `SELECT id, email, full_name, phone, email_verified, role, created_at
         FROM venue_owners
         WHERE id = $1`,
        [req.owner.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }

      const owner = result.rows[0];

      res.json({
        id: owner.id,
        email: owner.email,
        fullName: owner.full_name,
        phone: owner.phone,
        emailVerified: owner.email_verified,
        role: owner.role || 'owner',
        createdAt: owner.created_at
      });

    } catch (error) {
      console.error('[auth] Get me error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let client;
    try {
      client = await pool.connect();

      const resetToken = generateVerificationToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const result = await client.query(
        `UPDATE venue_owners
         SET reset_token = $1, reset_token_expires = $2, updated_at = NOW()
         WHERE email = $3
         RETURNING id`,
        [resetToken, expires, email.toLowerCase()]
      );

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account exists, a reset link will be sent to your email'
      });

      // TODO: Send email with reset link
      if (result.rows.length > 0) {
        console.log(`[auth] Password reset requested for ${email}`);
        console.log(`[auth] Reset token: ${resetToken}`);
      }

    } catch (error) {
      console.error('[auth] Forgot password error:', error);
      res.status(500).json({ error: 'Password reset request failed' });
    } finally {
      client?.release();
    }
  });

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    let client;
    try {
      client = await pool.connect();

      // Find valid reset token
      const result = await client.query(
        `SELECT id FROM venue_owners
         WHERE reset_token = $1 AND reset_token_expires > NOW()`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const ownerId = result.rows[0].id;

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password and clear reset token
      await client.query(
        `UPDATE venue_owners
         SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, ownerId]
      );

      // Invalidate all sessions
      await client.query('DELETE FROM owner_sessions WHERE owner_id = $1', [ownerId]);

      res.json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      console.error('[auth] Reset password error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    } finally {
      client?.release();
    }
  });

  return router;
}
