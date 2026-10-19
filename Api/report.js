import { redis, verifyAuth, sendError } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  if (!verifyAuth(req)) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    const { startDate, endDate } = req.body;

    // Fetch all entry keys from Redis
    const keys = await redis.keys('entry:*');
    
    if (!keys || keys.length === 0) {
      return res.status(200).json({
        message: 'No log entries found for analysis.',
        stats: { totalDays: 0, avgProductivity: 0, avgEnergy: 0 }
      });
    }

    // Retrieve all entries
    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const rawEntries = await pipeline.exec();

    const entries = rawEntries
      .map(entry => (typeof entry === 'string' ? JSON.parse(entry) : entry))
      .filter(Boolean);

    // Filter by date range if provided
    const filteredEntries = entries.filter(entry => {
      if (!startDate || !endDate) return true;
      return entry.date >= startDate && entry.date <= endDate;
    });

    if (filteredEntries.length === 0) {
      return res.status(200).json({ message: 'No entries match the selected date range.' });
    }

    // Calculate local deterministic statistics
    let totalProd = 0;
    let totalEnergy = 0;
    let bestDays = [];
    let worstDays = [];
    let allProblems = [];

    filteredEntries.forEach(entry => {
      const p = Number(entry.productivityRating) || 3;
      const e = Number(entry.energyRating) || 3;

      totalProd += p;
      totalEnergy += e;

      if (p >= 5) bestDays.push(entry.date);
      if (p <= 2) worstDays.push(entry.date);

      if (entry.problems && Array.isArray(entry.problems)) {
        allProblems.push(...entry.problems);
      }
    });

    const totalDays = filteredEntries.length;
    const avgProductivity = (totalProd / totalDays).toFixed(1);
    const avgEnergy = (totalEnergy / totalDays).toFixed(1);

    const analysisReport = {
      period: { startDate: startDate || 'All-time', endDate: endDate || 'Present' },
      totalDaysLogged: totalDays,
      metrics: {
        averageProductivity: Number(avgProductivity),
        averageEnergy: Number(avgEnergy)
      },
      highlights: {
        bestDays,
        worstDays
      },
      commonBlockers: [...new Set(allProblems)].slice(0, 5), // Top unique problems encountered
      generatedAt: new Date().toISOString()
    };

    return res.status(200).json(analysisReport);
  } catch (error) {
    console.error('Error generating report:', error);
    return sendError(res, 500, 'Internal Server Error');
  }
}
