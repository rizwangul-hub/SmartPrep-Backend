// backend/src/config/db.js
'use strict';
const mongoose = require('mongoose');

let connectionPromise = null; // cached promise — reused across warm invocations

const connectDB = async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.warn('MONGO_URL not set — skipping MongoDB connection');
    return;
  }

  // Already connected — skip
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Already connecting — wait for the existing attempt
  if (connectionPromise) {
    return connectionPromise;
  }

  // First call — create and cache the promise
  connectionPromise = mongoose
    .connect(uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000, // fail fast if DB is unreachable
      socketTimeoutMS: 10000,
    })
    .then(() => {
      console.log('✅ MongoDB connected');
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      connectionPromise = null; // allow retry on next request
    });

  return connectionPromise;
};

module.exports = connectDB;
