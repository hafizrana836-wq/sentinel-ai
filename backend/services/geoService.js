const axios = require("axios");
const { resolveIP } = require("./dnsService");

// ip-api.com free tier — no key required, 45 req/min
async function checkGeo(target) {
  try {
    const ip = await resolveIP(target);
    if (!ip) return { ip: null, error: "Could not resolve IP" };

    const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 6000 });
    const d = res.data;

    if (d.status !== "success") return { ip, error: d.message || "Lookup failed" };

    return {
      ip,
      country: d.country,
      city: d.city,
      org: d.org || d.isp,
      lat: d.lat,
      lon: d.lon,
    };
  } catch (err) {
    return { ip: null, error: err.message };
  }
}

module.exports = { checkGeo };
