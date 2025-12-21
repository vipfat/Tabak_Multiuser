const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify super admin role
 * Must be used after authMiddleware
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Get owner from database to check role
    const result = await pool.query(
      'SELECT id, email, role FROM venue_owners WHERE id = $1',
      [req.owner.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Владелец не найден' });
    }

    const owner = result.rows[0];

    if (owner.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Доступ запрещен. Требуется роль супер админа.' 
      });
    }

    // Add owner data to request
    req.owner = owner;
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    return res.status(500).json({ error: 'Ошибка проверки прав доступа' });
  }
};

module.exports = { requireSuperAdmin };
