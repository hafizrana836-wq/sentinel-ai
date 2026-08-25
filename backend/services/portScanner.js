// Place this file at: services/portScanner.js
const net = require("net");

// Common ports worth flagging on an internet-facing asset.
const COMMON_PORTS = [
  { port: 21, service: "FTP" },
  { port: 22, service: "SSH" },
  { port: 23, service: "Telnet" },
  { port: 25, service: "SMTP" },
  { port: 80, service: "HTTP" },
  { port: 110, service: "POP3" },
  { port: 143, service: "IMAP" },
  { port: 443, service: "HTTPS" },
  { port: 3306, service: "MySQL" },
  { port: 3389, service: "RDP" },
  { port: 5432, service: "PostgreSQL" },
  { port: 6379, service: "Redis" },
  { port: 27017, service: "MongoDB" },
];

// Port intelligence: how bad is it for THIS port to be open to the internet.
// "Expected" ports (80/443) don't count toward exposure at all.
const PORT_SEVERITY = {
  80: "Expected",
  443: "Expected",
  21: "Critical", // FTP — plaintext credentials
  23: "Critical", // Telnet — plaintext everything
  3306: "Critical", // MySQL directly reachable
  5432: "Critical", // PostgreSQL directly reachable
  6379: "Critical", // Redis — historically shipped with no auth by default
  27017: "Critical", // MongoDB — same history as Redis
  22: "High", // SSH — expected on servers, but still a brute-force target
  3389: "High", // RDP — common ransomware entry point
  25: "Medium", // SMTP
  110: "Medium", // POP3
  143: "Medium", // IMAP
};

// Services that greet with a plaintext banner right after the TCP handshake —
// safe (read-only, nothing sent) to capture and useful for CVE fingerprinting.
const BANNER_PORTS = new Set([21, 22, 25, 110, 143]);
const BANNER_WAIT_MS = 800;

function probePort(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    let banner = "";
    const finish = (open) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ open, banner: banner ? banner.trim().slice(0, 200) : null });
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      if (!BANNER_PORTS.has(port)) {
        finish(true);
        return;
      }
      setTimeout(() => finish(true), Math.min(BANNER_WAIT_MS, timeoutMs));
    });
    socket.on("data", (chunk) => {
      banner += chunk.toString("utf8");
    });
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/** Highest severity among open, non-"Expected" ports decides overall exposure. */
function computeExposure(openWithSeverity) {
  const rank = { Critical: 3, High: 2, Medium: 1, Expected: 0 };
  const worst = openWithSeverity.reduce((max, p) => Math.max(max, rank[p.severity] ?? 1), 0);
  if (worst >= 3) return "HIGH";
  if (worst === 2) return "MEDIUM";
  if (worst === 1) return "LOW-MEDIUM";
  return "LOW";
}

async function scanPorts(hostname) {
  const results = await Promise.all(
    COMMON_PORTS.map(async ({ port, service }) => {
      const { open, banner } = await probePort(hostname, port);
      return { port, service, open, banner: banner || null, severity: PORT_SEVERITY[port] || "Medium" };
    })
  );

  const open = results.filter((r) => r.open);
  const risky = open.filter((r) => r.severity === "Critical" || r.severity === "High");
  const exposure = computeExposure(open);

  return {
    scanned: results.length,
    open,
    riskyOpen: risky,
    exposure, // "LOW" | "LOW-MEDIUM" | "MEDIUM" | "HIGH"
    criticalCount: open.filter((r) => r.severity === "Critical").length,
    highCount: open.filter((r) => r.severity === "High").length,
  };
}

module.exports = { scanPorts };
