// Place this file at: controllers/apiKeysController.js
const ApiKey = require("../models/ApiKey");
const Scan = require("../models/Scan");
const { startScanInternal } = require("./scanController");
const { validateTarget } = require("../utils/ssrfGuard");
const { badRequest } = require("../utils/errors");

/** GET /api/keys */
async function listKeys(req, res) {
  const keys = await ApiKey.findAllForUser(req.user.id);
  const withUsage = keys.map((k) => ({
    ...k,
    remaining_today: Math.max(0, k.daily_limit - k.requests_today),
  }));
  res.json({ keys: withUsage });
}

/** GET /api/keys/dashboard */
async function keysDashboard(req, res) {
  const stats = await ApiKey.dashboardStats(req.user.id);
  res.json({
    dashboard: {
      activeKeys: stats.activeKeys,
      requestsToday: stats.requestsToday,
      dailyLimit: stats.dailyLimit,
      // Neither of these is tracked anywhere yet (would need a request-log
      // table to compute per-request success/failure and latency) — honest
      // null rather than a made-up number.
      successRate: null,
      avgResponseSeconds: null,
    },
  });
}

/** POST /api/keys  { name } */
async function createKey(req, res, next) {
  const name = (req.body.name || "").trim();
  if (!name) return next(badRequest("name is required"));
  const apiKey = await ApiKey.create(req.user.id, name);
  res.status(201).json({ apiKey });
}

/** DELETE /api/keys/:id */
async function deleteKey(req, res) {
  await ApiKey.remove(req.params.id, req.user.id);
  res.status(204).end();
}

/** PATCH /api/keys/:id/toggle */
async function toggleKey(req, res, next) {
  const apiKey = await ApiKey.toggleActive(req.params.id, req.user.id);
  if (!apiKey) return next(badRequest("API key not found"));
  res.json({ apiKey });
}

/** PATCH /api/keys/:id/regenerate */
async function regenerateKey(req, res, next) {
  const apiKey = await ApiKey.regenerate(req.params.id, req.user.id);
  if (!apiKey) return next(badRequest("API key not found"));
  res.json({ apiKey });
}

/**
 * POST /api/v1/scan  { target }  — public API, authenticated via
 * middleware/apiKeyAuth.js (req.apiKey + req.user already set).
 * Runs the exact same pipeline as the dashboard scanner, but responds only
 * once the scan finishes (no socket — a plain API caller has no socket
 * connection) and shapes the response to match what ApiAccess.jsx's docs
 * already promise: { success, target, score, grade, risk, ssl, findings }.
 */
async function publicScan(req, res, next) {
  const { target } = req.body;
  let hostname;
  try {
    hostname = await validateTarget(target);
  } catch (err) {
    return next(badRequest(err.message));
  }

  await ApiKey.recordUsage(req.apiKey.id);

  let scanId;
  try {
    scanId = await startScanInternal(hostname, req.user.id);
  } catch (err) {
    return res.status(502).json({ success: false, error: "Scan failed to start" });
  }

  const scan = await Scan.findById(scanId);
  if (!scan || scan.status !== "completed") {
    return res.status(502).json({ success: false, error: "Scan did not complete" });
  }

  res.json({
    success: true,
    target: scan.target,
    score: scan.securityScore,
    grade: scan.grade,
    risk:
      scan.findings?.some((f) => f.severity === "critical" || f.severity === "high")
        ? "High"
        : scan.findings?.some((f) => f.severity === "medium")
        ? "Medium"
        : "Low",
    ssl: scan.ssl ? { valid: scan.ssl.valid, issuer: scan.ssl.issuer } : null,
    findings: scan.findings || [],
  });
}

module.exports = { listKeys, keysDashboard, createKey, deleteKey, toggleKey, regenerateKey, publicScan };
