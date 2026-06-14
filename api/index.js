// api/index.js — Vercel Serverless Function wrapper for the Express app
const serverless = require('serverless-http');
const app = require('../src/app');

module.exports = serverless(app);
