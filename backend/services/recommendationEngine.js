// Maps finding.code -> human recommendation. One rule can map to several
// messages if needed (e.g. array), otherwise a single string.
const RECOMMENDATIONS = {
  SSL_INVALID: { message: "Renew or reissue your SSL certificate — it is invalid or untrusted", priority: "high" },
  SSL_EXPIRING_SOON: { message: "Renew SSL Certificate before it expires", priority: "high" },
  SSL_WEAK_PROTOCOL: { message: "Disable TLS 1.0/1.1 and enforce TLS 1.2+", priority: "high" },
  SSL_DEPRECATED_PROTOCOL_SUPPORTED: { message: "Disable TLS 1.0/1.1 support at the server config level, not just the default negotiated version", priority: "high" },
  SSL_WEAK_CIPHER: { message: "Remove weak cipher suites (RC4/DES/3DES/MD5/NULL/export-grade) from the TLS config", priority: "medium" },
  SSL_SHORT_KEY: { message: "Reissue the certificate with a stronger key (RSA 2048-bit minimum, or use ECDSA)", priority: "medium" },
  SSL_INCOMPLETE_CHAIN: { message: "Configure the server to send its full intermediate certificate chain, not just the leaf certificate", priority: "low" },
  PORT_21_OPEN: { message: "Disable FTP or replace it with SFTP/FTPS", priority: "high" },
  PORT_22_OPEN: { message: "Restrict SSH — limit port 22 to trusted IP ranges or a VPN", priority: "medium" },
  PORT_23_OPEN: { message: "Disable Telnet — it transmits credentials in plaintext", priority: "high" },
  PORT_3389_OPEN: { message: "Restrict RDP access to a VPN or bastion host", priority: "high" },
  DATABASE_PORT_OPEN: { message: "Move this database behind a private network/VPC — it should never accept connections directly from the internet", priority: "high" },
  RISKY_PORT_OPEN: { message: "Close or firewall unused service ports exposed to the internet", priority: "medium" },
  CRITICAL_CVE: { message: "Patch immediately — a critical CVE affects this asset", priority: "high" },
  HIGH_CVE: { message: "Schedule patching soon for the detected high-severity CVE", priority: "medium" },
  MISSING_CSP: { message: "Enable Content-Security-Policy", priority: "medium" },
  MISSING_HSTS: { message: "Enable Strict-Transport-Security (HSTS)", priority: "medium" },
  MISSING_XFO: { message: "Add X-Frame-Options to prevent clickjacking", priority: "low" },
  MISSING_XCTO: { message: "Add X-Content-Type-Options: nosniff", priority: "low" },
  MISSING_REFERRER_POLICY: { message: "Set a Referrer-Policy header", priority: "low" },
  NO_SPF: { message: "Add an SPF record to prevent email spoofing", priority: "low" },
  SPF_OVERLY_PERMISSIVE: { message: "Change the SPF record's 'all' qualifier from '+all' to '-all' or '~all'", priority: "medium" },
  SPF_TOO_MANY_LOOKUPS: { message: "Flatten or reduce SPF includes so the record stays under the 10-lookup limit", priority: "low" },
  NO_DMARC: { message: "Add a DMARC record to strengthen email authentication", priority: "low" },
  DMARC_WEAK_POLICY: { message: "Move DMARC policy from 'none' to 'quarantine' or 'reject' once monitoring confirms legitimate mail flows are covered", priority: "low" },
  CAA_MISSING: { message: "Add a CAA record to restrict which certificate authorities may issue certificates for this domain", priority: "low" },
  WILDCARD_DNS: { message: "Confirm the wildcard DNS record is intentional; remove it if not", priority: "low" },
  DOMAIN_EXPIRING_SOON: { message: "Renew your domain registration before it expires", priority: "medium" },
};

/**
 * @param {Array} findings - output of riskEngine.computeRisk().findings
 * @returns {Array<{ findingCode, message, priority }>}
 */
function generateRecommendations(findings) {
  const seen = new Set();
  const recs = [];
  for (const f of findings) {
    if (seen.has(f.code)) continue;
    const rec = RECOMMENDATIONS[f.code];
    if (!rec) continue;
    seen.add(f.code);
    recs.push({ findingCode: f.code, message: rec.message, priority: rec.priority });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

module.exports = { generateRecommendations };
