const { checkAuth, loadAll, isDate, errorResponse } = require('./_lib');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const avg = (values) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
const countBy = (values) => {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([value, count]) => `${value} (${count})`);
};

function buildReport(all, dates) {
  const scores = [], energies = [], weekday = DAYS.map(() => ({ scores: [], energies: [] }));
  const wins = [], causes = [], done = [], pending = [], problems = [], suggestions = [];
  const followUps = new Map();
  const priorityStats = { total: 0, done: 0, partly: 0, not: 0 };
  for (const date of dates) {
    const entry = all[date] || {};
    const idx = (new Date(date + 'T12:00:00').getDay() + 6) % 7;
    if (Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 5) { scores.push(entry.score); weekday[idx].scores.push(entry.score); }
    if (Number.isInteger(entry.energy) && entry.energy >= 1 && entry.energy <= 5) { energies.push(entry.energy); weekday[idx].energies.push(entry.energy); }
    const s = entry.summary || {};
    (s.wins || []).forEach((x) => wins.push(x));
    (s.done || []).forEach((x) => done.push(x));
    (s.pending || []).forEach((x) => pending.push(x));
    (s.problems || []).forEach((x) => problems.push(x));
    (s.causes || []).forEach((x) => causes.push(x));
    (s.plan_check || []).forEach((p) => { priorityStats.total++; if (p.status === 'done') priorityStats.done++; else if (p.status === 'partly') priorityStats.partly++; else priorityStats.not++; });
    (s.actions || []).filter((a) => !a.done && a.task).forEach((a) => followUps.set(a.task.toLowerCase(), { task: a.task, who: a.who || '' }));
  }
  const byWeekday = DAYS.map((day, i) => ({ day, avgScore: avg(weekday[i].scores), avgEnergy: avg(weekday[i].energies), days: Math.max(weekday[i].scores.length, weekday[i].energies.length) }));
  const rated = byWeekday.filter((d) => d.avgScore !== null);
  const best = rated.length ? rated.reduce((a, b) => b.avgScore > a.avgScore ? b : a) : null;
  const worst = rated.length ? rated.reduce((a, b) => b.avgScore < a.avgScore ? b : a) : null;
  const unique = (a) => Array.from(new Set(a));
  const avgScore = avg(scores), avgEnergy = avg(energies);
  const overview = [`${dates.length} day(s) logged in this period.`, `Average productivity: ${avgScore === null ? 'not rated' : avgScore + '/5'}.`, `Average energy: ${avgEnergy === null ? 'not rated' : avgEnergy + '/5'}.`];
  if (best) overview.push(`Highest average weekday: ${best.day} (${best.avgScore}/5).`);
  if (worst && (!best || worst.day !== best.day)) overview.push(`Lowest average weekday: ${worst.day} (${worst.avgScore}/5).`);
  if (!scores.length) overview.push('Add productivity ratings to identify stronger and weaker days.');
  const reportSuggestions = [];
  if (priorityStats.total && priorityStats.done / priorityStats.total < 0.6) reportSuggestions.push('Set fewer priorities and reserve protected time for the most important one.');
  if (causes.length) reportSuggestions.push('Review recurring blockers and plan a specific way to reduce the most common one.');
  if (pending.length) reportSuggestions.push('Start each morning by reviewing open tasks from the previous day.');
  if (energies.length && avgEnergy < 3) reportSuggestions.push('Review workload and breaks on low-energy days; avoid overloading the daily plan.');
  if (!reportSuggestions.length) reportSuggestions.push('Keep recording priorities, notes, and ratings to reveal useful patterns over time.');
  const stats = { byWeekday, best, worst, avgScore, avgEnergy, ratedDays: scores.length, priorities: priorityStats };
  return {
    overview, wins: unique(wins).slice(0, 10), best_day: best ? [`${best.day} has the highest average productivity rating (${best.avgScore}/5).`] : ['Not enough rated weekday data to identify a best day.'],
    low_days: worst ? [`${worst.day} has the lowest average productivity rating (${worst.avgScore}/5). Review notes for causes.`] : ['Not enough rated weekday data to identify low days.'],
    top_causes: countBy(causes).slice(0, 5), priority_check: priorityStats.total ? [`${priorityStats.done} of ${priorityStats.total} priorities marked done; ${priorityStats.partly} partly done; ${priorityStats.not} not done.`] : ['No priority checks available yet.'],
    energy: energies.length ? [`Average end-of-day energy: ${avgEnergy}/5 across ${energies.length} rated day(s).`] : ['No energy ratings recorded in this period.'],
    suggestions: reportSuggestions.slice(0, 5), next_week_focus: unique(pending).slice(0, 3), follow_ups: Array.from(followUps.values()),
    days: dates.length, stats,
  };
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { from, to } = req.body || {};
    if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'Invalid date range.' });
    const all = await loadAll();
    const dates = Object.keys(all).filter((date) => isDate(date) && date >= from && date <= to).sort();
    if (!dates.length) return res.status(400).json({ error: 'No entries in this period. Log some days first.' });
    return res.status(200).json({ report: buildReport(all, dates) });
  } catch (error) { return errorResponse(res, error); }
};
