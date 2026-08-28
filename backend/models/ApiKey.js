// Place this file at: models/ApiKey.js
const crypto = require("crypto");
const db = require("../config/db");

// key_value (raw key) is intentionally NOT selected anywhere below — only
// the SHA-256 hash is stored/queried. key_prefix/key_last4 are kept purely
// for masked display in the dashboard (e.g. "sentinel_live_a1b2••••••••cd34").
const COLUMNS = `
  id, user_id AS "userId", name, key_prefix AS "keyPrefix", key_last4 AS "keyLast4", active,
  daily_limit, requests_today, requests_today_date,
  requests_month, requests_month_ym, total_requests,
  limit_exceeded_count, last_used_at,
  created_at AS "createdAt"
`;

function generateKey() {
  return `sentinel_live_${crypto.randomBytes(24).toString("hex")}`;
}

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Splits a freshly generated raw key into its storable (non-secret) parts. */
function keyParts(rawKey) {
  return {
    hash: hashKey(rawKey),
    prefix: rawKey.slice(0, 18), // "sentinel_live_" + first 4 hex chars
    last4: rawKey.slice(-4),
  };
}

async function create(userId, name) {
  const rawKey = generateKey();
  const { hash, prefix, last4 } = keyParts(rawKey);
  const { rows } = await db.query(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, key_last4)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [userId, name, hash, prefix, last4]
  );
  // rawKey is returned only here, once, for the caller to show the user.
  // It is never stored or logged.
  return { ...rows[0], rawKey };
}

async function findAllForUser(userId) {
  const { rows } = await db.queryWithRetry(
    `SELECT ${COLUMNS} FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function findByIdForUser(id, userId) {
  const { rows } = await db.queryWithRetry(
    `SELECT ${COLUMNS} FROM api_keys WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

/**
 * No user filter — used by the API-key auth middleware on incoming x-api-key
 * requests. Hashes the presented raw key and looks it up by hash, so the
 * raw key is never compared against or stored in the database.
 */
async function findByRawKey(rawKey) {
  const { rows } = await db.queryWithRetry(`SELECT ${COLUMNS} FROM api_keys WHERE key_hash = $1`, [hashKey(rawKey)]);
  return rows[0] || null;
}

async function remove(id, userId) {
  await db.query(`DELETE FROM api_keys WHERE id = $1 AND user_id = $2`, [id, userId]);
}

async function toggleActive(id, userId) {
  const { rows } = await db.query(
    `UPDATE api_keys SET active = NOT active WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, userId]
  );
  return rows[0] || null;
}

async function regenerate(id, userId) {
  const rawKey = generateKey();
  const { hash, prefix, last4 } = keyParts(rawKey);
  const { rows } = await db.query(
    `UPDATE api_keys SET key_hash = $1, key_prefix = $2, key_last4 = $3, limit_exceeded_count = 0, active = true
     WHERE id = $4 AND user_id = $5 RETURNING ${COLUMNS}`,
    [hash, prefix, last4, id, userId]
  );
  if (!rows[0]) return null;
  // rawKey is returned only here, once, for the caller to show the user.
  return { ...rows[0], rawKey };
}

/**
 * Rolls the daily/monthly counters over on date change, increments them,
 * and stamps last_used_at + total_requests (mirrors the rollover logic
 * middleware/apiKeyAuth.js already does against the real schema).
 */
async function recordUsage(id) {
  const { rows } = await db.query(
    `UPDATE api_keys SET
       requests_today = CASE WHEN requests_today_date = CURRENT_DATE THEN requests_today + 1 ELSE 1 END,
       requests_today_date = CURRENT_DATE,
       requests_month = CASE WHEN requests_month_ym = to_char(CURRENT_DATE, 'YYYY-MM') THEN requests_month + 1 ELSE 1 END,
       requests_month_ym = to_char(CURRENT_DATE, 'YYYY-MM'),
       total_requests = total_requests + 1,
       last_used_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function recordLimitHit(id) {
  const { rows } = await db.query(
    `UPDATE api_keys SET
       limit_exceeded_count = limit_exceeded_count + 1,
       active = CASE WHEN limit_exceeded_count + 1 >= 5 THEN false ELSE active END
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function resetLimitHits(id) {
  const { rows } = await db.query(
    `UPDATE api_keys SET limit_exceeded_count = 0 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id]
  );
  return rows[0];
}

/** Records one public-API call's outcome. Matches routes/publicApi.js's existing insert shape. */
async function logRequest(keyId, userId, target, success, responseTimeMs) {
  await db.query(
    `INSERT INTO api_request_logs (key_id, user_id, target, success, response_time_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [keyId, userId, target || null, success, responseTimeMs]
  );
}

async function dashboardStats(userId) {
  const { rows } = await db.query(
    `SELECT
        COUNT(*) FILTER (WHERE active)::int AS "activeKeys",
        COALESCE(SUM(requests_today) FILTER (WHERE requests_today_date = CURRENT_DATE), 0)::int AS "requestsToday",
        COALESCE(SUM(daily_limit) FILTER (WHERE active), 0)::int AS "dailyLimit"
     FROM api_keys WHERE user_id = $1`,
    [userId]
  );

  // Last 30 days of public-API traffic across all of this user's keys.
  const { rows: logRows } = await db.query(
    `SELECT
        COUNT(*)::int AS "totalRequests",
        COUNT(*) FILTER (WHERE success)::int AS "successfulRequests",
        AVG(response_time_ms) AS "avgResponseMs"
     FROM api_request_logs
     WHERE user_id = $1 AND created_at >= now() - INTERVAL '30 days'`,
    [userId]
  );
  const log = logRows[0];

  return {
    ...rows[0],
    // null (not 0) when there's no traffic yet — "no data" and "0% success"
    successRate:
      log.totalRequests > 0 ? Math.round((log.successfulRequests / log.totalRequests) * 1000) / 10 : null,
  };
}

module.exports = {
  create,
  findAllForUser,
  findByIdForUser,
  findByRawKey,
  remove,
  toggleActive,
  regenerate,
  recordUsage,
  recordLimitHit,
  resetLimitHits,
  logRequest,
  dashboardStats,
};
