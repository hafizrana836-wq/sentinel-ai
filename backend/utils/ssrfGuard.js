// Place this file at: utils/ssrfGuard.js
const dns = require("dns").promises;

// Scoped resolver, NOT dns.setServers() — that would change DNS globally
// for the whole process, including the pg Pool's own lookup of the Neon
// hostname, which is exactly what caused Neon connection timeouts last time.
// A dedicated Resolver instance only affects lookups made through it.
const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const HOSTNAME_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "metadata.google.internal"]);

/** Returns true if `ip` (v4) falls inside a private/reserved/loopback range. */
function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed -> treat as unsafe
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast/reserved
  return false;
}

/** Returns true if `ip` (v6) is loopback, link-local, or unique-local. */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) return isPrivateIPv4(lower.replace("::ffff:", "")); // v4-mapped
  return false;
}

/**
 * Validates a user-supplied scan target and rejects anything that could be
 * used to make the server attack its own network (SSRF). Throws with a
 * clear message on rejection; otherwise resolves to the cleaned hostname.
 */
async function validateTarget(rawTarget) {
  if (!rawTarget || typeof rawTarget !== "string") {
    throw new Error("target is required");
  }

  const hostname = rawTarget
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("This target is not allowed to be scanned");
  }
  if (!HOSTNAME_RE.test(hostname)) {
    throw new Error("target must be a valid domain name (e.g. example.com)");
  }

  let addresses = [];
  try {
    const [v4, v6] = await Promise.all([
      resolver.resolve4(hostname).catch(() => []),
      resolver.resolve6(hostname).catch(() => []),
    ]);
    addresses = [...v4, ...v6];
  } catch {
    throw new Error("Could not resolve target hostname");
  }

  if (!addresses.length) throw new Error("Could not resolve target hostname");

  for (const ip of addresses) {
    const blocked = ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
    if (blocked) throw new Error("This target resolves to a private/internal address and cannot be scanned");
  }

  return hostname;
}

module.exports = { validateTarget };
