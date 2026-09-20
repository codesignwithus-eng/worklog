const { checkAuth, askClaude, parseJSON, isDate } = require('./_lib');

const SYSTEM = `You turn an engineer's rough daily work notes into a short, factual work-log entry. The purpose of the log is to find what makes a day productive, what wastes time, and to improve priority setting.

Rules:
- Write bullet fragments only. Maximum 12 words each. No long or flowery sentences.
- Use only facts found in the notes. Never invent names, numbers, or tasks.
- Keep names of people, customers, countries, and projects exactly as written.
- Silently fix obvious typos.
- "wins": real good outcomes of the day (completed leads, sent quotations, problems solved).
- "done": work completed that day.
- "pending": work started but not finished.
- "problems": blockers, delays, or anything that hurt the day's work.
- "causes": the reasons time or energy was lost (for example doing someone else's task, interruptions, waiting, unclear priority, too many meetings, switching between tasks). Only if the notes show it. Short and specific.
- "actions": every follow-up the person still has to do. "who" is the person or party they should reply to, follow up with, or report to. Use a name from the notes if there is one. If no name is given but a role is obvious (for example a manager for a workload issue), use the role. Otherwise use an empty string.
- "plan_check": ONLY if priorities are listed in the message. One item per priority, same wording, with "status" exactly "done", "partly", or "not done", judged from the notes. If the notes do not mention a priority, use "not done".
- "off_plan": ONLY if priorities are listed. Work the notes show that was not one of the priorities.
- Use empty arrays when a section has nothing.

Return ONLY a JSON object, no markdown, in exactly this shape:
{"wins":[string],"done":[string],"pending":[string],"problems":[string],"causes":[string],"actions":[{"task":string,"who":string}],"plan_check":[{"priority":string,"status":string}],"off_plan":[string]}`;

const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const status = (s) => {
  const t = String(s || '').toLowerCase();
  if (t === 'done') return 'done';
  if (t.startsWith('part')) return 'partly';
  return 'not done';
};

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { date, raw, plan } = req.body || {};
    if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
    if (!raw || !String(raw).trim()) return res.status(400).json({ error: 'Write your notes first.' });
    if (String(raw).length > 20000) return res.status(400).json({ error: 'Notes are too long (max 20,000 characters).' });

    const priorities = Array.isArray(plan) ? plan.slice(0, 3).map((s) => String(s).slice(0, 200)).filter(Boolean) : [];
    const planText = priorities.length
      ? `Top priorities I set for this day:\n${priorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n`
      : 'No priorities were set for this day.\n\n';

    const text = await askClaude(SYSTEM, `Date: ${date}\n\n${planText}My notes:\n${raw}`, 1500);
    const s = parseJSON(text);

    const summary = {
      wins: arr(s.wins),
      done: arr(s.done),
      pending: arr(s.pending),
      problems: arr(s.problems),
      causes: arr(s.causes),
      actions: Array.isArray(s.actions)
        ? s.actions.filter((a) => a && a.task).map((a) => ({ task: String(a.task), who: String(a.who || '') }))
        : [],
      plan_check: priorities.length && Array.isArray(s.plan_check)
        ? s.plan_check.filter((p) => p && p.priority).map((p) => ({ priority: String(p.priority), status: status(p.status) }))
        : [],
      off_plan: priorities.length ? arr(s.off_plan) : [],
    };
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
