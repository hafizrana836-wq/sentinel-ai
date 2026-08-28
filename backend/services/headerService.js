// Place this file at: services/headerService.js
const https = require("https");
const { URL } = require("url");

const REQUIRED_HEADERS = [
  { key: "content-security-policy", code: "MISSING_CSP", label: "Missing CSP" },
  { key: "strict-transport-security", code: "MISSING_HSTS", label: "Missing HSTS" },
  { key: "x-frame-options", code: "MISSING_XFO", label: "Missing X-Frame-Options" },
  { key: "x-content-type-options", code: "MISSING_XCTO", label: "Missing X-Content-Type-Options" },
  { key: "referrer-policy", code: "MISSING_REFERRER_POLICY", label: "Missing Referrer-Policy" },
];

function fetchHeaders(hostname, timeoutMs = 8000, followRedirects = true, maxHops = 5) {
  return new Promise((resolve) => {
    function attempt(host, path, hopsLeft) {
      const req = https.request(
        { host, path, method: "GET", timeout: timeoutMs, rejectUnauthorized: false },
        (res) => {
          const isRedirect = [301, 302, 303, 307, 308].includes(res.statusCode);
          if (followRedirects && isRedirect && res.headers.location && hopsLeft > 0) {
            res.resume();
            try {
              const next = new URL(res.headers.location, `https://${host}${path}`);
              attempt(next.hostname, next.pathname + next.search, hopsLeft - 1);
            } catch {
              resolve({ statusCode: res.statusCode, headers: res.headers });
            }
            return;
          }
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
    }
    attempt(hostname, "/", maxHops);
  });
}

async function checkHeaders(hostname, followRedirects = true) {
  const { headers, error, statusCode } = await fetchHeaders(hostname, 8000, followRedirects);
  if (error) return { reachable: false, error, missing: [], rawHeaders: {} };
  const missing = REQUIRED_HEADERS.filter((h) => !headers[h.key]).map((h) => ({
    code: h.code,
    label: h.label,
  }));
  return {
    reachable: true,
    statusCode,
    server: headers["server"] || null,
    poweredBy: headers["x-powered-by"] || null,
    present: REQUIRED_HEADERS.filter((h) => headers[h.key]).map((h) => h.label),
    missing,
    rawHeaders: headers,
  };
}

module.exports = { checkHeaders };
