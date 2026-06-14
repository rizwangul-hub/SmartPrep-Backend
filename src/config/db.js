// backend/src/config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URL;
    if (!uri) {
      console.warn('MONGO_URL not provided — skipping MongoDB connection (serverless environment?)');
      return;
    }
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }
    await mongoose.connect(uri, { autoIndex: false });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error', err);
    // Don't exit process in serverless environments — API routes should handle DB absence gracefully.
  }
};

module.exports = connectDB;
