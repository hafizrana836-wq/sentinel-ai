require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const db = require("./config/db"); // Neon-tuned pg Pool + queryWithRetry — do not replace
const Scan = require("./models/Scan");
const socket = require("./utils/socket");
const { initCronJobs } = require("./utils/cronManager");

const authRoutes = require("./routes/authRoutes");
const scanRoutes = require("./routes/scanRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const keysRoutes = require("./routes/keysRoutes"); // -> controllers/apiKeysController -> models/ApiKey
const publicApiRoutes = require("./routes/publicApi");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");

// fail fast if critical config is missing — a misconfigured JWT_SECRET is
// worse than a server that refuses to start. config/db.js already throws
// on a missing DATABASE_URL the moment it's required above.
if (!process.env.JWT_SECRET) {
  console.error("[boot] Missing required env var: JWT_SECRET");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" },
});
socket.init(io);

// Socket connections must present the same JWT the REST API uses. This
// stops strangers from opening a socket and guessing scan ids to watch
// someone else's live progress.
io.use((sock, next) => {
  try {
    const token = sock.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    sock.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (sock) => {
  // Every authenticated socket auto-joins its own user room. This lets the
  // backend broadcast account-wide events (e.g. "a scan finished, refresh
  // your dashboard") without the client having to know a scanId up front —
  // unlike `scan:<id>` rooms, which only the page that started that scan
  // can subscribe to.
  sock.join(`user:${sock.userId}`);

  sock.on("scan:subscribe", async (scanId) => {
    // only join the room if this socket's user actually owns the scan
    const scan = await Scan.findById(scanId).catch(() => null);
    if (scan && scan.ownerId === sock.userId) {
      sock.join(`scan:${scanId}`);
    }
  });
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(compression());
app.use(express.json({ limit: "100kb" })); // scan/schedule payloads are tiny; cap body size
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api", generalLimiter);

// health probe fail with 401 instead of reporting real DB status.
app.get("/api/health", async (req, res) => {
  const dbOk = await db
    .query("SELECT 1")
    .then(() => true)
    .catch(() => false);
  res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk ? "up" : "down" });
});

app.use("/api", authRoutes);
app.use("/api", scanRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", keysRoutes); // final paths: /api/keys, /api/keys/dashboard, /api/keys/:id, ...
// Public API — its own auth scheme (x-api-key, not JWT), so it's mounted
// separately rather than behind any of the requireAuth-gated routers above.
app.use("/api", publicApiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let httpServer;
db.query("SELECT 1")
  .then(async () => {
    console.log(`[db] PostgreSQL connected (${process.env.DATABASE_URL.includes("-pooler") ? "pooled" : "direct"})`);
    await initCronJobs();
    httpServer = server.listen(PORT, () => console.log(`[server] Sentinel AI backend running on :${PORT}`));
  })
  .catch((err) => {
    console.error("[db] PostgreSQL connection failed:", err.message);
    process.exit(1);
  });

process.on("unhandledRejection", (err) => {
  console.error("[fatal] Unhandled rejection:", err);
});

// Let in-flight requests/sockets drain and close the DB pool cleanly instead
// of dropping connections when the process is stopped (Docker, PM2, etc).
async function gracefulShutdown(signal) {
  console.log(`[server] ${signal} received, shutting down...`);
  try {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await db.end();
    console.log("[server] Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[server] Error during shutdown:", err);
    process.exit(1);
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
// redeploy trigger
