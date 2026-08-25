// Place this file at: routes/publicApiRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const requireApiKey = require("../middleware/apiKeyAuth");
const { publicScan } = require("../controllers/apiKeysController");

router.post("/v1/scan", requireApiKey, asyncHandler(publicScan));

module.exports = router;
