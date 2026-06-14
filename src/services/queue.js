// src/services/queue.js  (CommonJS – matches "type": "commonjs" in package.json)
'use strict';

const KV_URL   = process.env.KV_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const NS       = 'jobs'; // namespace prefix for all job keys

// ── Internal helper ────────────────────────────────────────────────────────────
async function kvRequest(method, path, body) {
  const url = `${KV_URL}/${NS}/${path}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  // fetch is built-in since Node 18 – no extra package needed
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`KV request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a new job.
 * Stores the job data in KV and appends the jobId to the pending queue list.
 * Returns the generated jobId.
 */
async function enqueueJob(payload) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await kvRequest('PUT', id, { status: 'queued', payload });
  // Maintain a simple list so the worker knows which jobs are pending
  let queue = [];
  try { queue = await kvRequest('GET', 'queue') || []; } catch (_) {}
  queue.push(id);
  await kvRequest('PUT', 'queue', queue);
  return id;
}

/**
 * Get the current status (and result, if done) of a job.
 */
async function getJobStatus(id) {
  try {
    return await kvRequest('GET', id);
  } catch (_) {
    return { status: 'not-found' };
  }
}

/**
 * Pop the next pending jobId from the queue list.
 * Returns null if nothing is queued.
 */
async function popNextJob() {
  let queue = [];
  try { queue = await kvRequest('GET', 'queue') || []; } catch (_) {}
  if (!queue.length) return null;
  const jobId = queue[0];
  await kvRequest('PUT', 'queue', queue.slice(1));
  return jobId;
}

/**
 * Merge `update` into the existing job record.
 * Use this to mark a job as processing / completed / failed.
 */
async function updateJob(id, update) {
  const cur = await getJobStatus(id) || {};
  await kvRequest('PUT', id, { ...cur, ...update });
}

module.exports = { enqueueJob, getJobStatus, popNextJob, updateJob };
