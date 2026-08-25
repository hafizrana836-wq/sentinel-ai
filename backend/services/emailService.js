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
 * Fires only for critical/high findings — don't spam the user's inbox
 * for every low-severity header nitpick.
 */
async function sendCriticalAlert(scan) {
  const critical = (scan.findings || []).filter((f) => f.severity === "critical" || f.severity === "high");
  if (!critical.length) return { sent: false, reason: "No critical/high findings" };
  if (!process.env.ALERT_EMAIL_TO) return { sent: false, reason: "ALERT_EMAIL_TO not configured" };

  const lines = critical.map((f) => `- [${f.severity.toUpperCase()}] ${f.label}`).join("\n");

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL_TO,
      subject: `Sentinel AI: ${critical.length} critical issue(s) on ${scan.target}`,
      text: `Scan of ${scan.target} completed with security score ${scan.securityScore}.\n\nCritical findings:\n${lines}\n\nView the full report in your dashboard.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendCriticalAlert };
