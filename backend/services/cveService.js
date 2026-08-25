// Place this file at: services/cveService.js
const axios = require("axios");
const { buildFingerprints, CONFIDENCE } = require("./fingerprintService");

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";

// NVD without an API key is slow and tightly rate-limited (5 req/30s vs
// 50 req/30s with a key — get a free one at https://nvd.nist.gov/developers/request-an-api-key
// and set NVD_API_KEY in your environment; this alone fixes most of the slowness).
const REQUEST_TIMEOUT_MS = 5000; // was 9000 — fail a single stuck lookup fast rather than hang
const OVERALL_BUDGET_MS = 8000;  // hard cap on the whole CVE step, regardless of how many fingerprints

const CONFIDENCE_RANK = { [CONFIDENCE.CONFIRMED]: 2, [CONFIDENCE.LIKELY]: 1 };

function nvdHeaders() {
  return process.env.NVD_API_KEY ? { apiKey: process.env.NVD_API_KEY } : {};
}

function mapVulnerability(v, fingerprint) {
  const cve = v.cve;
  const metric =
    cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0];

  return {
    id: cve.id,
    severity: metric?.cvssData?.baseSeverity || metric?.baseSeverity || "UNKNOWN",
    score: metric?.cvssData?.baseScore ?? null,
    summary: cve.descriptions?.find((d) => d.lang === "en")?.value?.slice(0, 200) || "",
    confidence: fingerprint.confidence,
    product: fingerprint.product,
    version: fingerprint.version,
    cpe: fingerprint.cpe,
    evidence: fingerprint.evidence,
  };
}

async function lookupByCPE(fingerprint) {
  try {
    const { data } = await axios.get(NVD_URL, {
      params: { cpeName: fingerprint.cpe, resultsPerPage: 10 },
      headers: nvdHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return (data.vulnerabilities || []).map((v) => mapVulnerability(v, fingerprint));
  } catch (err) {
    return [];
  }
}

// Caps the whole CVE step at OVERALL_BUDGET_MS. If it's not done by then,
// resolve with whatever fallback was given instead of leaving the scan
// hanging on one slow or rate-limited NVD request.
function withOverallBudget(promise, budgetMs, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true, value: fallback }), budgetMs);
  });
  return Promise.race([promise.then((value) => ({ timedOut: false, value })), timeout]).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * @param {object} headers - result of headerService.checkHeaders(), i.e. { server, poweredBy, ... }
 *                            (a bare string also still works for backward compatibility —
 *                            it's treated as the server banner with no poweredBy)
 * @param {Array} ports - optional, result of portScanner.scanPorts().open (each with a .banner)
 */
async function checkCVEs(headers, ports = []) {
  // Backward-compat: allow callers to still pass a plain banner string.
  const normalizedHeaders = typeof headers === "string" ? { server: headers, poweredBy: null } : headers || {};
  const serverBanner = normalizedHeaders.server || null;

  if (!serverBanner && !normalizedHeaders.poweredBy && (!ports || ports.length === 0)) {
    return { queried: false, results: [] };
  }

  const fingerprints = buildFingerprints(normalizedHeaders, ports);

  const confirmedOrLikely = fingerprints.filter(
    (f) => f.cpe && (f.confidence === CONFIDENCE.CONFIRMED || f.confidence === CONFIDENCE.LIKELY)
  );
  const insufficientEvidence = fingerprints.filter((f) => !f.cpe);

  if (confirmedOrLikely.length === 0) {
    return {
      queried: false,
      banner: serverBanner,
      results: [],
      potentialMatches: insufficientEvidence.map((f) => ({
        product: f.product,
        confidence: f.confidence,
        evidence: f.evidence,
        note:
          f.confidence === CONFIDENCE.INFORMATIONAL
            ? "Proprietary or unrecognized banner — no public CVE database entry to check against."
            : "Potential match — insufficient version evidence to query CVE data safely.",
      })),
    };
  }

  // Multiple sources (Server header, SSH/FTP/SMTP banners) can fingerprint to
  // the exact same product+version — dedupe by CPE before hitting NVD so we
  // don't pay for the same slow lookup more than once.
  const uniqueFingerprints = Object.values(
    confirmedOrLikely.reduce((acc, f) => {
      const existing = acc[f.cpe];
      if (!existing || CONFIDENCE_RANK[f.confidence] > CONFIDENCE_RANK[existing.confidence]) {
        acc[f.cpe] = f;
      }
      return acc;
    }, {})
  );

  try {
    const { timedOut, value: perFingerprint } = await withOverallBudget(
      Promise.all(uniqueFingerprints.map((f) => lookupByCPE(f))),
      OVERALL_BUDGET_MS,
      uniqueFingerprints.map(() => []) // budget hit — treat unfinished lookups as "nothing back yet"
    );

    const results = perFingerprint.flat();

    const unique = Object.values(
      results.reduce((acc, c) => {
        const existing = acc[c.id];
        if (
          !existing ||
          CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[existing.confidence] ||
          (c.score ?? 0) > (existing.score ?? 0)
        ) {
          acc[c.id] = c;
        }
        return acc;
      }, {})
    ).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      queried: true,
      banner: serverBanner,
      results: unique,
      partial: timedOut, // true = time budget hit before every fingerprint finished — results may be incomplete, not "clean"
      potentialMatches: insufficientEvidence.map((f) => ({
        product: f.product,
        confidence: f.confidence,
        evidence: f.evidence,
        note: "Potential match — insufficient version evidence to query CVE data safely.",
      })),
    };
  } catch (err) {
    return { queried: true, banner: serverBanner, results: [], error: err.message };
  }
}

module.exports = { checkCVEs };
