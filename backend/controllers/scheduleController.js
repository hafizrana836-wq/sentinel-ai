// Place this file at: controllers/scheduleController.js
const Schedule = require("../models/Schedule");
const { registerSchedule, unregisterSchedule } = require("../utils/cronManager");
const { validateTarget } = require("../utils/ssrfGuard");
const { badRequest } = require("../utils/errors");

const FREQUENCY_CRON = {
  hourly: "0 * * * *",
  daily: "0 3 * * *", // 3am server time
  weekly: "0 3 * * 1", // Monday 3am
};

// scheduled_scans.next_run_at is NOT NULL with no DB default, so it has to
// be computed here — this mirrors the FREQUENCY_CRON times above (3am
// daily, Monday 3am weekly, top of the next hour for hourly).
function computeNextRun(frequency) {
  const next = new Date();
  if (frequency === "hourly") {
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }
  if (frequency === "weekly") {
    next.setHours(3, 0, 0, 0);
    const daysUntilMonday = (1 - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilMonday);
    return next;
  }
  // daily
  next.setHours(3, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  return next;
}

// scheduled_scans.id is a plain integer (nextval sequence), not a UUID —
// isValidUUID() would reject every valid id here, so a simple numeric
// check is used instead.
function isValidScheduleId(id) {
  return /^\d+$/.test(String(id));
}

/** POST /api/schedule  { target, frequency } */
async function createSchedule(req, res, next) {
  const { target, frequency = "daily" } = req.body;
  if (!Object.keys(FREQUENCY_CRON).includes(frequency)) {
    return next(badRequest(`frequency must be one of: ${Object.keys(FREQUENCY_CRON).join(", ")}`));
  }

  let hostname;
  try {
    hostname = await validateTarget(target);
  } catch (err) {
    return next(badRequest(err.message));
  }

  const cronExpression = FREQUENCY_CRON[frequency];
  const nextRunAt = computeNextRun(frequency);
  const schedule = await Schedule.create({ target: hostname, ownerId: req.user.id, frequency, cronExpression, nextRunAt });
  registerSchedule(schedule);
  res.status(201).json(schedule);
}

/** GET /api/schedule */
async function listSchedules(req, res) {
  const schedules = await Schedule.findAllForOwner(req.user.id);
  res.json({ schedules });
}

/** DELETE /api/schedule/:id */
async function deleteSchedule(req, res, next) {
  if (!isValidScheduleId(req.params.id)) return next(badRequest("Invalid schedule id"));
  const deleted = await Schedule.deleteByIdForOwner(req.params.id, req.user.id);
  if (deleted) unregisterSchedule(deleted.id);
  res.json({ deleted: Boolean(deleted) });
}

/** PATCH /api/schedule/:id/toggle */
async function toggleSchedule(req, res, next) {
  if (!isValidScheduleId(req.params.id)) return next(badRequest("Invalid schedule id"));
  const schedule = await Schedule.toggleActive(req.params.id, req.user.id);
  if (!schedule) return next(badRequest("Schedule not found"));

  if (schedule.active) registerSchedule(schedule);
  else unregisterSchedule(schedule.id);

  res.json({ schedule });
}

module.exports = { createSchedule, listSchedules, deleteSchedule, toggleSchedule };
