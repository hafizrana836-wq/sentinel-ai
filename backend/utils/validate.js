// Place this file at: utils/validate.js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Replaces mongoose.isValidObjectId(id) now that primary keys are UUIDs. */
function isValidUUID(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value);
}

/** Escapes a string for safe use inside a Postgres ILIKE/LIKE pattern. */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

module.exports = { isValidUUID, isValidEmail, escapeLike };
