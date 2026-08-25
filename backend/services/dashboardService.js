// Place this file at: services/dashboardService.js
const os = require("os");
const fs = require("fs");
const pool = require("../config/db");
const Scan = require("../models/Scan");

/**
 * Stats grid: Average / Latest / Best / Worst security score, plus
 * Open Findings, Assets Monitored, Total Scans.
 * Scoped to `ownerId` — one user should never see another user's assets.
 */
async function getStats(ownerId) {
  const [summary, latest, distinctCount, openFindings] = await Promise.all([
    Scan.scoreSummary(ownerId),          // all-time average/best/worst
    Scan.recentScans(ownerId, 1),        // most recent completed scan
    Scan.distinctTargetCount(ownerId),
    Scan.openFindingsCount(ownerId),     // high/critical findings in each target's latest scan
  ]);

  const hasScans = summary.totalScans > 0;
  const latestScan = latest[0] || null;

  return {
    averageScore: hasScans ? summary.averageScore : null,
    bestScore: hasScans ? summary.bestScore : null,
    worstScore: hasScans ? summary.worstScore : null,
    latestScore: latestScan ? latestScan.securityScore : null,
    latestTarget: latestScan ? latestScan.target : null,
    latestScanId: latestScan ? latestScan.id : null,
    lastScanAt: latestScan ? latestScan.createdAt : null,
    totalScans: summary.totalScans,
    openFindings,
    assetsMonitored: distinctCount,
  };
}

/** Recent Scans table, scoped to `ownerId` */
async function getRecentScans(ownerId, limit = 10) {
  const scans = await Scan.recentScans(ownerId, limit);
  return scans.map((s) => ({
    target: s.target,
    score: s.securityScore,
    risk: riskLabel(s.findings),
    time: s.createdAt,
  }));
}

function riskLabel(findings = []) {
  if (findings.some((f) => f.severity === "critical" || f.severity === "high")) return "High";
  if (findings.some((f) => f.severity === "medium")) return "Medium";
  return "Low";
}

/**
 * System health is an operational concern (server CPU/memory/queue depth),
 * not per-user scan data, so it isn't scoped to a specific owner — but the
 * route itself still requires auth so only logged-in users can see it.
 *
 * cpu: real host metric, sampled over a 500ms window (see measureCpuPercent).
 * memory: real, but process-level (this Node app's own RSS footprint) —
 *   NOT whole-machine memory. os.freemem()/os.totalmem() would reflect every
 *   other program running on the box, which is noisy and not actually what
 *   "system health" should mean here.
 * storage: real disk usage via fs.statfs — null if unsupported on this
 *   platform/Node version, rather than a fabricated number.
 * api/database/scanner: status items ("operational"/"degraded"/"down"),
 *   not raw percentages — a percentage implies false precision for things
 *   that are really just "up or having trouble". database carries its real
 *   round-trip latency in ms; scanner carries its real success rate.
 *
 * The whole payload is cached briefly (HEALTH_CACHE_MS) so a rapid page
 * refresh doesn't re-sample CPU (500ms) and re-hit the DB every time —
 * that's also what was making the numbers look like they jumped around
 * on every reload.
 */
let cachedHealth = null;
let cachedHealthAt = 0;
const HEALTH_CACHE_MS = 8000;

function statusFromScore(score) {
  return score >= 70 ? "operational" : score >= 40 ? "degraded" : "down";
}

async function getSystemHealth() {
  const now = Date.now();
  if (cachedHealth && now - cachedHealthAt < HEALTH_CACHE_MS) {
    return cachedHealth;
  }

  const cpu = await measureCpuPercent();

  // NOTE: an earlier version compared this process's own RSS against total
  // system memory (mem.rss / os.totalmem()) — a single Node process is a
  // tiny fraction of total system RAM on any modern machine, so that always
  // rounded to 0%. System-wide usage is both correct and more meaningful
  // for a "System Health" panel anyway (how loaded is the machine, not
  // just this one process).
  const memory = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);

  let storage = null;
  try {
    const target = process.platform === "win32" ? "C:\\" : "/";
    const stats = await fs.promises.statfs(target);
    storage = Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100);
  } catch {
    /* statfs unsupported on this platform/Node version — leave null rather than fake it */
  }

  let databaseScore = 0;
  let databaseLatencyMs = null;
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    databaseLatencyMs = Date.now() - start;
    databaseScore = databaseLatencyMs < 50 ? 100 : databaseLatencyMs < 150 ? 90 : databaseLatencyMs < 400 ? 70 : databaseLatencyMs < 1000 ? 40 : 15;
  } catch {
    databaseScore = 0;
  }

  const recentScans = await Scan.recentOutcomes(20);
  const scanSuccessRate = recentScans.length
    ? Math.round((recentScans.filter((r) => r.status === "completed").length / recentScans.length) * 100)
    : null;

  cachedHealth = {
    api: { status: "operational" }, // if this endpoint responded at all, the API is up
    database: { status: statusFromScore(databaseScore), latencyMs: databaseLatencyMs },
    scanner: { status: scanSuccessRate === null ? "operational" : statusFromScore(scanSuccessRate), successRate: scanSuccessRate },
    cpu,
    memory,
    storage,
    queue: await Scan.queueCount(), // raw count, not a percentage
  };
  cachedHealthAt = now;
  return cachedHealth;
}

