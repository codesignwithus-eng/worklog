const { checkAuth, isDate, loadAll, redis, HASH_KEY, errorResponse } = require('./_lib');

const cleanText = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 240);
const has = (text, pattern) => pattern.test(text);
const normalize = (s) => String(s || '').toLowerCase().replace(/\b(sent|sending)\b/g, 'send').replace(/\b(completed|finishing|finished)\b/g, 'finish').replace(/[^a-z0-9]+/g, ' ').trim();
const priorityWords = (s) => normalize(s).split(' ').filter((word) => word && !['the', 'a', 'an', 'to', 'for', 'with', 'and', 'of'].includes(word));

function summarize(raw, priorities) {
  const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const summary = { wins: [], done: [], pending: [], problems: [], causes: [], actions: [], plan_check: [], off_plan: [] };
  const doneLines = [];
  const seen = new Set();
  const add = (key, line) => {
    const value = cleanText(line.replace(/^[-*•\s]+/, '').replace(/^\[[xX! ]\]\s*/, '').replace(/^done:\s*/i, ''));
    const id = key + ':' + normalize(value);
    if (value && !seen.has(id)) { summary[key].push(value); seen.add(id); }
  };

  for (const original of lines) {
    const line = original.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '');
    const lower = line.toLowerCase();
    const isDone = /^\s*\[[xX]\]/.test(original) || /^done\s*:/i.test(line) || /\b(done|completed|finished|shipped|sent|submitted|resolved|fixed|delivered|closed)\b/i.test(line);
    const isProblem = /^\s*\[!\]/.test(original) || /\b(issue|blocked|blocker|problem|bug|delay|delayed|waiting on|stuck|failed|failure|could not|unable to)\b/i.test(line);
    const isFollow = /@\w+|\b(follow[ -]?up|call|email|reply to|contact|remind|send to|check with)\b/i.test(line);
    if (isProblem) {
      add('problems', line);
      if (/\b(interrupt|waiting|delay|blocked|meeting|unclear|context switch|switching|rework)\b/i.test(lower)) add('causes', line);
    }
    if (isDone) { add('done', line); doneLines.push(line); }
    else if (!isProblem && !isFollow) add('pending', line);
    if (isFollow) {
      const task = cleanText(line.replace(/^\s*\[[xX! ]\]\s*/, ''));
      const whoMatch = task.match(/@([\w.-]+)/);
      const who = whoMatch ? whoMatch[1] : '';
      if (!summary.actions.some((a) => normalize(a.task) === normalize(task))) summary.actions.push({ task, who, done: isDone });
      if (!isDone && !isProblem) add('pending', line);
    }
  }
  summary.wins = summary.done.slice();
  if (priorities.length) {
    summary.plan_check = priorities.map((priority) => {
      const p = normalize(priority);
      const pWords = priorityWords(priority);
      const matches = doneLines.some((line) => {
        const n = normalize(line);
        const nWords = priorityWords(line);
        const overlap = pWords.filter((word) => nWords.includes(word)).length;
        return (p && n.includes(p)) || (pWords.length > 0 && overlap >= Math.ceil(pWords.length * 0.7));
      });
      const partly = lines.some((line) => {
        const nWords = priorityWords(line);
        const overlap = pWords.filter((word) => nWords.includes(word)).length;
        return pWords.length > 0 && overlap >= Math.ceil(pWords.length * 0.7) && !/\b(done|completed|finished|shipped|sent|submitted|resolved|fixed|delivered|closed)\b/i.test(line);
      });
      return { priority, status: matches ? 'done' : partly ? 'partly' : 'not done' };
    });
    summary.off_plan = doneLines.filter((line) => !priorities.some((p) => normalize(line).includes(normalize(p))));
  }
  return summary;
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { date, raw, plan } = req.body || {};
    if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
    if (typeof raw !== 'string' || !raw.trim()) return res.status(400).json({ error: 'Write your notes first.' });
    if (raw.length > 20000) return res.status(400).json({ error: 'Notes are too long (max 20,000 characters).' });
    const priorities = Array.isArray(plan) ? plan.slice(0, 3).map(cleanText).filter(Boolean) : [];
    const summary = summarize(raw, priorities);

    // Preserve manually checked follow-ups from an existing summary.
    const all = await loadAll();
    const previousActions = (all[date] && all[date].summary && all[date].summary.actions) || [];
    summary.actions = summary.actions.map((action) => {
      const previous = previousActions.find((item) => normalize(item.task) === normalize(action.task));
      return { ...action, done: previous ? !!previous.done : !!action.done };
    });

    const previous = all[date] || {};
    const entry = {
      ...previous,
      raw,
      plan: priorities,
      summary,
      updatedAt: new Date().toISOString(),
    };
    await redis(['HSET', HASH_KEY, date, JSON.stringify(entry)]);
    return res.status(200).json({ summary, saved: true });
  } catch (error) {
    return errorResponse(res, error);
  }
};
module.exports.summarize = summarize;
