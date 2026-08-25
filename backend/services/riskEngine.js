// Place this file at: services/riskEngine.js
const RULES = {
  SSL_INVALID: {
    label: "SSL Invalid",
    description: "The SSL certificate is invalid, expired, or untrusted. Visitors will see browser security warnings.",
    weight: 25,
    severity: "critical",
    category: "SSL/TLS",
  },
  SSL_EXPIRING_SOON: {
    label: "SSL Expiring Soon",
    description: "The SSL certificate expires soon. Renew it before it lapses to avoid downtime and browser warnings.",
    weight: 10,
    severity: "medium",
    category: "SSL/TLS",
  },
  SSL_WEAK_PROTOCOL: {
    label: "Weak TLS Protocol Negotiated",
    description: "The connection negotiated an outdated TLS version (1.0/1.1). Disable them and enforce TLS 1.2+.",
    weight: 15,
    severity: "high",
    category: "SSL/TLS",
  },
  SSL_DEPRECATED_PROTOCOL_SUPPORTED: {
    label: "Deprecated TLS Version Still Accepted",
    description: "The server still accepts TLS 1.0/1.1 connections even though a stronger version was negotiated by default. A downgrade attack or misconfigured client could still use the weak version.",
    weight: 12,
    severity: "high",
    category: "SSL/TLS",
  },
  SSL_WEAK_CIPHER: {
    label: "Weak Cipher Suite",
    description: "The negotiated cipher suite uses a weak or deprecated algorithm (RC4/DES/3DES/MD5/NULL/export-grade).",
    weight: 8,
    severity: "medium",
    category: "SSL/TLS",
  },
  SSL_SHORT_KEY: {
    label: "Weak Key Size",
    description: "The certificate's public key is shorter than the recommended minimum (2048 bits for RSA).",
    weight: 8,
    severity: "medium",
    category: "SSL/TLS",
  },
  SSL_INCOMPLETE_CHAIN: {
    label: "Incomplete Certificate Chain",
    description: "The server only presented its leaf certificate, not the intermediate chain. Most browsers cache intermediates and won't notice, but some clients (and all automated checks) will fail.",
    weight: 5,
    severity: "low",
    category: "SSL/TLS",
  },
  PORT_21_OPEN: {
    label: "Port 21 (FTP) Open",
    description: "FTP transmits credentials in plaintext. Disable it or replace it with SFTP/FTPS.",
    weight: 18,
    severity: "high",
    category: "Network Exposure",
  },
  PORT_22_OPEN: {
    label: "Port 22 Open",
    description: "SSH (port 22) is reachable from the internet. Restrict it to trusted IP ranges or a VPN.",
    weight: 10,
    severity: "medium",
    category: "Network Exposure",
  },
  PORT_23_OPEN: {
    label: "Port 23 (Telnet) Open",
    description: "Telnet transmits credentials in plaintext and is considered obsolete/unsafe. Disable it entirely.",
    weight: 20,
    severity: "high",
    category: "Network Exposure",
  },
  PORT_3389_OPEN: {
    label: "Port 3389 (RDP) Open",
    description: "RDP is publicly reachable — a common ransomware entry point. Restrict it behind a VPN or bastion host.",
    weight: 15,
    severity: "high",
    category: "Network Exposure",
  },
  DATABASE_PORT_OPEN: {
    label: "Database Port Open to the Internet",
    description: "A database service (MySQL/PostgreSQL/Redis/MongoDB) is directly reachable from the internet. These should never be internet-facing — put them behind a VPC/firewall with no public ingress.",
    weight: 30,
    severity: "critical",
    category: "Network Exposure",
  },
  RISKY_PORT_OPEN: {
    label: "Risky Service Port Open",
    description: "A service port with known risk exposure is open to the internet. Close it or firewall it to trusted sources.",
    weight: 8,
    severity: "medium",
    category: "Network Exposure",
  },
  CRITICAL_CVE: {
    label: "Critical CVE",
    description: "A critical vulnerability affects a detected service on this asset. Patch immediately.",
    weight: 40,
    severity: "critical",
    category: "CVE Risk",
  },
  HIGH_CVE: {
    label: "High Severity CVE",
    description: "A high-severity vulnerability was found affecting a detected service. Schedule patching soon.",
    weight: 20,
    severity: "high",
    category: "CVE Risk",
  },
  MISSING_CSP: {
    label: "Missing CSP",
    description: "No Content-Security-Policy header was found. Add one to restrict which scripts, styles, and frames can load.",
    weight: 10,
    severity: "medium",
    category: "Security Headers",
  },
  MISSING_HSTS: {
    label: "Missing HSTS",
    description: "Strict-Transport-Security is missing, so browsers may still allow the site to load over plain HTTP.",
    weight: 8,
    severity: "medium",
    category: "Security Headers",
  },
  MISSING_XFO: {
    label: "Missing X-Frame-Options",
    description: "Without X-Frame-Options, the site can be embedded in an iframe on any domain, enabling clickjacking.",
    weight: 5,
    severity: "low",
    category: "Security Headers",
  },
  MISSING_XCTO: {
    label: "Missing X-Content-Type-Options",
    description: "Without nosniff, browsers may MIME-sniff responses in unexpected ways, opening the door to certain attacks.",
    weight: 5,
    severity: "low",
    category: "Security Headers",
  },
  MISSING_REFERRER_POLICY: {
    label: "Missing Referrer-Policy",
    description: "No Referrer-Policy is set, so full URLs (potentially containing sensitive data) may leak to third parties.",
    weight: 3,
    severity: "low",
    category: "Security Headers",
  },
  NO_SPF: {
    label: "No SPF Record",
    description: "Without an SPF record, attackers can more easily spoof emails that appear to come from this domain.",
    weight: 5,
    severity: "low",
    category: "DNS & Email",
  },
  SPF_OVERLY_PERMISSIVE: {
    label: "Overly Permissive SPF (+all)",
    description: "The SPF record ends in '+all', which allows ANY server to send mail as this domain — effectively disabling SPF protection.",
    weight: 8,
    severity: "medium",
    category: "DNS & Email",
  },
  SPF_TOO_MANY_LOOKUPS: {
    label: "SPF Exceeds Lookup Limit",
    description: "The SPF record requires more than 10 DNS lookups to evaluate, which exceeds RFC 7208's limit — mail servers may treat the whole record as a permanent error and skip SPF checking entirely.",
    weight: 4,
    severity: "low",
    category: "DNS & Email",
  },
  NO_DMARC: {
    label: "No DMARC Record",
    description: "Without DMARC, there's no policy telling mail servers what to do with spoofed messages from this domain.",
    weight: 5,
    severity: "low",
    category: "DNS & Email",
  },
  DMARC_WEAK_POLICY: {
    label: "DMARC Policy Set to 'none'",
    description: "DMARC is published but its policy is 'none', meaning spoofed mail is only monitored, not blocked or quarantined.",
    weight: 4,
    severity: "low",
    category: "DNS & Email",
  },
  CAA_MISSING: {
    label: "No CAA Record",
    description: "Without a CAA record, any publicly trusted certificate authority can issue certificates for this domain — a CAA record restricts issuance to authorized CAs only.",
    weight: 3,
    severity: "low",
    category: "DNS & Email",
  },
  WILDCARD_DNS: {
    label: "Wildcard DNS Detected",
    description: "A catch-all ('*') DNS record resolves any subdomain, even ones that don't exist. Confirm this is intentional — it can otherwise mask typos or enable subdomain-based phishing.",
    weight: 3,
    severity: "low",
    category: "DNS & Email",
  },
  DOMAIN_EXPIRING_SOON: {
    label: "Domain Expiring Soon",
    description: "The domain registration expires within 30 days. Renew it to avoid losing ownership.",
    weight: 8,
    severity: "medium",
    category: "DNS & Email",
  },
};

