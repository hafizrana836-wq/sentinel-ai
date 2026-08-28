// Place this file at: controllers/scanController.js
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
const MAX_CONCURRENT_SCANS_PER_USER = 3;

async function startScan(req, res, next) {
  const { target } = req.body;

  let hostname, lookup;
  try {
    ({ hostname, lookup } = await validateTarget(target)); // throws on missing/malformed/private-IP targets
  } catch (err) {
    return next(badRequest(err.message));
  }

  const activeCount = await Scan.activeCountForOwner(req.user.id);
  if (activeCount >= MAX_CONCURRENT_SCANS_PER_USER) {
    return next(badRequest(`You already have ${activeCount} scans running. Wait for one to finish before starting another.`));
  }

  const scan = await Scan.create({ target: hostname, ownerId: req.user.id });

  // respond immediately with the scan id so the frontend can subscribe to
  // socket room `scan:<id>` and watch live progress; the actual work
  // continues after the response is sent.
  res.status(202).json({ scanId: scan.id, status: "running" });
  runScanPipeline(scan.id, hostname, scan.ownerId, lookup).catch((err) => console.error("[scan] pipeline failed:", err));
}

async function runScanPipeline(scanId, hostname, ownerId, lookup) {
  emitProgress(scanId, "Initializing", "running");
  const raw = {};
  // robots.js / sitemap.js / securitytxt.js / directory.js all build their
  // own URLs by string-concatenating onto this, so it needs the scheme —
  // unlike checkSSL/checkHeaders/etc., which take a bare hostname.
  const baseUrl = `https://${hostname}`;

  try {
    emitProgress(scanId, "Initializing", "done");

    emitProgress(scanId, "SSL", "running");
    raw.ssl = await checkSSL(hostname, lookup);
    emitProgress(scanId, "SSL", "done", { result: raw.ssl });

    emitProgress(scanId, "Headers", "running");
    raw.headers = await checkHeaders(hostname, lookup);
    raw.technology = detectTechnology(raw.headers?.rawHeaders || {});
    emitProgress(scanId, "Headers", "done", { result: raw.headers });

    emitProgress(scanId, "Ports", "running");
    raw.ports = await scanPorts(hostname, lookup);
    emitProgress(scanId, "Ports", "done", { result: raw.ports });

    // DNS/whois/geo run alongside CVE lookup — they don't block each other.
    // CVE lookup gets the full headers object (server + poweredBy banners)
    // AND the open ports (SSH/FTP/etc banners) so fingerprintService can
    // match against everything the scan actually observed, not just the
    // HTTP Server header.
    emitProgress(scanId, "CVEs", "running");
    const [dnsResult, whoisResult, geoResult, cveResult] = await Promise.all([
      checkDNS(hostname),
      checkWhois(hostname),
      checkGeo(hostname),
      checkCVEs(raw.headers, raw.ports?.open),
    ]);
    raw.dns = dnsResult;
    raw.whois = whoisResult;
    raw.geo = geoResult;
    raw.cves = cveResult;
    emitProgress(scanId, "CVEs", "done", { result: raw.cves });

    // Recon: robots.txt, sitemap.xml, security.txt, and a directory/path
    // exposure sweep. Independent of each other, so they run in parallel —
    // directory.js is the slow one here (loops sequentially over ~30 paths).
    emitProgress(scanId, "Recon", "running");
    const [robotsResult, sitemapResult, securityTxtResult, directoryResult] = await Promise.all([
      analyseRobots(baseUrl, lookup),
      analyseSitemap(baseUrl, lookup),
      analyseSecurityTxt(baseUrl, lookup),
      scanDirectories(baseUrl, lookup),
    ]);
    raw.robots = robotsResult;
    raw.sitemap = sitemapResult;
    raw.securityTxt = securityTxtResult;
    raw.directory = directoryResult;
    emitProgress(scanId, "Recon", "done", {
      result: { robots: raw.robots, sitemap: raw.sitemap, securityTxt: raw.securityTxt, directory: raw.directory },
    });

    emitProgress(scanId, "AI Analysis", "running");
    // `hostname` is passed through so riskEngine can attach the actual
    // scanned domain to SPF/DMARC evidence instead of leaving it null.
    const { findings, riskScore, securityScore, grade, scoringModel, categories, explanation } = computeRisk(
      raw,
      hostname
    );
    const recommendations = generateRecommendations(findings);

    // Findings Engine: merge each finding's recommendation directly onto it,
    // so the frontend gets one standardized object per finding (id, title,
    // severity, category, kind, evidence, recommendation) instead of having
    // to cross-reference two separate arrays by code.
    const recByCode = Object.fromEntries(recommendations.map((r) => [r.findingCode, r.message]));
    const enrichedFindings = findings.map((f) => ({
      id: f.code,
      ...f,
      recommendation: recByCode[f.code] || null,
    }));

    // Plain-English AI summary — built from the same securityScore/findings
    // the rest of the report uses, so it never drifts out of sync with them.
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
    });

    emitProgress(scanId, "AI Analysis", "complete", { scan });

    // Dashboard (or any other open tab) doesn't know this scanId and never
    // joined `scan:<id>`, so it needs its own account-wide signal to know
    // it's time to refetch stats/recent-scans.
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
  const { hostname, lookup } = await validateTarget(target);
  const scan = await Scan.create({ target: hostname, ownerId });
  await runScanPipeline(scan.id, hostname, ownerId, lookup);
  return scan.id;
}

/**
 * Fire-and-forget variant for the public API — returns as soon as the Scan
 * row exists, without waiting for the (often slow) pipeline to finish.
 * Callers should poll GET /api/v1/scan/:id for status/results.
 */
async function startScanAsync(target, ownerId) {
  const { hostname, lookup } = await validateTarget(target);
  const scan = await Scan.create({ target: hostname, ownerId });
  runScanPipeline(scan.id, hostname, ownerId, lookup).catch((err) => console.error("[scan] pipeline failed:", err));
  return scan;
}

module.exports = { startScan, getScan, downloadReport, getHistory, startScanInternal, startScanAsync };
