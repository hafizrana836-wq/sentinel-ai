// Place this file at: services/dnsService.js
const dns = require("dns");
const crypto = require("crypto");

// Force reliable public resolvers — some hosts/containers ship a broken or
// unreachable default resolver.
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
const dnsp = dns.promises;

async function safeResolve(fn) {
  try {
    return await fn();
  } catch {
    return [];
  }
}

function cleanHostname(target) {
  return target.replace(/^https?:\/\//, "").split("/")[0];
}

// --- SPF -------------------------------------------------------------
// Approximate RFC 7208 lookup-count: counts mechanisms/modifiers that cost a
// DNS lookup (include, a, mx, ptr, exists, redirect). This is a good-faith
// count, not a full SPF resolver — it doesn't recursively expand `include:`
// targets, so it can undercount deeply nested SPF chains.
function parseSPF(raw) {
  if (!raw) return null;
  const tokens = raw.trim().split(/\s+/);
  const lookupMechanisms = tokens.filter((t) => /^[+\-~?]?(include|a|mx|ptr|exists):/i.test(t) || /^redirect=/i.test(t));
  const lastMechanism = tokens.find((t) => /^[+\-~?]?all$/i.test(t));

  // "all" with no qualifier defaults to "+all" per RFC 7208 §2.6.11
  const overlyPermissive = !!lastMechanism && (lastMechanism === "all" || lastMechanism.startsWith("+"));

  return {
    raw,
    lookupCount: lookupMechanisms.length,
    exceedsLookupBudget: lookupMechanisms.length > 10,
    overlyPermissive,
  };
}

function parseDMARC(raw) {
  if (!raw) return null;
  const match = raw.match(/p=([a-zA-Z]+)/i);
  const policy = match ? match[1].toLowerCase() : null;
  return {
    raw,
    policy,
    weakPolicy: policy === "none",
  };
}

async function checkSPF(hostname) {
  const txt = await safeResolve(() => dnsp.resolveTxt(hostname));
  const spfRecord = txt.map((rec) => rec.join("")).find((t) => t.toLowerCase().startsWith("v=spf1"));
  return parseSPF(spfRecord);
}

async function checkDMARC(hostname) {
  const txt = await safeResolve(() => dnsp.resolveTxt(`_dmarc.${hostname}`));
  const dmarcRecord = txt.map((rec) => rec.join("")).find((t) => t.toLowerCase().startsWith("v=dmarc1"));
  return parseDMARC(dmarcRecord);
}

async function checkCAA(hostname) {
  try {
    const records = await dnsp.resolveCaa(hostname);
    return records || [];
  } catch (err) {
    return []; // ENODATA/ENOTFOUND just means no CAA record
  }
}

// Queries a random, almost-certainly-nonexistent subdomain. If it resolves
// anyway, the zone has a wildcard ("*") record.
async function checkWildcard(hostname) {
  const probe = `sentinel-wildcard-check-${crypto.randomBytes(6).toString("hex")}.${hostname}`;
  try {
    const addresses = await dnsp.resolve4(probe);
    return addresses.length > 0;
  } catch {
    return false;
  }
}

async function checkDNS(target) {
  const hostname = cleanHostname(target);

  const [a, aaaa, mx, ns, spf, dmarc, caa, wildcardDetected] = await Promise.all([
    safeResolve(() => dnsp.resolve4(hostname)),
    safeResolve(() => dnsp.resolve6(hostname)),
    safeResolve(() => dnsp.resolveMx(hostname)),
    safeResolve(() => dnsp.resolveNs(hostname)),
    checkSPF(hostname),
    checkDMARC(hostname),
    checkCAA(hostname),
    checkWildcard(hostname),
  ]);

  return {
    domain: hostname,
    a,
    aaaa,
    mx,
    ns,
    hasSPF: !!spf,
    spf, // { raw, lookupCount, exceedsLookupBudget, overlyPermissive } or null
    hasDMARC: !!dmarc,
    dmarc, // { raw, policy, weakPolicy } or null
    caa, // array of CAA records — [] means none found
    wildcardDetected,
  };
}

async function resolveIP(target) {
  const hostname = cleanHostname(target);
  try {
    const addresses = await dnsp.resolve4(hostname);
    if (addresses[0]) return addresses[0];
  } catch {
    /* fall through to OS-level resolver */
  }
  try {
    const { address } = await dnsp.lookup(hostname, { family: 4 });
    return address;
  } catch {
    return null;
  }
}

module.exports = { checkDNS, resolveIP };

