const { checkAuth, redis, loadAll, isDate, HASH_KEY, errorResponse } = require('./_lib');
const rating = (value) => (Number.isInteger(value) && value >= 1 && value <= 5 ? value : null);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    if (req.method === 'GET') {
      const date = req.query && req.query.date;
      if (date) {
        if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
        const value = await redis(['HGET', HASH_KEY, date]);
        if (!value) return res.status(200).json({ entries: {}, entry: null });
        try { return res.status(200).json({ entries: { [date]: JSON.parse(value) }, entry: JSON.parse(value) }); }
        catch (_) { return res.status(500).json({ error: 'Stored entry could not be read.' }); }
      }
      return res.status(200).json({ entries: await loadAll() });
    }

    if (req.method === 'POST') {
      const { date, entry } = req.body || {};
      if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
      if (!entry || typeof entry.raw !== 'string') return res.status(400).json({ error: 'Missing entry.' });
      if (entry.raw.length > 20000) return res.status(400).json({ error: 'Notes are too long (max 20,000 characters).' });
      const clean = {
        raw: entry.raw,
        plan: Array.isArray(entry.plan) ? entry.plan.slice(0, 3).map((s) => String(s).trim().slice(0, 200)).filter(Boolean) : [],
        score: rating(entry.score),
        energy: rating(entry.energy),
        summary: entry.summary && typeof entry.summary === 'object' ? entry.summary : null,
        updatedAt: new Date().toISOString(),
      };
      await redis(['HSET', HASH_KEY, date, JSON.stringify(clean)]);
      return res.status(200).json({ ok: true, entry: clean });
    }

    if (req.method === 'DELETE') {
      const date = req.query && req.query.date;
      if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
      await redis(['HDEL', HASH_KEY, date]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) { return errorResponse(res, error); }
};
