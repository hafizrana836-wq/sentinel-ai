// Place this file at: utils/cronManager.js
const cron = require("node-cron");
const Schedule = require("../models/Schedule");
const Scan = require("../models/Scan");
const User = require("../models/User");
const { sendScheduledCompleteAlert, sendWeeklySummary } = require("../services/emailService");

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
      const scanId = await startScanInternal(schedule.target, schedule.ownerId);
      await Schedule.markRun(id);

      try {
        const owner = await User.findById(schedule.ownerId);
        if (owner?.notificationPrefs?.scheduledScanComplete) {
          const scan = await Scan.findById(scanId);
          if (scan) await sendScheduledCompleteAlert(owner, scan);
        }
      } catch (emailErr) {
        console.error(`[cron] scheduled-complete email failed for ${schedule.target}:`, emailErr.message);
      }
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

/** Every Monday 09:00 UTC — emails each opted-in user their past 7 days of scan activity. */
function registerWeeklySummaryJob() {
  cron.schedule("0 9 * * 1", async () => {
    console.log("[cron] Running weekly summary job");
    let users;
    try {
      users = await User.findAllWithNotificationPref("weeklySummary");
    } catch (err) {
      console.error("[cron] weekly summary: could not load opted-in users:", err.message);
      return;
    }

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const user of users) {
      try {
        const weekScans = await Scan.statsForOwnerRange(user.id, from);
        await sendWeeklySummary(user, weekScans);
      } catch (err) {
        console.error(`[cron] weekly summary failed for user ${user.id}:`, err.message);
      }
    }
    console.log(`[cron] Weekly summary: processed ${users.length} opted-in user(s)`);
  });
}

/** Call once at server boot — re-registers every active schedule from the DB. */
async function initCronJobs() {
  const schedules = await Schedule.findAllActive();
  for (const s of schedules) registerSchedule(s);
  console.log(`[cron] ${schedules.length} scheduled scan(s) loaded`);

  registerWeeklySummaryJob();
  console.log("[cron] Weekly summary job registered (Mondays 09:00 UTC)");
}

module.exports = { registerSchedule, unregisterSchedule, initCronJobs };
