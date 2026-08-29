// Place this file at: models/Scan.js
const db = require("../config/db");

const SCAN_COLUMNS = `
  id, target, owner_id AS "ownerId", status,
  ssl, headers, dns, whois, geo, ports, cves,
  robots, sitemap, directory, security_txt AS "securityTxt", technology,
  findings, recommendations,
  category_breakdown AS "categoryBreakdown", score_explanation AS "scoreExplanation",
  risk_score AS "riskScore", security_score AS "securityScore", grade,
  ai_analysis AS "aiAnalysis",
  error, started_at AS "startedAt", completed_at AS "completedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

// node-postgres auto-JSON-encodes plain objects for jsonb columns, but for
// a plain JS *array* (findings/recommendations) it instead formats a
// Postgres array literal ("{...}") unless we stringify it ourselves first —
// that would silently corrupt the column. Stringifying every jsonb value
// explicitly here sidesteps that pitfall entirely instead of relying on
// which implicit behavior applies to which shape.
function toJsonb(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

async function create({ target, ownerId }) {
  const { rows } = await db.query(
    `INSERT INTO scans (target, owner_id, status)
     VALUES ($1, $2, 'running')
     RETURNING ${SCAN_COLUMNS}`,
    [target, ownerId]
  );
  return rows[0];
}

/**
 * Persists a finished pipeline run.
 * @param {object} raw - { ssl, headers, dns, whois, geo, ports, cves, robots, sitemap, directory, securityTxt }
 */
async function completeScan(
  id,
  { raw, findings, recommendations, riskScore, securityScore, grade, categoryBreakdown, scoreExplanation, aiAnalysis }
) {
  const { rows } = await db.query(
    `UPDATE scans SET
       ssl = $1, headers = $2, dns = $3, whois = $4, geo = $5, ports = $6, cves = $7,
       robots = $8, sitemap = $9, directory = $10, security_txt = $11, technology = $12,
       findings = $13, recommendations = $14,
       category_breakdown = $15, score_explanation = $16,
       risk_score = $17, security_score = $18, grade = $19,
       ai_analysis = $20,
       status = 'completed', completed_at = now()
     WHERE id = $21
     RETURNING ${SCAN_COLUMNS}`,
    [
      toJsonb(raw.ssl),
      toJsonb(raw.headers),
      toJsonb(raw.dns),
      toJsonb(raw.whois),
      toJsonb(raw.geo),
      toJsonb(raw.ports),
      toJsonb(raw.cves),
      toJsonb(raw.robots),
      toJsonb(raw.sitemap),
      toJsonb(raw.directory),
      toJsonb(raw.securityTxt),
      toJsonb(raw.technology),
      toJsonb(findings),
      toJsonb(recommendations),
      toJsonb(categoryBreakdown),
      toJsonb(scoreExplanation),
      riskScore,
      securityScore,
      grade,
      aiAnalysis || null,
      id,
    ]
  );
  return rows[0];
}

async function markFailed(id, errorMessage) {
  await db.query(`UPDATE scans SET status = 'failed', error = $1 WHERE id = $2`, [errorMessage, id]);
}

/** No owner filter — used internally (e.g. socket-room auth checks ownership itself). */
async function findById(id) {
  const { rows } = await db.queryWithRetry(`SELECT ${SCAN_COLUMNS} FROM scans WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findByIdForOwner(id, ownerId) {
  const { rows } = await db.queryWithRetry(`SELECT ${SCAN_COLUMNS} FROM scans WHERE id = $1 AND owner_id = $2`, [
    id,
    ownerId,
  ]);
  return rows[0] || null;
}

