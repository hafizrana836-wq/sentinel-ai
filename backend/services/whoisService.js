// Place this file at: services/whoisService.js
const net = require("net");

const WHOIS_SERVERS = {
  com: "whois.verisign-grs.com",
  net: "whois.verisign-grs.com",
  org: "whois.pir.org",
  io: "whois.nic.io",
  dev: "whois.nic.google",
  co: "whois.nic.co",
  default: "whois.iana.org",
};

function queryWhois(server, domain, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(43, server);
    let data = "";
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => socket.write(domain + "\r\n"));
    socket.on("data", (chunk) => (data += chunk.toString()));
    socket.on("end", () => resolve(data));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("WHOIS query timed out"));
    });
    socket.on("error", reject);
  });
}

function parseField(raw, patterns) {
  for (const p of patterns) {
    const match = raw.match(new RegExp(`${p}:\\s*(.+)`, "i"));
    if (match) return match[1].trim();
  }
  return null;
}

async function checkWhois(hostname) {
  const domain = hostname.split(".").slice(-2).join(".");
  const tld = domain.split(".").pop();
  const server = WHOIS_SERVERS[tld] || WHOIS_SERVERS.default;

  try {
    const raw = await queryWhois(server, domain);
    return {
      registrar: parseField(raw, ["Registrar", "registrar"]),
      createdDate: parseField(raw, ["Creation Date", "created"]),
      expiryDate: parseField(raw, ["Registry Expiry Date", "Expiry Date", "paid-till"]),
      nameServers: [...raw.matchAll(/Name Server:\s*(.+)/gi)].map((m) => m[1].trim()),
      raw: raw.slice(0, 2000), // keep it bounded
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { checkWhois };
