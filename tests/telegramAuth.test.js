import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { createTelegramAuthServer, buildDataCheckString, computeSignature, validateTelegramPayload } from '../server/telegramAuth.js';

const BOT_TOKEN = '123456:AAEAAeRVTeStToKen';
let server;
let baseUrl;

const makePayload = (overrides = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: '1000',
    first_name: 'Tester',
    username: 'qa_bot',
    auth_date: `${now}`,
    ...overrides,
  };
  const hash = computeSignature(BOT_TOKEN, payload);
  return { ...payload, hash };
};

beforeEach(async () => {
  server = createTelegramAuthServer({ botToken: BOT_TOKEN, httpsOnly: false });
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('buildDataCheckString sorts keys and skips hash', () => {
  const payload = { hash: 'ignored', b: '2', a: '1', c: '3' };
  const result = buildDataCheckString(payload);
  assert.equal(result, 'a=1\nb=2\nc=3');
});

test('computeSignature matches manual HMAC', () => {
  const payload = { id: '1', first_name: 'Test', auth_date: '10' };
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
  const expected = createHmac('sha256', secretKey)
    .update('auth_date=10\nfirst_name=Test\nid=1')
    .digest('hex');
  assert.equal(computeSignature(BOT_TOKEN, { ...payload, hash: 'x' }), expected);
});

test('validateTelegramPayload rejects stale auth_date', () => {
  const old = Math.floor(Date.now() / 1000) - 700;
  const payload = makePayload({ auth_date: `${old}` });
  const result = validateTelegramPayload(BOT_TOKEN, payload, Math.floor(Date.now() / 1000), 600);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('POST /api/auth/telegram/callback returns token on success', async () => {
  const payload = makePayload();
  const response = await fetch(`${baseUrl}/api/auth/telegram/callback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.ok(json.token);
  assert.equal(json.user.id, Number(payload.id));
  assert.equal(json.user.first_name, payload.first_name);
  assert.ok(json.expires_in > 0);
});

test('POST /api/auth/telegram/callback rejects invalid hash', async () => {
  const payload = { ...makePayload(), hash: 'deadbeef' };
  const response = await fetch(`${baseUrl}/api/auth/telegram/callback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 401);
});

test('GET /api/auth/telegram/callback rejects expired auth_date', async () => {
  const old = Math.floor(Date.now() / 1000) - 1000;
  const payload = makePayload({ auth_date: `${old}` });
  const url = new URL(`${baseUrl}/api/auth/telegram/callback`);
  Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url);
  assert.equal(response.status, 401);
});
