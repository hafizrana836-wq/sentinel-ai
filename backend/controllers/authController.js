// Place this file at: controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const { badRequest } = require("../utils/errors");
const { isValidEmail } = require("../utils/validate");

function signToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function signPending2FAToken(userId) {
  return jwt.sign({ sub: userId, pending2FA: true }, process.env.JWT_SECRET, { expiresIn: "5m" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function register(req, res, next) {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) return next(badRequest("name is required"));
  if (!email || !isValidEmail(email)) return next(badRequest("a valid email is required"));
  if (!password || password.length < 8) return next(badRequest("password must be at least 8 characters"));
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findByEmail(normalizedEmail);
  if (existing) return next(badRequest("An account with this email already exists"));
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

  const session = await Session.create(user.id, {
    userAgent: req.headers["user-agent"] || null,
    ip: req.ip || req.connection?.remoteAddress || null,
  });

  res.status(201).json({ token: signToken(user, session.id), user: publicUser(user) });
}

async function login(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) return next(badRequest("email and password are required"));
  const user = await User.findByEmailWithPassword(String(email).toLowerCase().trim());
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) return next(badRequest("Invalid email or password"));

  // 2FA on -> don't issue a real session/token yet
  if (user.twoFactorEnabled) {
    return res.json({ requires2FA: true, tempToken: signPending2FAToken(user.id) });
  }

  const session = await Session.create(user.id, {
    userAgent: req.headers["user-agent"] || null,
    ip: req.ip || req.connection?.remoteAddress || null,
  });

  res.json({ token: signToken(user, session.id), user: publicUser(user) });
}

async function me(req, res, next) {
  const user = await User.findById(req.user.id);
  if (!user) return next(badRequest("User no longer exists"));
  res.json(user);
}

async function updateProfile(req, res, next) {
  const { name, company, timezone } = req.body;
  if (!name || !name.trim()) return next(badRequest("name is required"));
  const user = await User.updateProfile(req.user.id, { name: name.trim(), company, timezone });
  res.json(user);
}

async function changePassword(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return next(badRequest("currentPassword and newPassword are required"));
  if (newPassword.length < 8) return next(badRequest("newPassword must be at least 8 characters"));

  const user = await User.findByIdWithPassword(req.user.id);
  if (!user) return next(badRequest("User no longer exists"));

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return next(badRequest("Current password is incorrect"));

  const newHash = await bcrypt.hash(newPassword, 12);
  await User.updatePassword(req.user.id, newHash);
  res.json({ message: "Password updated" });
}

async function updateNotificationPrefs(req, res) {
  const { criticalFinding, highRiskScan, scheduledScanComplete, weeklySummary } = req.body;
  const user = await User.updateNotificationPrefs(req.user.id, {
    criticalFinding: !!criticalFinding,
    highRiskScan: !!highRiskScan,
    scheduledScanComplete: !!scheduledScanComplete,
    weeklySummary: !!weeklySummary,
  });
  res.json(user);
}

async function updateScanProfile(req, res, next) {
  const { profile, checks, rateLimit, followRedirects, saveHistory } = req.body;
  if (!["quick", "standard", "deep"].includes(profile)) {
    return next(badRequest("profile must be one of: quick, standard, deep"));
  }
  const user = await User.updateScanProfile(req.user.id, {
    profile,
    checks: Array.isArray(checks) ? checks : [],
    rateLimit: rateLimit || "standard",
    followRedirects: followRedirects !== false,
    saveHistory: saveHistory !== false,
  });
  res.json(user);
}

async function deleteAccount(req, res) {
  await User.deleteAccount(req.user.id);
  res.status(204).end();
}

async function listSessions(req, res) {
  const sessions = await Session.findAllForUser(req.user.id);
  res.json({ sessions });
}

async function revokeSession(req, res) {
  await Session.revoke(req.params.id, req.user.id);
  res.status(204).end();
}

module.exports = {
  register,
  login,
  me,
  updateProfile,
  changePassword,
  updateNotificationPrefs,
  updateScanProfile,
  deleteAccount,
  listSessions,
  revokeSession,
};
