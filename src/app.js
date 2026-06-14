// backend/src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
require("dotenv").config();
const connectDB = require("./config/db");
const passport = require("./config/passport");

connectDB();

const app = express();

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_FRONTEND_URL,
  "https://my-production-frontend.vercel.app",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    console.log("REQ ORIGIN:", origin);
    if (!origin) {
      // Allow server-to-server requests or curl/postman with no origin
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
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

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const examRoutes = require("./routes/exams");
const resultRoutes = require("./routes/results");
const adminRoutes = require("./routes/admin");
const studyRoutes = require("./routes/study");
const gamificationRoutes = require("./routes/gamification");
const questionRoutes = require("./routes/questions");
const notificationRoutes = require("./routes/notifications");
const testRoutes = require("./routes/test");
const uploadRoutes = require("./routes/upload");
const projectRoutes = require("./routes/projects");
const longTaskRoutes = require("./routes/longtask");
// Dev-only admin route (enabled by setting DEV_ALLOW_ADMIN_UPDATE=true in .env)
let devAdminRoutes;
if (process.env.DEV_ALLOW_ADMIN_UPDATE === "true") {
  try {
    devAdminRoutes = require("./routes/devAdmin");
    app.use("/api/dev/admin", devAdminRoutes);
    console.log("Dev admin updates enabled at /api/dev/admin (PUT /settings)");
  } catch (err) {
    console.warn("Dev admin route not available:", err.message);
  }
}

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

module.exports = app;
