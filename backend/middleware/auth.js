// Place this file at: middleware/auth.js
const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const { unauthorized, forbidden } = require("../utils/errors");

/** Requires a valid `Authorization: Bearer <token>` header. Sets req.user. */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return next(unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }

  // Real-time revoke check — skipped only for tokens issued before this
  // change went out (no `sid` in payload), so old tokens don't break.
  if (payload.sid) {
    const active = await Session.isActive(payload.sid, payload.sub);
    if (!active) return next(unauthorized("Session revoked"));
  }

  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  req.sessionId = payload.sid;
  next();
}

/** Use after requireAuth to restrict a route to admins. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return next(forbidden("Admin access required"));
  next();
}

module.exports = { requireAuth, requireAdmin };
