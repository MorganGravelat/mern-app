const express = require('express');
const crypto = require('crypto');
const { WorkOrder } = require('../../models');
const { ApiError } = require('../middleware/errors');
const rules = require('../utils/workOrderRules');
const config = require('../config');

const router = express.Router();

// Regex: case-insensitive "Complete OF-NNN" at start of string, after whitespace,
// or after a line break. Captures the task id (OF-NNN).
const MARKER_REGEX = /(?:^|\s)complete\s+(OF-\d+)\b/gi;

/**
 * Verifies GitHub's X-Hub-Signature-256 header against req.rawBody using
 * our shared secret. Returns true if the signature matches, false otherwise.
 * Uses crypto.timingSafeEqual to avoid timing attacks.
 */
function verifySignature(req) {
  const secret = config.githubWebhookSecret;
  if (!secret) return false; // webhook disabled when no secret set
  const header = req.get('X-Hub-Signature-256');
  if (!header || !header.startsWith('sha256=')) return false;
  if (!req.rawBody) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Pulls all unique OF-XXX ids out of a commit message.
 * Returns an array of strings like ['OF-102', 'OF-105'].
 */
function extractTaskIds(message) {
  if (!message) return [];
  const ids = new Set();
  let match;
  // Reset lastIndex because MARKER_REGEX has /g.
  MARKER_REGEX.lastIndex = 0;
  while ((match = MARKER_REGEX.exec(message)) !== null) {
    ids.add(match[1].toUpperCase());
  }
  return [...ids];
}

/**
 * Handles one commit: for each OF-XXX marker, find the work order linked to
 * repoFullName that contains that taskId, mark the item done, auto-complete
 * the WO if everything is now ticked. Returns the number of tasks marked done.
 */
async function processCommit(commit, repoFullName) {
  const taskIds = extractTaskIds(commit.message);
  if (taskIds.length === 0) return 0;

  const autoInfo = {
    source: 'github-webhook',
    commitSha: commit.id,
    commitAuthor: (commit.author && (commit.author.username || commit.author.name)) || '',
    commitMessage: commit.message || '',
    repoFullName,
    at: new Date()
  };

  let marked = 0;
  for (const taskId of taskIds) {
    // Find every WO linked to this repo that has this task id not yet done.
    const orders = await WorkOrder.find({
      githubRepo: repoFullName,
      checklist: { $elemMatch: { taskId, done: false } }
    });
    for (const order of orders) {
      let changed = false;
      for (const item of order.checklist) {
        if (item.taskId === taskId && !item.done) {
          item.done = true;
          changed = true;
          marked++;
        }
      }
      if (changed) {
        rules.autoCompleteIfDone(order, autoInfo);
        await order.save();
      }
    }
  }
  return marked;
}

// POST /api/github/webhook
// GitHub calls this on every push. Auth is by HMAC signature, not JWT.
router.post('/webhook', async (req, res, next) => {
  try {
    if (!verifySignature(req)) {
      throw new ApiError(401, 'BAD_SIGNATURE', 'GitHub signature did not match');
    }

    const event = req.get('X-GitHub-Event');
    // GitHub's "ping" event fires when a webhook is first registered. Respond OK.
    if (event === 'ping') {
      return res.json({ ok: true, pong: true });
    }
    if (event !== 'push') {
      // Not interested; return 200 so GitHub doesn't retry.
      return res.json({ ok: true, ignored: event || 'unknown' });
    }

    const payload = req.body;
    const repoFullName = payload.repository && payload.repository.full_name;
    if (!repoFullName) {
      throw new ApiError(400, 'NO_REPO', 'Push payload is missing repository.full_name');
    }

    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    let totalMarked = 0;
    for (const commit of commits) {
      totalMarked += await processCommit(commit, repoFullName);
    }

    res.json({ ok: true, repo: repoFullName, commits: commits.length, tasksMarked: totalMarked });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
