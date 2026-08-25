// Place this file at: routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const {
  getDashboard,
  getRecentScansHandler,
  getSystemHealthHandler,
  getInsightsHandler,
  getActivityTrendHandler,
} = require("../controllers/dashboardController");
router.use(requireAuth);
router.get("/dashboard", asyncHandler(getDashboard));
router.get("/recent-scans", asyncHandler(getRecentScansHandler));
router.get("/system-health", asyncHandler(getSystemHealthHandler));
router.get("/insights", asyncHandler(getInsightsHandler));
router.get("/activity-trend", asyncHandler(getActivityTrendHandler));
module.exports = router;
