// Place this file at: utils/cronManager.js
const cron = require("node-cron");
const Schedule = require("../models/Schedule");

const jobs = new Map(); // scheduleId -> cron task

function registerSchedule(schedule) {
  const id = schedule.id;

  // Guard: a row with a missing/invalid cron_expression (e.g. old rows
  // created before this column existed) must not crash the whole app —
  // node-cron throws synchronously if the pattern isn't a valid string.
  if (!schedule.cronExpression || typeof schedule.cronExpression !== "string") {
    console.warn(
      `[cron] Skipping schedule ${id} (${schedule.target}) — invalid/missing cron_expression`
    );
    return;
  }

  if (jobs.has(id)) jobs.get(id).stop();

  const task = cron.schedule(schedule.cronExpression, async () => {
    // lazy-require to avoid a circular dependency with scanController
    const { startScanInternal } = require("../controllers/scanController");
    console.log(`[cron] Running scheduled scan for ${schedule.target}`);
    try {
      await startScanInternal(schedule.target, schedule.ownerId);
      await Schedule.markRun(id);
    } catch (err) {
      console.error(`[cron] Scheduled scan failed for ${schedule.target}:`, err.message);
    }
  });

  jobs.set(id, task);
}

function unregisterSchedule(scheduleId) {
  const task = jobs.get(scheduleId);
  if (task) {
    task.stop();
    jobs.delete(scheduleId);
  }
}

/** Call once at server boot — re-registers every active schedule from the DB. */
async function initCronJobs() {
  const schedules = await Schedule.findAllActive();
  for (const s of schedules) registerSchedule(s);
  console.log(`[cron] ${schedules.length} scheduled scan(s) loaded`);
}

module.exports = { registerSchedule, unregisterSchedule, initCronJobs };