/**
 * Samples CPU busy-vs-idle time twice, 500ms apart, and computes the delta.
 * (Widened from an earlier 150ms window — that was short enough that any
 * brief spike from another process on the machine could swing the reading
 * by 30-40 points between requests.)
 * os.loadavg() always returns [0,0,0] on Windows, so this double-sampling
 * approach is used instead — it works cross-platform.
 */
function measureCpuPercent() {
  return new Promise((resolve) => {
    const start = os.cpus();
    setTimeout(() => {
      const end = os.cpus();
      let idleDiff = 0;
      let totalDiff = 0;
      for (let i = 0; i < start.length; i++) {
        const s = start[i].times;
        const e = end[i].times;
        const idle = e.idle - s.idle;
        const total = e.user - s.user + (e.nice - s.nice) + (e.sys - s.sys) + (e.irq - s.irq) + idle;
        idleDiff += idle;
        totalDiff += total;
      }
      resolve(totalDiff > 0 ? Math.round(100 - (idleDiff / totalDiff) * 100) : 0);
    }, 500);
  });
}

const SEVERITY_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

/**
 * AI Insights card: the account's highest-severity, most-recent findings
 * across all completed scans. The first result becomes the "featured"
 * item, the rest become the list below it.
 */
async function getInsights(ownerId, limit = 4) {
  const rows = await Scan.topFindings(ownerId, limit);
  if (rows.length === 0) {
    return { featured: null, insights: [] };
  }

  const [top, ...rest] = rows;
  const featured = {
    weight: `${SEVERITY_LABEL[top.severity] || "Unknown"} Risk`,
    title: top.title,
    detail: `${top.target}: ${top.description}`,
    scanId: top.scanId,
    target: top.target,
    code: top.code,
  };

  const insights = rest.map((f) => ({
    text: `${f.target}: ${f.title}`,
    weight: SEVERITY_LABEL[f.severity] || "Unknown",
    scanId: f.scanId,
    target: f.target,
    code: f.code,
  }));

  return { featured, insights };
}

/**
 * Security Trend chart data: for each of the last N days, how many
 * high/critical findings were "detected" (present in a scan completed
 * that day) vs. "resolved" (present in a target's previous scan but gone
 * by this one). Computed in JS after one query, rather than a single deep
 * SQL query, since diffing two jsonb arrays per consecutive scan pair is
 * much clearer as a loop than as SQL.
 */
async function getActivityTrend(ownerId, days) {
  const scans = await Scan.findAllCompletedForTrend(ownerId);

  // date (YYYY-MM-DD) -> { threats, resolved }
  const byDay = {};
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

  const isThreat = (f) => f.severity === "critical" || f.severity === "high";

  let prevTarget = null;
  let prevFindings = null;

  for (const scan of scans) {
    const key = dayKey(scan.createdAt);
    if (!byDay[key]) byDay[key] = { threats: 0, resolved: 0 };

    const findings = scan.findings || [];
    const threatCodes = new Set(findings.filter(isThreat).map((f) => f.code));
    byDay[key].threats += threatCodes.size;

    if (prevTarget === scan.target && prevFindings) {
      const prevThreatCodes = new Set(prevFindings.filter(isThreat).map((f) => f.code));
      let resolvedCount = 0;
      for (const code of prevThreatCodes) {
        if (!threatCodes.has(code)) resolvedCount += 1;
      }
      byDay[key].resolved += resolvedCount;
    }

    prevTarget = scan.target;
    prevFindings = findings;
  }

  // Build a fully-populated series for the last `days` days (today
  // inclusive), even for days with zero scans, so the chart always draws
  // a complete, correctly-labeled line instead of gaps.
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({
      date: key,
      threats: byDay[key]?.threats || 0,
      resolved: byDay[key]?.resolved || 0,
    });
  }

  return series;
}

module.exports = { getStats, getRecentScans, getSystemHealth, getInsights, getActivityTrend };
