
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

// ============================================================================
// 1. ENVIRONMENT SETUP
// ============================================================================
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// ============================================================================
// 2. DATABASE CONNECTION (lazy loading)
// ============================================================================
const connectDB = require("./src/config/db");

if (!process.env.VERCEL) {
  connectDB().catch((err) => {
    console.error('Initial MongoDB connection failed:', err.message || err);
  });
}

// ============================================================================
// 3. PASSPORT AUTH
// ============================================================================
const passport = require("./src/config/passport");

// ============================================================================
// 4. CREATE EXPRESS APP
// ============================================================================
const app = express();

// ============================================================================
// 5. CORS CONFIGURATION
// ============================================================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://smart-prep-ai-jet.vercel.app",
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_FRONTEND_URL,
  "https://my-production-frontend.vercel.app",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    console.log("REQ ORIGIN:", origin);
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow Vercel preview and deployment domains that match our project name pattern
    if (origin.startsWith("https://smart-prep") && origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin denied: ${origin}`));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// ============================================================================
// 6. MIDDLEWARE
// ============================================================================
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());

// Handle favicon quickly
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Lazy database connection on first request
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('DB connect error in middleware:', err.message || err);
  }
  next();
});

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ============================================================================
// 7. HEALTH CHECK & ROOT ROUTES
// ============================================================================
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

app.get("/api/public-stats", async (req, res) => {
  try {
    const Question = require("./src/models/Question");
    const questionCount = await Question.countDocuments({ isActive: true });
    res.json({ questionCount });
  } catch (err) {
    console.error("Error fetching public stats:", err.message || err);
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
});

app.get('/', (req, res) =>
  res.json({ 
    success: true, 
    message: 'PrepForce AI backend is running',
    FRONTEND_URL: process.env.FRONTEND_URL || 'Not Set'
  }),
);

// ============================================================================
// 8. IMPORT ALL ROUTES
// ============================================================================
const authRoutes = require("./src/routes/auth");
const examRoutes = require("./src/routes/exams");
const resultRoutes = require("./src/routes/results");
const adminRoutes = require("./src/routes/admin");
const studyRoutes = require("./src/routes/study");
const gamificationRoutes = require("./src/routes/gamification");
const questionRoutes = require("./src/routes/questions");
const notificationRoutes = require("./src/routes/notifications");
const testRoutes = require("./src/routes/test");
const uploadRoutes = require("./src/routes/upload");
const projectRoutes = require("./src/routes/projects");
const longTaskRoutes = require("./src/routes/longtask");

// Dev-only admin routes
let devAdminRoutes;
if (process.env.DEV_ALLOW_ADMIN_UPDATE === "true") {
  try {
    devAdminRoutes = require("./src/routes/devAdmin");
    app.use("/api/dev/admin", devAdminRoutes);
    console.log("Dev admin updates enabled at /api/dev/admin (PUT /settings)");
  } catch (err) {
    console.warn("Dev admin route not available:", err.message);
  }
}

// ============================================================================
// 9. REGISTER ALL ROUTES
// ============================================================================
app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/longtask", longTaskRoutes);

// ============================================================================
// 10. ERROR HANDLING
// ============================================================================
// 404 catch-all
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

// ============================================================================
// 11. CREATE HTTP SERVER & START
// ============================================================================
const http = require('http');
const DEFAULT_PORT = 5000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

const server = http.createServer(app);

function onListening(port) {
  console.log(`🚀 Server listening on port ${port}`);
}

let attempts = 0;

function start() {
  server.listen(PORT + attempts, () => onListening(PORT + attempts));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && attempts < 10) {
    console.warn(`Port ${PORT + attempts} in use, trying ${PORT + attempts + 1}...`);
    attempts += 1;
    start();
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Start the server
if (!process.env.VERCEL) {
  start();
}

// ============================================================================
// EXPORT FOR VERCEL SERVERLESS
// ============================================================================
module.exports = app;
