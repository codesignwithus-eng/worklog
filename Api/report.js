const { checkAuth, loadAll, askClaude, parseJSON, isDate } = require('./_lib');

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SYSTEM = `You analyze an engineer's work log to find patterns. The person's goals: find their most productive days and why, find non-productive days and their causes, improve priority setting, and stop ending the week exhausted.

Rules:
- Bullet fragments only. Maximum 16 words each. No flowery language.
- Use only the data given. Use the STATS numbers exactly as given; do not recalculate them.
- "score" is the person's own productivity rating (1-5). "energy" is their energy at the end of the day (1-5).
- Look for patterns across days, not single events. Say when there is too little data to conclude.
- If there are no ratings, say so in the overview and do not guess about productive days.
- Do not give medical advice or diagnose anything.
- Use empty arrays when a section has nothing.

Sections:
- "overview": 3-5 bullets. Days logged, average score and energy, best and lowest day.
- "wins": the most important wins of the period.
- "best_day": what the most productive days had in common (work type, priorities set, fewer interruptions).
- "low_days": what happened on the low-score days and why.
- "top_causes": causes of lost time, ranked by how often they appeared.
- "priority_check": how well planned priorities matched the work, and what pulled the person off plan.
- "energy": how energy moved through the period, and which work or habits seem linked to the drop toward the end.
- "suggestions": 3-5 concrete rules to try next period (for example how to set, limit, or protect priorities).
- "next_week_focus": at most 3 suggested top priorities for the next period, taken from carried-over and open items.
- "follow_ups": actions still open (not marked done), each with "who" to answer ("" if unknown).

Return ONLY a JSON object, no markdown, in exactly this shape:
{"overview":[string],"wins":[string],"best_day":[string],"low_days":[string],"top_causes":[string],"priority_check":[string],"energy":[string],"suggestions":[string],"next_week_focus":[string],"follow_ups":[{"task":string,"who":string}]}`;

const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

function buildStats(all, dates) {
  const wd = DAYS.map(() => ({ s: [], e: [] }));
  const pc = { total: 0, done: 0, partly: 0, not: 0 };
  const allS = [];
  const allE = [];
  for (const d of dates) {
    const e = all[d] || {};
    const i = (new Date(d + 'T12:00:00').getDay() + 6) % 7; // Monday = 0
    if (e.score) { wd[i].s.push(e.score); allS.push(e.score); }
    if (e.energy) { wd[i].e.push(e.energy); allE.push(e.energy); }
    const chk = (e.summary && e.summary.plan_check) || [];
    for (const p of chk) {
      pc.total++;
      if (p.status === 'done') pc.done++;
      else if (p.status === 'partly') pc.partly++;
      else pc.not++;
    }
  }
  const byWeekday = DAYS.map((day, i) => ({
    day,
    avgScore: avg(wd[i].s),
    avgEnergy: avg(wd[i].e),
    days: Math.max(wd[i].s.length, wd[i].e.length),
  }));
  const scored = byWeekday.filter((x) => x.avgScore !== null);
  let best = null;
  let worst = null;
  if (scored.length >= 2) {
    best = scored.reduce((a, b) => (b.avgScore > a.avgScore ? b : a));
    worst = scored.reduce((a, b) => (b.avgScore < a.avgScore ? b : a));
    if (best.avgScore === worst.avgScore) { best = null; worst = null; }
  }
  return { byWeekday, best, worst, avgScore: avg(allS), avgEnergy: avg(allE), ratedDays: allS.length, priorities: pc };
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { from, to, label } = req.body || {};
    if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'Invalid date range.' });

    const all = await loadAll();
    const dates = Object.keys(all).filter((d) => d >= from && d <= to).sort();
    if (!dates.length) return res.status(400).json({ error: 'No entries in this period. Log some days first.' });

    const stats = buildStats(all, dates);

    const lines = dates.map((d) => {
      const e = all[d] || {};
      const s = e.summary;
      const wk = DAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7];
      const head = `${d} (${wk}) score: ${e.score || 'not rated'}, energy: ${e.energy || 'not rated'}`;
      const plan = e.plan && e.plan.length ? `Priorities set: ${e.plan.join('; ')}` : 'Priorities set: none';
      if (!s) return `${head}\n${plan}\nRaw notes: ${String(e.raw || '').slice(0, 1500)}`;
      const acts = (s.actions || [])
        .map((a) => `${a.task}${a.who ? ' (to: ' + a.who + ')' : ''}${a.done ? ' [done]' : ' [open]'}`)
        .join('; ');
      const chk = (s.plan_check || []).map((p) => `${p.priority}: ${p.status}`).join('; ');
      return [
        head,
        plan,
        `Priority result: ${chk || '-'}`,
        `Off plan: ${(s.off_plan || []).join('; ') || '-'}`,
        `Wins: ${(s.wins || []).join('; ') || '-'}`,
        `Done: ${(s.done || []).join('; ') || '-'}`,
        `Pending: ${(s.pending || []).join('; ') || '-'}`,
        `Problems: ${(s.problems || []).join('; ') || '-'}`,
        `Causes of lost time: ${(s.causes || []).join('; ') || '-'}`,
        `Actions: ${acts || '-'}`,
      ].join('\n');
    });

    const text = await askClaude(
      SYSTEM,
      `Period: ${label || from + ' to ' + to} (${from} to ${to})\nDays logged: ${dates.length}\n\nSTATS:\n${JSON.stringify(stats)}\n\nLOG:\n${lines.join('\n\n')}`,
      2500
    );
    const r = parseJSON(text);
    const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    const report = {
      overview: arr(r.overview),
      wins: arr(r.wins),
      best_day: arr(r.best_day),
      low_days: arr(r.low_days),
      top_causes: arr(r.top_causes),
      priority_check: arr(r.priority_check),
      energy: arr(r.energy),
      suggestions: arr(r.suggestions),
      next_week_focus: arr(r.next_week_focus),
      follow_ups: Array.isArray(r.follow_ups)
        ? r.follow_ups.filter((a) => a && a.task).map((a) => ({ task: String(a.task), who: String(a.who || '') }))
        : [],
      days: dates.length,
      stats,
    };
    return res.status(200).json({ report });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
