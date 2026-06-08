// backend/src/config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/smartprep';
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  }
};

module.exports = connectDB;
