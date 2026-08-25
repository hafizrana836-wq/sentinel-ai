// Place this file at: models/User.js
const db = require("../config/db");
const PUBLIC_COLUMNS = `id, name, email, role, company, timezone,
  two_factor_enabled AS "twoFactorEnabled",
  notification_prefs AS "notificationPrefs", scan_profile AS "scanProfile",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

async function create({ name, email, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash]
  );
  return rows[0];
}

/** Includes password_hash + twoFactorEnabled — use only for the login check. */
async function findByEmailWithPassword(email) {
  const { rows } = await db.queryWithRetry(
    `SELECT id, name, email, role, password_hash AS "passwordHash",
            two_factor_enabled AS "twoFactorEnabled",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findByIdWithPassword(id) {
  const { rows } = await db.queryWithRetry(
    `SELECT id, name, email, role, password_hash AS "passwordHash",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await db.queryWithRetry(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.queryWithRetry(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function updateProfile(id, { name, company, timezone }) {
  const { rows } = await db.query(
    `UPDATE users SET name = $1, company = $2, timezone = $3, updated_at = now()
     WHERE id = $4 RETURNING ${PUBLIC_COLUMNS}`,
    [name, company || null, timezone || "UTC", id]
  );
  return rows[0];
}

async function updatePassword(id, passwordHash) {
  await db.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [passwordHash, id]);
}

async function updateNotificationPrefs(id, prefs) {
  const { rows } = await db.query(
    `UPDATE users SET notification_prefs = $1, updated_at = now() WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [JSON.stringify(prefs), id]
  );
  return rows[0];
}

async function updateScanProfile(id, profile) {
  const { rows } = await db.query(
    `UPDATE users SET scan_profile = $1, updated_at = now() WHERE id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    [JSON.stringify(profile), id]
  );
  return rows[0];
}

async function deleteAccount(id) {
  await db.query(`DELETE FROM users WHERE id = $1`, [id]);
}

// --- 2FA ---

async function setTwoFactorSecret(id, secret) {
  await db.query(`UPDATE users SET two_factor_secret = $1, updated_at = now() WHERE id = $2`, [secret, id]);
}

async function enableTwoFactor(id) {
  const { rows } = await db.query(
    `UPDATE users SET two_factor_enabled = true, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function disableTwoFactor(id) {
  const { rows } = await db.query(
    `UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, updated_at = now() WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0];
}

/** Includes two_factor_secret — never return this to a client. */
async function findByIdWithTwoFactorSecret(id) {
  const { rows } = await db.queryWithRetry(
    `SELECT id, email, role, two_factor_enabled AS "twoFactorEnabled",
            two_factor_secret AS "twoFactorSecret"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  create,
  findByEmail,
  findByEmailWithPassword,
  findByIdWithPassword,
  findById,
  updateProfile,
  updatePassword,
  updateNotificationPrefs,
  updateScanProfile,
  deleteAccount,
  setTwoFactorSecret,
  enableTwoFactor,
  disableTwoFactor,
  findByIdWithTwoFactorSecret,
};
