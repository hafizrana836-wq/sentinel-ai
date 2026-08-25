// services/fingerprintService.js
//
// Turns raw banners (HTTP Server header, X-Powered-By, SSH banner, ...) into
// structured product/version fingerprints with a CONFIDENCE level attached.
// This is the gatekeeper for CVE lookups: cveService should never query NVD
// for a fingerprint it isn't at least "likely" confident about, and must
// never silently treat "product name only, no version" as a CVE match.

const CONFIDENCE = {
  CONFIRMED: "Confirmed", // product + exact version from a structured, hard-to-spoof banner (e.g. SSH)
  LIKELY: "Likely",       // product + version parsed from an HTTP header (Server / X-Powered-By)
  POTENTIAL: "Potential", // product name only, no version — CVE lookup is NOT performed
  INFORMATIONAL: "Informational", // banner present but unrecognized / proprietary (e.g. "gws")
};

// vendor/product pairs as NVD's CPE dictionary spells them —
// wrong vendor string means zero CPE matches, so keep this accurate.
const VENDOR_MAP = {
  nginx: { vendor: "nginx", product: "nginx" },
  apache: { vendor: "apache", product: "http_server" },
  openssh: { vendor: "openbsd", product: "openssh" },
  "microsoft-iis": { vendor: "microsoft", product: "internet_information_services" },
  lighttpd: { vendor: "lighttpd", product: "lighttpd" },
  proftpd: { vendor: "proftpd", product: "proftpd" },
  vsftpd: { vendor: "vsftpd", product: "vsftpd" },
  exim: { vendor: "exim", product: "exim" },
  postfix: { vendor: "postfix", product: "postfix" },
  mysql: { vendor: "mysql", product: "mysql" },
  postgresql: { vendor: "postgresql", product: "postgresql" },
  redis: { vendor: "redis", product: "redis" },
  mongodb: { vendor: "mongodb", product: "mongodb" },
  php: { vendor: "php", product: "php" },
};

// Proprietary / managed-infra banners that will NEVER have a public CPE —
// querying NVD for these produces nothing but false positives.
const KNOWN_PROPRIETARY = new Set(["gws", "cloudflare", "envoy", "ats", "tsa_o", "esf", "akamaighost"]);

function buildCPE({ vendor, product }, version) {
  return `cpe:2.3:a:${vendor}:${product}:${version}:*:*:*:*:*:*:*`;
}

function fromServerHeader(serverHeader) {
  if (!serverHeader) return null;
  const raw = serverHeader.trim();
  const lower = raw.toLowerCase();

  // "nginx/1.18.0", "Apache/2.4.41 (Ubuntu)", "Microsoft-IIS/10.0"
  const versioned = raw.match(/^([a-zA-Z0-9\-_.]+)\/([\d.]+)/);
  if (versioned) {
    const name = versioned[1].toLowerCase();
    const version = versioned[2];
    const known = VENDOR_MAP[name];
    if (known) {
      return {
        product: name,
        version,
        cpe: buildCPE(known, version),
        confidence: CONFIDENCE.LIKELY, // HTTP headers are easy to spoof/strip, so not "Confirmed"
        evidence: { source: "Server header", raw },
      };
    }
    // versioned, but not a product we have a CPE mapping for
    return {
      product: name,
      version,
      cpe: null,
      confidence: CONFIDENCE.POTENTIAL,
      evidence: { source: "Server header", raw },
    };
  }

  // no version at all
  if (KNOWN_PROPRIETARY.has(lower)) {
    return {
      product: lower,
      version: null,
      cpe: null,
      confidence: CONFIDENCE.INFORMATIONAL,
      evidence: { source: "Server header", raw },
    };
  }

  return {
    product: lower,
    version: null,
    cpe: null,
    confidence: CONFIDENCE.POTENTIAL,
    evidence: { source: "Server header", raw },
  };
}

function fromPoweredByHeader(poweredBy) {
  if (!poweredBy) return null;
  const raw = poweredBy.trim();
  // "PHP/8.1.2", "ASP.NET"
  const versioned = raw.match(/^([a-zA-Z0-9\-_.]+)\/([\d.]+)/);
  if (versioned) {
    const name = versioned[1].toLowerCase();
    const version = versioned[2];
    const known = VENDOR_MAP[name];
    if (known) {
      return {
        product: name,
        version,
        cpe: buildCPE(known, version),
        confidence: CONFIDENCE.LIKELY,
        evidence: { source: "X-Powered-By header", raw },
      };
    }
  }
  return {
    product: raw.toLowerCase(),
    version: null,
    cpe: null,
    confidence: CONFIDENCE.POTENTIAL,
    evidence: { source: "X-Powered-By header", raw },
  };
}

// SSH banners are sent by the daemon itself over the raw socket, before any
// application logic runs — far harder to spoof convincingly than an HTTP
// header, so a clean match here is graded CONFIRMED.
function fromSSHBanner(banner) {
  if (!banner) return null;
  const raw = banner.trim();
  const match = raw.match(/OpenSSH[_\/]?([\d.]+)/i);
  if (match) {
    const version = match[1];
    return {
      product: "openssh",
      version,
      cpe: buildCPE(VENDOR_MAP.openssh, version),
      confidence: CONFIDENCE.CONFIRMED,
      evidence: { source: "SSH banner", raw },
    };
  }
  return {
    product: "ssh",
    version: null,
    cpe: null,
    confidence: CONFIDENCE.INFORMATIONAL,
    evidence: { source: "SSH banner", raw },
  };
}

function fromGenericBanner(service, banner) {
  if (!banner) return null;
  const raw = banner.trim();
  for (const key of Object.keys(VENDOR_MAP)) {
    const re = new RegExp(`${key}[\\/\\s_]?v?([\\d.]+)`, "i");
    const m = raw.match(re);
    if (m) {
      const version = m[1];
      return {
        product: key,
        version,
        cpe: buildCPE(VENDOR_MAP[key], version),
        confidence: CONFIDENCE.CONFIRMED, // raw protocol banner, not an HTTP header
        evidence: { source: `${service} banner`, raw },
      };
    }
  }
  return {
    product: service.toLowerCase(),
    version: null,
    cpe: null,
    confidence: CONFIDENCE.INFORMATIONAL,
    evidence: { source: `${service} banner`, raw },
  };
}

/**
 * @param {object} headers - result of headerService.checkHeaders()
 * @param {Array} ports - result of portScanner.scanPorts() (each may carry a `banner`)
 * @returns {Array} fingerprints
 */
function buildFingerprints(headers, ports = []) {
  const fingerprints = [];

  // NOTE: headerService returns a flat object — headers.server /
  // headers.poweredBy — not a nested `raw` object. Keep this matched to
  // whatever headerService.js actually returns.
  const server = fromServerHeader(headers?.server);
  if (server) fingerprints.push(server);

  const poweredBy = fromPoweredByHeader(headers?.poweredBy);
  if (poweredBy) fingerprints.push(poweredBy);

  (ports || []).forEach((p) => {
    if (!p.open || !p.banner) return;
    if (p.port === 22) {
      const fp = fromSSHBanner(p.banner);
      if (fp) fingerprints.push(fp);
    } else {
      const fp = fromGenericBanner(p.service, p.banner);
      if (fp) fingerprints.push(fp);
    }
  });

  return fingerprints;
}

module.exports = { buildFingerprints, CONFIDENCE, VENDOR_MAP, buildCPE };
