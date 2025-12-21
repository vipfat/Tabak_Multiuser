import { verifyAccessToken, extractTokenFromHeader } from './authService.js';

/**
 * Middleware to verify JWT token and attach owner to request
 */
export function requireAuth(req, res, next) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    console.log('[authMiddleware] No token provided for', req.method, req.path);
    return res.status(401).json({ error: 'No token provided' });
  }

  const { valid, payload, error } = verifyAccessToken(token);

  if (!valid) {
    console.log('[authMiddleware] Invalid token for', req.method, req.path, '- Error:', error);
    return res.status(401).json({ error: error || 'Invalid token' });
  }

  req.owner = {
    id: payload.ownerId,
    email: payload.email
  };

  next();
}

/**
 * Optional auth middleware - doesn't fail if token is missing
 */
export function optionalAuth(req, res, next) {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (token) {
    const { valid, payload } = verifyAccessToken(token);
    if (valid) {
      req.owner = {
        id: payload.ownerId,
        email: payload.email
      };
    }
  }

  next();
}
