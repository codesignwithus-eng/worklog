import { redis, verifyAuth, sendError } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  if (!verifyAuth(req)) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    const { date, notes, priorities = [], productivityRating = 3, energyRating = 3 } = req.body;

    if (!date) {
      return sendError(res, 400, 'Date is required');
    }

    // Split raw notes line-by-line
    const lines = notes ? notes.split('\n').map(l => l.trim()).filter(Boolean) : [];

    const done = [];
    const pending = [];
    const problems = [];
    const followUps = [];

    // Local Rule-Based Parsing Logic
    lines.forEach(line => {
      const lower = line.toLowerCase();

      // Check for follow-ups (mentions, calls, emails)
      if (lower.includes('@') || lower.includes('follow up') || lower.includes('call') || lower.includes('email')) {
        followUps.push(line);
      }
      // Check for completed tasks
      else if (lower.startsWith('[x]') || lower.startsWith('done:') || lower.includes('completed')) {
        done.push(line.replace(/^([x]|done:)/i, '').trim());
      }
      // Check for problems / blockers
      else if (lower.startsWith('[!]') || lower.includes('issue') || lower.includes('blocked') || lower.includes('problem') || lower.includes('bug')) {
        problems.push(line.replace(/^([!]|issue:|problem:)/i, '').trim());
      }
      // Default remaining items to pending
      else {
        pending.push(line.replace(/^([ ])/i, '').trim());
      }
    });

    // Evaluate priority completion status locally
    const priorityStatus = priorities.map(priority => {
      const matched = done.some(d => d.toLowerCase().includes(priority.toLowerCase()));
      return {
        priority,
        status: matched ? 'Done' : 'Pending'
      };
    });

    const summaryResult = {
      date,
      notes,
      done,
      pending,
      problems,
      followUps,
      priorityStatus,
      productivityRating,
      energyRating,
      summaryType: 'rule-based',
      createdAt: new Date().toISOString()
    };

    // Save entry data directly to Upstash Redis
    await redis.set(`entry:${date}`, JSON.stringify(summaryResult));

    return res.status(200).json(summaryResult);
  } catch (error) {
    console.error('Error processing summary:', error);
    return sendError(res, 500, 'Internal Server Error');
  }
}
