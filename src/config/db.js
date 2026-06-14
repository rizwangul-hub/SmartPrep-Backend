// backend/src/config/db.js
'use strict';
const mongoose = require('mongoose');

const dbOptions = {
  autoIndex: false,
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5,
  family: 4,
};

if (!global.__mongoose) {
  global.__mongoose = { conn: null, promise: null };
}

let connectionPromise = global.__mongoose.promise;

const connectDB = async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.warn('MONGO_URL is not set — skipping MongoDB connection');
    return;
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  mongoose.set('strictQuery', false);

  connectionPromise = mongoose
    .connect(uri, dbOptions)
    .then((mongooseInstance) => {
      console.log('✅ MongoDB connected');
      global.__mongoose.conn = mongooseInstance.connection;
      return mongooseInstance;
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message || err);
      global.__mongoose.promise = null;
      connectionPromise = null; // allow retry on next request
      throw err;
    });

  global.__mongoose.promise = connectionPromise;
  return connectionPromise;
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error event:', err.message || err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

module.exports = connectDB;
