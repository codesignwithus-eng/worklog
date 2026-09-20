// Shared helpers for all API routes.
// Files starting with "_" are NOT exposed as routes by Vercel.
const crypto = require('crypto');

const HASH_KEY = 'worklog';

/* ---------- Password check ---------- */
function checkAuth(req, res) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'APP_PASSWORD is not set in Vercel environment variables.' });
    return false;
  }
  const given = Buffer.from(String(req.headers['x-app-password'] || ''));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    res.status(401).json({ error: 'Wrong password.' });
    return false;
  }
  return true;
}

/* ---------- Storage (Upstash Redis over REST) ---------- */
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Database is not connected. Add Upstash Redis to your Vercel project (see README).');
  }
  return { url, token };
}

async function redis(command) {
  const { url, token } = redisConfig();
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (j.error) throw new Error('Database error: ' + j.error);
  return j.result;
}

async function loadAll() {
  const result = (await redis(['HGETALL', HASH_KEY])) || [];
  const out = {};
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i += 2) {
      try { out[result[i]] = JSON.parse(result[i + 1]); } catch (e) { /* skip bad row */ }
    }
  } else {
    for (const k of Object.keys(result)) {
      try { out[k] = JSON.parse(result[k]); } catch (e) { /* skip bad row */ }
    }
  }
  return out;
}

/* ---------- Claude ---------- */
async function askClaude(system, user, maxTokens = 1500) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in Vercel environment variables.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'AI request failed.');
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function parseJSON(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('AI returned an unexpected format. Try again.');
  return JSON.parse(text.slice(s, e + 1));
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

module.exports = { checkAuth, redis, loadAll, askClaude, parseJSON, isDate, HASH_KEY };
