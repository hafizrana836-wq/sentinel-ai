// Place this file at: controllers/dashboardController.js
const { getStats, getRecentScans, getSystemHealth, getInsights, getActivityTrend } = require("../services/dashboardService");

/** GET /api/dashboard — stats grid + hero summary, scoped to the logged-in user */
async function getDashboard(req, res) {
  const stats = await getStats(req.user.id);
  res.json(stats);
}

/** GET /api/recent-scans */
async function getRecentScansHandler(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const scans = await getRecentScans(req.user.id, limit);
  res.json(scans);
}

/** GET /api/system-health */
async function getSystemHealthHandler(req, res) {
  const health = await getSystemHealth();
  res.json(health);
}

/** GET /api/insights — top findings across the account, for the AI Insights card */
async function getInsightsHandler(req, res) {
  const limit = Math.min(Number(req.query.limit) || 4, 20);
  const insights = await getInsights(req.user.id, limit);
  res.json(insights);
}

/** GET /api/activity-trend?range=7d|30d|90d — Security Trend chart data */
async function getActivityTrendHandler(req, res) {
  const rangeDays = { "7d": 7, "30d": 30, "90d": 90 };
  const days = rangeDays[req.query.range] || 7;
  const series = await getActivityTrend(req.user.id, days);
  res.json({ series });
}

module.exports = { getDashboard, getRecentScansHandler, getSystemHealthHandler, getInsightsHandler, getActivityTrendHandler };
