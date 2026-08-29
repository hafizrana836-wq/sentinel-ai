// Place this file at: services/emailService.js
const nodemailer = require("nodemailer");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

/**
 * Fires for a scan's owner only if they've opted in — "Critical vulnerability
 * found" (any critical-severity finding) and "High-risk scan" (any
 * critical/high finding) are separate toggles in Settings, so check both.
 */
async function sendCriticalAlert(scan, user) {
  if (!user?.email) return { sent: false, reason: "No owner email on file" };
  const prefs = user.notificationPrefs || {};

  const criticalOnly = (scan.findings || []).filter((f) => f.severity === "critical");
  const criticalOrHigh = (scan.findings || []).filter((f) => f.severity === "critical" || f.severity === "high");

  const wantsCritical = prefs.criticalFinding && criticalOnly.length > 0;
  const wantsHighRisk = prefs.highRiskScan && criticalOrHigh.length > 0;
  if (!wantsCritical && !wantsHighRisk) {
    return { sent: false, reason: "Not opted in, or no matching findings" };
  }

  const lines = criticalOrHigh.map((f) => `- [${f.severity.toUpperCase()}] ${f.label}`).join("\n");

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: `Sentinel AI: ${criticalOrHigh.length} critical/high issue(s) on ${scan.target}`,
      text: `Scan of ${scan.target} completed with security score ${scan.securityScore}.\n\nFindings:\n${lines}\n\nView the full report in your dashboard.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/** "Scheduled scan completed" preference — one email per finished scheduled run. */
async function sendScheduledCompleteAlert(user, scan) {
  if (!user?.email) return { sent: false, reason: "No owner email on file" };
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: `Sentinel AI: scheduled scan of ${scan.target} completed`,
      text: `Your scheduled scan of ${scan.target} has finished.\n\nSecurity score: ${scan.securityScore ?? "N/A"} (${scan.grade ?? "N/A"})\n\nView the full report in your dashboard.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/** "Weekly security summary" preference — one email per user per week, sent by the cron job. */
async function sendWeeklySummary(user, weekScans) {
  if (!user?.email) return { sent: false, reason: "No owner email on file" };
  if (!weekScans.length) return { sent: false, reason: "No completed scans this week" };

  const scores = weekScans.map((s) => s.securityScore).filter((s) => typeof s === "number");
  const avg = scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Sentinel AI: your weekly security summary",
      text: `This week you ran ${weekScans.length} scan(s)${avg !== null ? `, averaging a security score of ${avg}` : ""}.\n\nView your full scan history in your dashboard.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendCriticalAlert, sendScheduledCompleteAlert, sendWeeklySummary };
