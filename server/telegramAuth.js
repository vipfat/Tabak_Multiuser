import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { createServer } from 'http';
import { URL } from 'url';

const TEN_MINUTES = 600;
const CALLBACK_PATH = '/api/auth/telegram/callback';

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try {
      if (!data) return resolve({});
      if (req.headers['content-type']?.includes('application/json')) {
        return resolve(JSON.parse(data));
      }
      const params = new URLSearchParams(data);
      const result = {};
      for (const [key, value] of params.entries()) result[key] = value;
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
  req.on('error', reject);
});

export const buildDataCheckString = (payload) => {
  const entries = Object.entries(payload)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  return entries.join('\n');
};

export const computeSignature = (botToken, payload) => {
  const secretKey = createHash('sha256').update(botToken).digest();
  const checkString = buildDataCheckString(payload);
  return createHmac('sha256', secretKey).update(checkString).digest('hex');
};

const safeCompare = (expected, actual) => {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export const validateTelegramPayload = (
  botToken,
  payload,
  now = Math.floor(Date.now() / 1000),
  ttlSeconds = TEN_MINUTES,
) => {
  if (!botToken) {
    return { ok: false, status: 500, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const required = ['id', 'first_name', 'auth_date', 'hash'];
  for (const field of required) {
    if (!(field in payload)) {
      return { ok: false, status: 400, error: `Missing field: ${field}` };
    }
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate)) {
    return { ok: false, status: 400, error: 'auth_date is invalid' };
  }
  if (ttlSeconds && now - authDate > ttlSeconds) {
    return { ok: false, status: 401, error: 'auth_date is too old' };
  }

  const signature = computeSignature(botToken, payload);
  const receivedHash = String(payload.hash).toLowerCase();
  if (!safeCompare(signature, receivedHash)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }

  return { ok: true, status: 200 };
};

const parsePayload = async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const params = Object.fromEntries(url.searchParams.entries());
    return params;
  }

  if (req.method === 'POST') {
    return readBody(req);
  }

  return {};
};

const enforceHttps = (req) => {
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return proto === 'https';
};

const buildUserResponse = (payload) => ({
  id: Number(payload.id),
  first_name: payload.first_name,
  last_name: payload.last_name,
  username: payload.username,
  photo_url: payload.photo_url,
  language_code: payload.language_code,
});

export const handleTelegramRequest = async (req, res, options = {}) => {
  if (!req.url?.startsWith(CALLBACK_PATH)) return false;

  const { botToken = process.env.TELEGRAM_BOT_TOKEN, ttlSeconds = TEN_MINUTES, httpsOnly = true } = options;

  if (httpsOnly && !enforceHttps(req)) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'HTTPS is required' }));
    return true;
  }

  let payload;
  try {
    payload = await parsePayload(req);
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to parse payload' }));
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const validation = validateTelegramPayload(botToken, payload, now, ttlSeconds);
  if (!validation.ok) {
    console.warn('[telegram-auth] validation failed', validation.error);
    res.writeHead(validation.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: validation.error }));
    return true;
  }

  const user = buildUserResponse(payload);
  const exp = now + 3600;
  const tokenPayload = Buffer.from(JSON.stringify({ sub: user.id, iat: now, exp })).toString('base64url');
  const tokenSignature = createHmac('sha256', createHash('sha256').update(botToken).digest())
    .update(tokenPayload)
    .digest('base64url');
  const token = `${tokenPayload}.${tokenSignature}`;

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ user, token, expires_in: exp - now }));
  return true;
};

export const createTelegramAuthServer = (options = {}) => {
  const handler = (req, res) => {
    handleTelegramRequest(req, res, options).then((handled) => {
      if (!handled) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    }).catch((error) => {
      console.error('[telegram-auth] unexpected error', error);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  };

  return createServer(handler);
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const server = createTelegramAuthServer();
  const port = process.env.PORT || 8787;
  server.listen(port, () => console.log(`[telegram-auth] listening on ${port}${CALLBACK_PATH}`));
}
