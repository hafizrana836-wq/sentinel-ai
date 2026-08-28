
// Place this file at: controllers/scanController.js
const User = require("../models/User");
const Scan = require("../models/Scan");
const { checkSSL } = require("../services/sslService");
const { checkHeaders } = require("../services/headerService");
const { checkDNS } = require("../services/dnsService");
const { checkWhois } = require("../services/whoisService");
const { checkGeo } = require("../services/geoService");
const { scanPorts } = require("../services/portScanner");
const { checkCVEs } = require("../services/cveService");
const analyseRobots = require("../services/robots");
const analyseSitemap = require("../services/sitemap");
const analyseSecurityTxt = require("../services/securitytxt");
const scanDirectories = require("../services/directory");
const detectTechnology = require("../services/technology");
const { computeRisk } = require("../services/riskEngine");
const { generateRecommendations } = require("../services/recommendationEngine");
const generateAIAnalysis = require("../services/aiAnalysis");
const { sendCriticalAlert } = require("../services/emailService");
const { generateScanReportPDF } = require("../services/reportService");
const { getIO } = require("../utils/socket");
const { validateTarget } = require("../utils/ssrfGuard");
const { badRequest } = require("../utils/errors");
const { isValidUUID } = require("../utils/validate");

function emitProgress(scanId, step, status, extra = {}) {
  try {
    getIO().to(`scan:${scanId}`).emit("scan:progress", { scanId, step, status, ...extra });
  } catch {
    /* socket.io not initialized (e.g. in tests) — ignore, DB is still the source of truth */
  }
}

// Account-wide event, separate from emitProgress()'s `scan:<id>` room —
// this reaches every socket the owner has open (e.g. a Dashboard tab that
// never subscribed to this specific scanId) so pages like Dashboard can
// refetch their stats/recent-scans as soon as a scan finishes.
function emitUserUpdate(ownerId, event, payload = {}) {
  try {
    getIO().to(`user:${ownerId}`).emit(event, payload);
  } catch {
    /* socket.io not initialized (e.g. in tests) — ignore */
  }
}

/** POST /api/scan  { target: "example.com" } */
async function startScan(req, res, next) {
  const { target } = req.body;

  let hostname;
  try {
    hostname = await validateTarget(target); // throws on missing/malformed/private-IP targets
  } catch (err) {
    return next(badRequest(err.message));
  }

  const scan = await Scan.create({ target: hostname, ownerId: req.user.id });

  // respond immediately with the scan id so the frontend can subscribe to
  // socket room `scan:<id>` and watch live progress; the actual work
  // continues after the response is sent.
  res.status(202).json({ scanId: scan.id, status: "running" });
  runScanPipeline(scan.id, hostname, scan.ownerId).catch((err) => console.error("[scan] pipeline failed:", err));
}

