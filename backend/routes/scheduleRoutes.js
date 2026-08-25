// Place this file at: routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { createSchedule, listSchedules, deleteSchedule, toggleSchedule } = require("../controllers/scheduleController");

router.use(requireAuth);
router.post("/schedule", asyncHandler(createSchedule));
router.get("/schedule", asyncHandler(listSchedules));
router.delete("/schedule/:id", asyncHandler(deleteSchedule));
router.patch("/schedule/:id/toggle", asyncHandler(toggleSchedule));

module.exports = router;
