const axios = require("axios");

function parse(text, status) {
    const lines = text.split("\n");
    const data = {};
    const encryption = [];
    const acknowledgments = [];
    const preview = lines.slice(0, 10);

    lines.forEach((line) => {
        const index = line.indexOf(":");
        if (index === -1) return;
        const key = line.substring(0, index).trim();
        const value = line.substring(index + 1).trim();
        if (key === "Encryption") encryption.push(value);
        if (key === "Acknowledgments") acknowledgments.push(value);
        data[key] = value;
    });

    return {
        exists: true,
        status,
        contact: data.Contact || null,
        expires: data.Expires || null,
        policy: data.Policy || null,
        hiring: data.Hiring || null,
        canonical: data.Canonical || null,
        languages: data["Preferred-Languages"] || null,
        encryption,
        acknowledgments,
        size: Buffer.byteLength(text, "utf8"),
        preview,
        message: data.Contact ? `security.txt found. Contact: ${data.Contact}` : "security.txt found.",
    };
}

async function fetchOne(url) {
    try {
        const response = await axios.get(url, { timeout: 4000, validateStatus: () => true });
        if (response.status !== 200) return null;
        return parse(response.data, response.status);
    } catch {
        return null;
    }
}

async function analyseSecurityTxt(target) {
    // RFC 9116 makes /.well-known/security.txt canonical and /security.txt a
    // legacy fallback — check both at once instead of waiting on the first
    // to fail before trying the second, and prefer the canonical result.
    const wellKnownUrl = target.replace(/\/$/, "") + "/.well-known/security.txt";
    const legacyUrl = target.replace(/\/$/, "") + "/security.txt";

    const [wellKnown, legacy] = await Promise.all([fetchOne(wellKnownUrl), fetchOne(legacyUrl)]);

    if (wellKnown) return wellKnown;
    if (legacy) return legacy;

    return {
        exists: false,
        status: 404,
        contact: null,
        expires: null,
        policy: null,
        hiring: null,
        canonical: null,
        languages: null,
        encryption: [],
        acknowledgments: [],
        size: 0,
        preview: [],
        message: "security.txt not found.",
    };
}

module.exports = analyseSecurityTxt;