async function runScanPipeline(scanId, hostname, ownerId) {
  emitProgress(scanId, "Initializing", "running");
  const raw = {};
  const baseUrl = `https://${hostname}`;

  // Owner's saved scan preferences — falls back to "run everything" if
  // they've never touched Settings (scan_profile is nullable).
  const user = await User.findById(ownerId);
  const profile = user?.scanProfile || {};
  const checks =
    Array.isArray(profile.checks) && profile.checks.length
      ? profile.checks
      : ["SSL/TLS", "Security Headers", "DNS", "Ports", "CVE", "Directory Discovery"];
  const followRedirects = profile.followRedirects !== false;
  const saveHistory = profile.saveHistory !== false;
  const runCheck = (name) => checks.includes(name);

  try {
    emitProgress(scanId, "Initializing", "done");

    if (runCheck("SSL/TLS")) {
      emitProgress(scanId, "SSL", "running");
      raw.ssl = await checkSSL(hostname);
      emitProgress(scanId, "SSL", "done", { result: raw.ssl });
    } else {
      raw.ssl = null;
      emitProgress(scanId, "SSL", "skipped");
    }

    if (runCheck("Security Headers")) {
      emitProgress(scanId, "Headers", "running");
      raw.headers = await checkHeaders(hostname, followRedirects);
      raw.technology = detectTechnology(raw.headers?.rawHeaders || {});
      emitProgress(scanId, "Headers", "done", { result: raw.headers });
    } else {
      raw.headers = null;
      raw.technology = detectTechnology({});
      emitProgress(scanId, "Headers", "skipped");
    }

    if (runCheck("Ports")) {
      emitProgress(scanId, "Ports", "running");
      raw.ports = await scanPorts(hostname);
      emitProgress(scanId, "Ports", "done", { result: raw.ports });
    } else {
      raw.ports = null;
      emitProgress(scanId, "Ports", "skipped");
    }

    emitProgress(scanId, "CVEs", runCheck("CVE") ? "running" : "skipped");
    const [dnsResult, whoisResult, geoResult, cveResult] = await Promise.all([
      runCheck("DNS") ? checkDNS(hostname) : Promise.resolve(null),
      checkWhois(hostname),
      checkGeo(hostname),
      runCheck("CVE") ? checkCVEs(raw.headers, raw.ports?.open) : Promise.resolve(null),
    ]);
    raw.dns = dnsResult;
    raw.whois = whoisResult;
    raw.geo = geoResult;
    raw.cves = cveResult;
    if (runCheck("CVE")) emitProgress(scanId, "CVEs", "done", { result: raw.cves });

    emitProgress(scanId, "Recon", "running");
    const [robotsResult, sitemapResult, securityTxtResult, directoryResult] = await Promise.all([
      analyseRobots(baseUrl),
      analyseSitemap(baseUrl),
      analyseSecurityTxt(baseUrl),
      runCheck("Directory Discovery") ? scanDirectories(baseUrl, followRedirects) : Promise.resolve(null),
    ]);
    raw.robots = robotsResult;
    raw.sitemap = sitemapResult;
    raw.securityTxt = securityTxtResult;
    raw.directory = directoryResult;
    emitProgress(scanId, "Recon", "done", {
      result: { robots: raw.robots, sitemap: raw.sitemap, securityTxt: raw.securityTxt, directory: raw.directory },
    });

    emitProgress(scanId, "AI Analysis", "running");
    const { findings, riskScore, securityScore, grade, scoringModel, categories, explanation } = computeRisk(
      raw,
      hostname
    );
    const recommendations = generateRecommendations(findings);
    const recByCode = Object.fromEntries(recommendations.map((r) => [r.findingCode, r.message]));
    const enrichedFindings = findings.map((f) => ({
      id: f.code,
      ...f,
      recommendation: recByCode[f.code] || null,
    }));

    const aiAnalysis = generateAIAnalysis({
      securityScore,
      ssl: raw.ssl,
      robots: raw.robots,
      sitemap: raw.sitemap,
      securityTxt: raw.securityTxt,
      directory: raw.directory,
      findings: enrichedFindings,
    });

    emitProgress(scanId, "AI Analysis", "done");

    const scan = await Scan.completeScan(scanId, {
      raw,
      findings: enrichedFindings,
      recommendations,
      riskScore,
      securityScore,
      grade,
      scoringModel,
      categoryBreakdown: categories,
      scoreExplanation: explanation,
      aiAnalysis,
      keepInHistory: saveHistory,
    });

    emitProgress(scanId, "AI Analysis", "complete", { scan });
    emitUserUpdate(ownerId, "scan:completed", { scanId, target: scan.target });
    await sendCriticalAlert(scan);
  } catch (err) {
    await Scan.markFailed(scanId, err.message);
    emitProgress(scanId, "Error", "failed", { error: err.message });
  }
}

/** GET /api/scan/:id */
async function getScan(req, res, next) {
  if (!isValidUUID(req.params.id)) return next(badRequest("Invalid scan id"));

  const scan = await Scan.findByIdForOwner(req.params.id, req.user.id);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  res.json(scan);
}

/** GET /api/scan/:id/report — streams a PDF */
async function downloadReport(req, res, next) {
  if (!isValidUUID(req.params.id)) return next(badRequest("Invalid scan id"));

  const scan = await Scan.findByIdForOwner(req.params.id, req.user.id);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  if (scan.status !== "completed") return next(badRequest("Scan not completed yet"));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="sentinel-report-${scan.target}.pdf"`);
  generateScanReportPDF(scan, res);
}

/** GET /api/history?limit=&page=&target= — full scan history, DB-backed, scoped to the caller */
async function getHistory(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const { items, total } = await Scan.getHistory({
    ownerId: req.user.id,
    target: req.query.target || null,
    limit,
    offset: (page - 1) * limit,
  });

  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}

/** Used by the cron manager — same pipeline and same SSRF guard, no req/res involved. */
async function startScanInternal(target, ownerId) {
  const hostname = await validateTarget(target);
  const scan = await Scan.create({ target: hostname, ownerId });
  await runScanPipeline(scan.id, hostname, ownerId);
  return scan.id;
}

module.exports = { startScan, getScan, downloadReport, getHistory, startScanInternal };