const CATEGORY_MAX = Object.values(RULES).reduce((acc, rule) => {
  acc[rule.category] = (acc[rule.category] || 0) + rule.weight;
  return acc;
}, {});
const ALL_CATEGORIES = [...Object.keys(CATEGORY_MAX), "Web Hygiene"];

function addFinding(findings, code, evidence) {
  const rule = RULES[code];
  if (!rule) return;
  findings.push({
    code,
    title: rule.label,
    label: rule.label,
    description: rule.description,
    weight: rule.weight,
    severity: rule.severity,
    category: rule.category,
    evidence: evidence || null,
  });
}

const DATABASE_PORTS = new Set([3306, 5432, 6379, 27017]);

/**
 * @param {object} raw - { ssl, headers, ports, cves, dns, whois }
 */
function computeRisk(raw) {
  const findings = [];

  // --- SSL ---
  if (raw.ssl) {
    if (!raw.ssl.valid) {
      addFinding(findings, "SSL_INVALID", {
        observed: { issuer: raw.ssl.issuer, subject: raw.ssl.subject, authError: raw.ssl.authError ?? null },
        note: "TLS handshake did not present a valid, trusted certificate.",
      });
    }
    if (raw.ssl.expiringSoon) {
      addFinding(findings, "SSL_EXPIRING_SOON", {
        observed: { validTo: raw.ssl.validTo, daysRemaining: raw.ssl.daysRemaining },
      });
    }
    if (raw.ssl.isWeakProtocol) {
      addFinding(findings, "SSL_WEAK_PROTOCOL", { observed: { protocol: raw.ssl.protocol } });
    }
    if (raw.ssl.deprecatedProtocolSupported) {
      addFinding(findings, "SSL_DEPRECATED_PROTOCOL_SUPPORTED", {
        observed: { supportedProtocols: raw.ssl.supportedProtocols },
      });
    }
    if (raw.ssl.isWeakCipher) {
      addFinding(findings, "SSL_WEAK_CIPHER", { observed: { cipher: raw.ssl.cipher } });
    }
    if (raw.ssl.keyBits && raw.ssl.keyBits < 2048) {
      addFinding(findings, "SSL_SHORT_KEY", {
        observed: { keyAlgorithm: raw.ssl.keyAlgorithm, keyBits: raw.ssl.keyBits },
      });
    }
    if (raw.ssl.chainComplete === false) {
      addFinding(findings, "SSL_INCOMPLETE_CHAIN", { observed: { chainLength: raw.ssl.chainLength } });
    }
  }

  // --- Headers ---
  if (raw.headers?.missing) {
    for (const m of raw.headers.missing) {
      addFinding(findings, m.code, {
        observed: {
          header: m.label,
          status: "not present in response",
          httpStatusCode: raw.headers.statusCode ?? null,
          server: raw.headers.server ?? null,
        },
      });
    }
  }

  // --- Ports (now severity-aware, per portScanner.js) ---
  if (raw.ports?.open) {
    for (const p of raw.ports.open) {
      const evidence = { observed: { port: p.port, service: p.service, banner: p.banner || null, state: "open", severity: p.severity } };
      if (p.port === 21) addFinding(findings, "PORT_21_OPEN", evidence);
      else if (p.port === 22) addFinding(findings, "PORT_22_OPEN", evidence);
      else if (p.port === 23) addFinding(findings, "PORT_23_OPEN", evidence);
      else if (p.port === 3389) addFinding(findings, "PORT_3389_OPEN", evidence);
      else if (DATABASE_PORTS.has(p.port)) addFinding(findings, "DATABASE_PORT_OPEN", evidence);
      else if (p.severity === "High" || p.severity === "Critical") addFinding(findings, "RISKY_PORT_OPEN", evidence);
    }
  }

  // --- CVEs (only fires for CPE-confirmed/likely matches — see cveService.js) ---
  if (raw.cves?.results?.length) {
    for (const cve of raw.cves.results) {
      const evidence = {
        cveId: cve.id,
        cvssScore: cve.score,
        product: cve.product,
        version: cve.version,
        confidence: cve.confidence,
        source: cve.evidence,
      };
      if (cve.severity === "CRITICAL") addFinding(findings, "CRITICAL_CVE", evidence);
      else if (cve.severity === "HIGH") addFinding(findings, "HIGH_CVE", evidence);
    }
  }

  // --- DNS hygiene (now with SPF/DMARC depth + CAA + wildcard) ---
  if (raw.dns) {
    if (!raw.dns.hasSPF) {
      addFinding(findings, "NO_SPF", { observed: { hasSPF: false, domain: raw.dns.domain ?? null } });
    } else {
      if (raw.dns.spf?.overlyPermissive) {
        addFinding(findings, "SPF_OVERLY_PERMISSIVE", { observed: { spf: raw.dns.spf.raw } });
      }
      if (raw.dns.spf?.exceedsLookupBudget) {
        addFinding(findings, "SPF_TOO_MANY_LOOKUPS", {
          observed: { lookupCount: raw.dns.spf.lookupCount, spf: raw.dns.spf.raw },
        });
      }
    }

    if (!raw.dns.hasDMARC) {
      addFinding(findings, "NO_DMARC", { observed: { hasDMARC: false, domain: raw.dns.domain ?? null } });
    } else if (raw.dns.dmarc?.weakPolicy) {
      addFinding(findings, "DMARC_WEAK_POLICY", { observed: { policy: raw.dns.dmarc.policy, dmarc: raw.dns.dmarc.raw } });
    }

    if (Array.isArray(raw.dns.caa) && raw.dns.caa.length === 0) {
      addFinding(findings, "CAA_MISSING", { observed: { caa: [] } });
    }

    if (raw.dns.wildcardDetected) {
      addFinding(findings, "WILDCARD_DNS", { observed: { wildcardDetected: true } });
    }
  }

  // --- Domain expiry ---
  if (raw.whois?.expiryDate) {
    const days = Math.round((new Date(raw.whois.expiryDate) - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 30) {
      addFinding(findings, "DOMAIN_EXPIRING_SOON", {
        observed: { expiryDate: raw.whois.expiryDate, daysRemaining: days },
      });
    }
  }

  const riskScore = Math.min(100, findings.reduce((sum, f) => sum + f.weight, 0));
  const securityScore = Math.max(0, 100 - riskScore);
  const grade = scoreToGrade(securityScore);

  return {
    findings,
    riskScore,
    securityScore,
    grade,
    categories: buildCategoryBreakdown(findings, raw),
    explanation: buildExplanation(findings, securityScore),
  };
}

function buildCategoryBreakdown(findings, raw) {
  return ALL_CATEGORIES.map((category) => {
    if (category === "Web Hygiene") {
      return { category, score: 100, maxPenalty: 0, triggeredWeight: 0, findingCount: 0, note: "Not yet part of risk scoring." };
    }
    const inCategory = findings.filter((f) => f.category === category);
    const triggeredWeight = inCategory.reduce((sum, f) => sum + f.weight, 0);
    const maxPenalty = CATEGORY_MAX[category] || 0;
    const score = maxPenalty === 0 ? 100 : Math.max(0, Math.round(100 - (triggeredWeight / maxPenalty) * 100));
    return { category, score, maxPenalty, triggeredWeight, findingCount: inCategory.length };
  });
}

function buildExplanation(findings, securityScore) {
  if (findings.length === 0) {
    return [`No risk factors were detected against the evidence gathered — starting score of 100.`];
  }

  const lines = [`Starting from a clean score of 100, the following findings reduced it to ${securityScore}:`];
  const bySeverity = { critical: [], high: [], medium: [], low: [] };
  findings.forEach((f) => bySeverity[f.severity]?.push(f));

  ["critical", "high", "medium", "low"].forEach((sev) => {
    const group = bySeverity[sev];
    if (!group.length) return;
    const points = group.reduce((sum, f) => sum + f.weight, 0);
    lines.push(`${group.length} ${sev} finding${group.length > 1 ? "s" : ""} reduced the score by ${points} point${points > 1 ? "s" : ""}.`);
  });

  return lines;
}

function scoreToGrade(score) {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

module.exports = { computeRisk, scoreToGrade, RULES };
