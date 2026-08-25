// Place this file at: models/Schedule.js
const db = require("../config/db");

const SCHEDULE_COLUMNS = `
  id, target, owner_id AS "ownerId", frequency, cron_expression AS "cronExpression",
  active, last_run_at AS "lastRunAt", next_run_at AS "nextRunAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

async function create({ target, ownerId, frequency, cronExpression, nextRunAt }) {
  const { rows } = await db.query(
    `INSERT INTO scheduled_scans (target, owner_id, frequency, cron_expression, next_run_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SCHEDULE_COLUMNS}`,
    [target, ownerId, frequency, cronExpression, nextRunAt]
  );
  return rows[0];
}

async function findAllActive() {
  const { rows } = await db.queryWithRetry(`SELECT ${SCHEDULE_COLUMNS} FROM scheduled_scans WHERE active = true`);
  return rows;
}

async function findAllForOwner(ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT ${SCHEDULE_COLUMNS} FROM scheduled_scans WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows;
}

async function findByIdForOwner(id, ownerId) {
  const { rows } = await db.queryWithRetry(
    `SELECT ${SCHEDULE_COLUMNS} FROM scheduled_scans WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  );
  return rows[0] || null;
}

/** Returns the deleted row's id, or null if nothing matched (wrong id or not owned by this user). */
async function deleteByIdForOwner(id, ownerId) {
  const { rows } = await db.query(`DELETE FROM scheduled_scans WHERE id = $1 AND owner_id = $2 RETURNING id`, [
    id,
    ownerId,
  ]);
  return rows[0] || null;
}

async function markRun(id) {
  await db.query(`UPDATE scheduled_scans SET last_run_at = now() WHERE id = $1`, [id]);
}

async function toggleActive(id, ownerId) {
  const { rows } = await db.query(
    `UPDATE scheduled_scans SET active = NOT active WHERE id = $1 AND owner_id = $2 RETURNING ${SCHEDULE_COLUMNS}`,
    [id, ownerId]
  );
  return rows[0] || null;
}

module.exports = {
  create,
  findAllActive,
  findAllForOwner,
  findByIdForOwner,
  deleteByIdForOwner,
  markRun,
  toggleActive,
};
