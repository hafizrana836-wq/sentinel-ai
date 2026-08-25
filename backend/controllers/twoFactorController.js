// Place this file at: controllers/twoFactorController.js
const jwt = require("jsonwebtoken");
const { authenticator } = require("otplib");
const qrcode = require("qrcode");
const User = require("../models/User");
const Session = require("../models/Session");
const { badRequest } = require("../utils/errors");

function signToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** POST /auth/2fa/setup — logged-in user starts 2FA setup */
async function setup2FA(req, res) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(req.user.email, "Sentinel AI", secret);
  await User.setTwoFactorSecret(req.user.id, secret);
  const qrCode = await qrcode.toDataURL(otpauth);
  res.json({ qrCode, secret }); // secret shown once, as manual-entry fallback
}

/** POST /auth/2fa/verify  { token } — confirms setup, flips twoFactorEnabled on */
async function verify2FA(req, res, next) {
  const { token } = req.body;
  if (!token) return next(badRequest("token is required"));
  const user = await User.findByIdWithTwoFactorSecret(req.user.id);
  if (!user?.twoFactorSecret) return next(badRequest("2FA setup not initiated"));

  // TEMPORARY DEBUG — remove once 2FA verification is confirmed working.
  console.log("DEBUG 2FA:", {
    received: token,
    secret: user.twoFactorSecret,
    expected: authenticator.generate(user.twoFactorSecret),
    serverTime: new Date().toISOString(),
  });

  if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
    return next(badRequest("Invalid code"));
  }
  await User.enableTwoFactor(req.user.id);
  res.json({ message: "2FA enabled" });
}

/** POST /auth/2fa/disable */
async function disable2FA(req, res) {
  await User.disableTwoFactor(req.user.id);
  res.json({ message: "2FA disabled" });
}

/** POST /auth/2fa/login-verify  { tempToken, token } — second step of login when 2FA is on */
async function loginVerify2FA(req, res, next) {
  const { tempToken, token } = req.body;
  if (!tempToken || !token) return next(badRequest("tempToken and token are required"));
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch {
    return next(badRequest("Login session expired, please log in again"));
  }
  if (!decoded.pending2FA) return next(badRequest("Invalid login session"));
  const user = await User.findByIdWithTwoFactorSecret(decoded.sub);
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return next(badRequest("2FA not enabled for this account"));
  }

  // TEMPORARY DEBUG — remove once login 2FA is confirmed working.
  console.log("DEBUG LOGIN 2FA:", {
    received: token,
    secret: user.twoFactorSecret,
    expected: authenticator.generate(user.twoFactorSecret),
    serverTime: new Date().toISOString(),
  });

  if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
    return next(badRequest("Invalid code"));
  }
  const fullUser = await User.findById(user.id);
  const session = await Session.create(user.id, {
    userAgent: req.headers["user-agent"] || null,
    ip: req.ip || req.connection?.remoteAddress || null,
  });
  res.json({ token: signToken(fullUser, session.id), user: publicUser(fullUser) });
}

module.exports = { setup2FA, verify2FA, disable2FA, loginVerify2FA };
