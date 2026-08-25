// Place this file at: routes/keysRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const {
  listKeys,
  keysDashboard,
  createKey,
  deleteKey,
  toggleKey,
  regenerateKey,
} = require("../controllers/apiKeysController");

router.use(requireAuth);
router.get("/keys", asyncHandler(listKeys));
router.get("/keys/dashboard", asyncHandler(keysDashboard));
router.post("/keys", asyncHandler(createKey));
router.delete("/keys/:id", asyncHandler(deleteKey));
router.patch("/keys/:id/toggle", asyncHandler(toggleKey));
router.patch("/keys/:id/regenerate", asyncHandler(regenerateKey));

module.exports = router;
