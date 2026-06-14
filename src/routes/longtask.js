const router = require('express').Router();
const { enqueueJob, getJobStatus } = require('../services/queue');

// POST /api/longtask/process – enqueue a heavy job
router.post('/process', async (req, res) => {
  try {
    const jobId = await enqueueJob(req.body);
    res.json({ status: 'queued', jobId });
  } catch (err) {
    console.error('Enqueue error:', err);
    res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

// GET /api/longtask/status/:id – query job status / result
router.get('/status/:id', async (req, res) => {
  try {
    const status = await getJobStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'Job not found' });
    res.json(status);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;
