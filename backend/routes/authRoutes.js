// Place this file at: routes/authRoutes.js
const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  changePassword,
  updateNotificationPrefs,
  updateScanProfile,
  deleteAccount,
  listSessions,
  revokeSession,
} = require("../controllers/authController");
const {
  setup2FA,
  verify2FA,
  disable2FA,
  loginVerify2FA,
} = require("../controllers/twoFactorController");

router.post("/auth/register", authLimiter, asyncHandler(register));
router.post("/auth/login", authLimiter, asyncHandler(login));
router.post("/auth/2fa/login-verify", authLimiter, asyncHandler(loginVerify2FA));
router.post("/auth/refresh", authLimiter, asyncHandler(refresh));
router.post("/auth/logout", requireAuth, asyncHandler(logout));
router.get("/auth/me", requireAuth, asyncHandler(me));
router.put("/auth/profile", requireAuth, asyncHandler(updateProfile));
router.put("/auth/password", requireAuth, asyncHandler(changePassword));
router.put("/auth/notifications", requireAuth, asyncHandler(updateNotificationPrefs));
router.put("/auth/scan-profile", requireAuth, asyncHandler(updateScanProfile));
router.delete("/auth/account", requireAuth, asyncHandler(deleteAccount));
router.get("/auth/sessions", requireAuth, asyncHandler(listSessions));
router.delete("/auth/sessions/:id", requireAuth, asyncHandler(revokeSession));
router.post("/auth/2fa/setup", requireAuth, asyncHandler(setup2FA));
router.post("/auth/2fa/verify", requireAuth, asyncHandler(verify2FA));
router.post("/auth/2fa/disable", requireAuth, asyncHandler(disable2FA));

module.exports = router;
