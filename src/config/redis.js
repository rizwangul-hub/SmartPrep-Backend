// backend/src/config/redis.js
const IORedis = require("ioredis");
require("dotenv").config();

let redisClient;

// Simple in-memory mock client to prevent server crash if Redis is unavailable
class MockRedis {
  constructor() {
    this.store = {};
    console.warn(
      "⚠️ UPSTASH_REDIS_URL not found or invalid. Using memory fallback cache.",
    );
  }
  async get(key) {
    return this.store[key] || null;
  }
  async set(key, val, mode, duration) {
    this.store[key] = val;
    return "OK";
  }
  async del(key) {
    delete this.store[key];
    return 1;
  }
  on(event, callback) {
    // mock listener
  }
}

const stripQuotes = (s = "") =>
  s.replace(/^\s*"|"\s*$/g, "").replace(/^\s*'|'\s*$/g, "");
const isHttpUrl = (s = "") => /^https?:\/\//i.test(s.trim());

const rawUrl = process.env.UPSTASH_REDIS_URL;
const url = rawUrl ? stripQuotes(rawUrl) : "";

if (url) {
  if (isHttpUrl(url)) {
    // Use Upstash REST client when provided a https:// Upstash URL
    try {
      const { Redis: UpstashRedis } = require("@upstash/redis");
      const token = stripQuotes(process.env.UPSTASH_REDIS_REST_TOKEN || "");
      const upstash = new UpstashRedis({ url, token });

      // Minimal adapter to keep same method names used by the app
      redisClient = {
        get: async (k) => {
          const r = await upstash.get(k);
          // Upstash returns { result: value } for some versions, or value directly
          return r?.result ?? r ?? null;
        },
        set: async (k, v, mode, duration) => {
          // Ignore PX/EX modes for REST client; store raw value
          await upstash.set(k, v);
          return "OK";
        },
        del: async (k) => {
          const r = await upstash.del(k);
          return r?.deleted ?? r ?? 1;
        },
        on: () => {},
      };

      console.log("Connected to Upstash (REST) Redis");
    } catch (err) {
      console.error(
        "Upstash REST client failed, switching to memory cache. Error:",
        err.message,
      );
      redisClient = new MockRedis();
    }
  } else {
    // Treat as a standard Redis URL suitable for ioredis (redis:// or rediss://)
    try {
      redisClient = new IORedis(url);
      redisClient.on("error", (err) => {
        console.error(
          "Redis connection failed, switching to memory cache. Error:",
          err.message,
        );
        redisClient = new MockRedis();
      });
      redisClient.on("connect", () =>
        console.log("Connected to Upstash Redis (TCP)"),
      );
    } catch (err) {
      console.error("Redis instantiation failed:", err.message);
      redisClient = new MockRedis();
    }
  }
} else {
  redisClient = new MockRedis();
}

module.exports = redisClient;
