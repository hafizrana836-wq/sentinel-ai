// Save this as: backend/check-files.js
// Run with: node check-files.js
const fs = require("fs");
const path = require("path");

const required = [
  "server.js",
  "package.json",
  "config/db.js",
  "models/User.js",
  "models/Scan.js",
  "models/Schedule.js",
  "controllers/authController.js",
  "controllers/scanController.js",
  "controllers/dashboardController.js",
  "controllers/scheduleController.js",
  "routes/authRoutes.js",
  "routes/scanRoutes.js",
  "routes/dashboardRoutes.js",
  "routes/scheduleRoutes.js",
  "middleware/auth.js",
  "middleware/asyncHandler.js",
  "middleware/errorHandler.js",
  "middleware/rateLimiter.js",
  "utils/ssrfGuard.js",
  "utils/socket.js",
  "utils/cronManager.js",
  "utils/errors.js",
  "utils/validate.js",
  "services/sslService.js",
  "services/headerService.js",
  "services/dnsService.js",
  "services/whoisService.js",
  "services/geoService.js",
  "services/portScanner.js",
  "services/cveService.js",
  "services/riskEngine.js",
  "services/recommendationEngine.js",
  "services/dashboardService.js",
  "services/reportService.js",
  "services/emailService.js",
];

console.log(`Checking ${required.length} files from: ${process.cwd()}\n`);

let missing = 0;
for (const rel of required) {
  const full = path.join(__dirname, rel);
  const ok = fs.existsSync(full);
  if (!ok) missing++;
  console.log(`${ok ? "✅" : "❌ MISSING"}  ${rel}`);
}

console.log(`\n${missing === 0 ? "✅ All files present." : `❌ ${missing} file(s) missing — see above.`}`);
