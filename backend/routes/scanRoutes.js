// Place this file at: routes/scanRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { scanLimiter } = require("../middleware/rateLimiter");
const { startScan, getScan, downloadReport, getHistory } = require("../controllers/scanController");

router.use(requireAuth); // every route below requires a logged-in user

router.post("/scan", scanLimiter, asyncHandler(startScan));
router.get("/scan/:id", asyncHandler(getScan));
router.get("/scan/:id/report", asyncHandler(downloadReport));
router.get("/history", asyncHandler(getHistory));

module.exports = router;
