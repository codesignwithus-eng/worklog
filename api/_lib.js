// Shared helpers for Vercel serverless API routes.
const crypto = require('crypto');
const HASH_KEY = 'worklog';

function checkAuth(req, res) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'Server authentication is not configured.' });
    return false;
  }
  const given = Buffer.from(String(req.headers['x-app-password'] || ''));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    res.status(401).json({ error: 'Unauthorized.' });
    return false;
  }
  return true;
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Database is not configured. Check the Upstash environment variables.');
  return { url, token };
}

async function redis(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}).`);
  const payload = await response.json();
  if (payload.error) throw new Error('Database operation failed.');
  return payload.result;
}

async function loadAll() {
  const result = (await redis(['HGETALL', HASH_KEY])) || [];
  const entries = {};
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i += 2) {
      try { entries[result[i]] = JSON.parse(result[i + 1]); } catch (_) { /* ignore corrupt row */ }
    }
  } else {
    for (const key of Object.keys(result)) {
      try { entries[key] = JSON.parse(result[key]); } catch (_) { /* ignore corrupt row */ }
    }
  }
  return entries;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function errorResponse(res, error) {
  // Keep implementation details and secrets out of client responses.
  console.error('[worklog-api]', error && error.message ? error.message : error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { checkAuth, redis, loadAll, isDate, HASH_KEY, errorResponse };
