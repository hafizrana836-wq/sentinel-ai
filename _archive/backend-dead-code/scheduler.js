const cron = require("node-cron");
const pool = require("../config/db");
const { scanWebsite } = require("./scanner");

function computeNextRun(frequency, fromDate = new Date()) {
    const next = new Date(fromDate);
    if (frequency === "daily") {
        next.setDate(next.getDate() + 1);
    } else if (frequency === "weekly") {
        next.setDate(next.getDate() + 7);
    } else if (frequency === "monthly") {
        next.setMonth(next.getMonth() + 1);
    } else {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

async function runDueScans() {
    try {
        const due = await pool.query(
            `SELECT * FROM scheduled_scans WHERE active = TRUE AND next_run <= NOW()`
        );

        for (const schedule of due.rows) {
            console.log(`⏰ Running scheduled scan for ${schedule.target}`);

            try {
                const result = await scanWebsite(schedule.target);

                if (result.success) {
                    await pool.query(
                        `INSERT INTO scan_history (user_id, target, score, grade, risk, report_data)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [schedule.user_id, result.target, result.score, result.grade, result.risk, JSON.stringify(result)]
                    );
                }

                const nextRun = computeNextRun(schedule.frequency, new Date());

                await pool.query(
                    `UPDATE scheduled_scans SET last_run = NOW(), next_run = $1 WHERE id = $2`,
                    [nextRun, schedule.id]
                );

                console.log(`✅ Scheduled scan completed for ${schedule.target}, next run: ${nextRun}`);
            }
            catch (scanError) {
                console.log(`❌ Scheduled scan failed for ${schedule.target}:`, scanError.message);
            }
        }
    }
    catch (error) {
        console.log("Scheduler check failed:", error.message);
    }
}

function startScheduler() {
    // Har 5 minute mein check karta hai koi scan due to nahi
    cron.schedule("*/5 * * * *", () => {
        runDueScans();
    });

    console.log("🕐 Scheduled scan checker started (runs every 5 minutes)");
}

module.exports = { startScheduler, computeNextRun };
