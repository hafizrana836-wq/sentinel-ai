// Place this file at: models/Session.js
const db = require("../config/db");
const COLUMNS = `id, user_id AS "userId", user_agent AS "userAgent", ip,
  created_at AS "createdAt", last_active_at AS "lastActiveAt"`;

async function create(userId, { userAgent, ip }) {
  const { rows } = await db.query(
    `INSERT INTO sessions (user_id, user_agent, ip) VALUES ($1, $2, $3) RETURNING id`,
    [userId, userAgent, ip]
  );
  return rows[0]; // { id }
}

async function findAllForUser(userId) {
  const { rows } = await db.queryWithRetry(
    `SELECT ${COLUMNS} FROM sessions WHERE user_id = $1 AND revoked = false ORDER BY last_active_at DESC`,
    [userId]
  );
  return rows;
}

async function revoke(id, userId) {
  await db.query(`UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2`, [id, userId]);
}

/** Used by middleware/auth.js on every request to check the token's session hasn't been revoked. */
async function isActive(id, userId) {
  const { rows } = await db.queryWithRetry(
    `SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2 AND revoked = false`,
    [id, userId]
  );
  return rows.length > 0;
}

module.exports = { create, findAllForUser, revoke, isActive };