async function getHistory({ ownerId, target, limit, offset }) {
  const whereParams = [ownerId];
  let where = `owner_id = $1 AND status = 'completed'`;
  if (target) {
    whereParams.push(`%${target}%`);
    where += ` AND target ILIKE $${whereParams.length}`;
  }

  const itemsParams = [...whereParams, limit, offset];
  const [itemsResult, countResult] = await Promise.all([
    db.queryWithRetry(
      `SELECT id, target, security_score AS "securityScore", grade,
              risk_score AS "riskScore", created_at AS "createdAt", findings
       FROM scans WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
      itemsParams
    ),
    db.queryWithRetry(`SELECT COUNT(*)::int AS total FROM scans WHERE ${where}`, whereParams),
  ]);

  return { items: itemsResult.rows, total: countResult.rows[0].total };
}

/** Security scores for completed scans in [from, to). Pass `to` as null for an open-ended range. */
async function statsForOwnerRange(ownerId, from, to) {
  const params = [ownerId, from];
  let where = `owner_id = $1 AND status = 'completed' AND created_at >= $2`;
  if (to) {
    params.push(to);
    where += ` AND created_at < $${params.length}`;
  }
  const { rows } = await db.queryWithRetry(
    `SELECT security_score AS "securityScore" FROM scans WHERE ${where}`,
    params
  );
  return rows;
}

/**
 * All-time Average / Best (highest) / Worst (lowest) security score across
 * every completed scan the owner has ever run, plus how many scans that's
 * based on (so the caller can tell "no scans yet" apart from a real 0).
 */
async function scoreSummary(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT
        ROUND(AVG(security_score))::int AS "averageScore",
        MAX(security_score) AS "bestScore",
        MIN(security_score) AS "worstScore",
        COUNT(*)::int AS "totalScans"
     FROM scans
     WHERE owner_id = $1 AND status = 'completed'`,
    [ownerId]
  );
  return rows[0];
}

async function distinctTargetCount(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT COUNT(DISTINCT target)::int AS count FROM scans WHERE owner_id = $1`,
    [ownerId]
  );
  return rows[0].count;
}

/** Completed scans since `sinceDate` with at least one high/critical finding. */
async function activeThreatsCount(ownerId, sinceDate) {
  const { rows } = await db.queryWithRetry(
    `SELECT COUNT(*)::int AS count FROM scans
     WHERE owner_id = $1 AND status = 'completed' AND created_at >= $2
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(findings) elem
         WHERE elem->>'severity' IN ('high', 'critical')
       )`,
    [ownerId, sinceDate]
  );
  return rows[0].count;
}

/**
 * "Open Findings" — high/critical findings currently present, counted
 * from each target's *latest* completed scan only (DISTINCT ON), so
 * re-scanning the same target repeatedly doesn't inflate the count with
 * findings that were already counted in an earlier scan of that target.
 */
async function openFindingsCount(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT findings FROM (
       SELECT DISTINCT ON (target) target, findings
       FROM scans
       WHERE owner_id = $1 AND status = 'completed'
       ORDER BY target, created_at DESC
     ) latest`,
    [ownerId]
  );
  let count = 0;
  for (const row of rows) {
    const findings = row.findings || [];
    count += findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  }
  return count;
}

async function recentScans(ownerId, limit) {
  const { rows } = await db.queryWithRetry(
    `SELECT target, security_score AS "securityScore", findings, created_at AS "createdAt"
     FROM scans WHERE owner_id = $1 AND status = 'completed'
     ORDER BY created_at DESC LIMIT $2`,
    [ownerId, limit]
  );
  return rows;
}

async function queueCount() {
  const { rows } = await db.queryWithRetry(
    `SELECT COUNT(*)::int AS count FROM scans WHERE status IN ('queued', 'running')`
  );
  return rows[0].count;
}

/** How many of this owner's own scans are currently queued/running — used to cap concurrency. */
async function activeCountForOwner(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT COUNT(*)::int AS count FROM scans WHERE owner_id = $1 AND status IN ('queued', 'running')`,
    [ownerId]
  );
  return rows[0].count;
}

/** Status of the most recent N scans system-wide — feeds the "Scan Success" system-health metric. */
async function recentOutcomes(limit) {
  const { rows } = await db.queryWithRetry(
    `SELECT status FROM scans ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Every completed scan for this owner, oldest-first per target — the raw
 * material for the Security Trend chart. Walking each target's scans in
 * order lets the caller diff consecutive scans to see which high/critical
 * findings newly appeared vs. disappeared between them.
 */
async function findAllCompletedForTrend(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT id, target, created_at AS "createdAt", findings
     FROM scans WHERE owner_id = $1 AND status = 'completed'
     ORDER BY target, created_at ASC`,
    [ownerId]
  );
  return rows;
}

/**
 * Top findings across the owner's completed scans, worst severity first
 * then most recent — feeds the "AI Insights" card. Each row carries which
 * scan/target it came from so the UI can link back to that scan's detail.
 */
async function topFindings(ownerId, limit) {
  const { rows } = await db.queryWithRetry(
    `SELECT s.id AS "scanId", s.target, s.created_at AS "createdAt",
            elem->>'code' AS code,
            elem->>'title' AS title,
            elem->>'description' AS description,
            elem->>'severity' AS severity,
            elem->>'recommendation' AS recommendation
     FROM scans s, jsonb_array_elements(s.findings) elem
     WHERE s.owner_id = $1 AND s.status = 'completed'
     ORDER BY
       CASE elem->>'severity'
         WHEN 'critical' THEN 0
         WHEN 'high' THEN 1
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 3
         ELSE 4
       END,
       s.created_at DESC
     LIMIT $2`,
    [ownerId, limit]
  );
  return rows;
}

module.exports = {
  create,
  completeScan,
  markFailed,
  findById,
  findByIdForOwner,
  getHistory,
  statsForOwnerRange,
  scoreSummary,
  distinctTargetCount,
  activeThreatsCount,
  recentScans,
  queueCount,
  activeCountForOwner,
  recentOutcomes,
  findAllCompletedForTrend,
  openFindingsCount,
  topFindings,
};
