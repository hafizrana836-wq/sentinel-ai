// Place this file at: controllers/apiKeysController.js
const ApiKey = require("../models/ApiKey");
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
  const { rawKey, ...apiKey } = await ApiKey.create(req.user.id, name);
  // rawKey is only ever sent to the client this one time — the server never
  // stores or logs it again after this response.
  res.status(201).json({ apiKey: { ...apiKey, key: rawKey } });
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
  const result = await ApiKey.regenerate(req.params.id, req.user.id);
  if (!result) return next(badRequest("API key not found"));
  const { rawKey, ...apiKey } = result;
  res.json({ apiKey: { ...apiKey, key: rawKey } });
}

module.exports = { listKeys, keysDashboard, createKey, deleteKey, toggleKey, regenerateKey };
