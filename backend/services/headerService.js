// Place this file at: services/headerService.js
const https = require("https");

const REQUIRED_HEADERS = [
  { key: "content-security-policy", code: "MISSING_CSP", label: "Missing CSP" },
  { key: "strict-transport-security", code: "MISSING_HSTS", label: "Missing HSTS" },
  { key: "x-frame-options", code: "MISSING_XFO", label: "Missing X-Frame-Options" },
  { key: "x-content-type-options", code: "MISSING_XCTO", label: "Missing X-Content-Type-Options" },
  { key: "referrer-policy", code: "MISSING_REFERRER_POLICY", label: "Missing Referrer-Policy" },
];

function fetchHeaders(hostname, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const req = https.request(
      { host: hostname, path: "/", method: "GET", timeout: timeoutMs, rejectUnauthorized: false },
      (res) => {
        resolve({ statusCode: res.statusCode, headers: res.headers });
        res.resume(); // drain body, we only need headers
      }
    );
    req.on("error", (err) => resolve({ error: err.message, headers: {} }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ error: "timeout", headers: {} });
    });
    req.end();
  });
}

async function checkHeaders(hostname) {
  const { headers, error, statusCode } = await fetchHeaders(hostname);
  if (error) return { reachable: false, error, missing: [], rawHeaders: {} };

  const missing = REQUIRED_HEADERS.filter((h) => !headers[h.key]).map((h) => ({
    code: h.code,
    label: h.label,
  }));

  return {
    reachable: true,
    statusCode,
    server: headers["server"] || null,
    poweredBy: headers["x-powered-by"] || null, // can leak stack/version info
    present: REQUIRED_HEADERS.filter((h) => headers[h.key]).map((h) => h.label),
    missing,
    // Full raw response headers (Node gives these lowercase-keyed already) —
    // needed by services/technology.js, which fingerprints off headers like
    // content-encoding / x-http-version that aren't extracted individually above.
    rawHeaders: headers,
  };
}

module.exports = { checkHeaders };
