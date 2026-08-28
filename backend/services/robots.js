const axios = require("axios");
const https = require("https");

async function analyseRobots(target, lookup) {
    try {
        const url = target.replace(/\/$/, "") + "/robots.txt";
        const response = await axios.get(url, {
            timeout: 5000,
            validateStatus: () => true,
            httpsAgent: lookup ? new https.Agent({ lookup }) : undefined
        });

        if (response.status !== 200) {
            return {
                exists: false,
                status: response.status,
                sitemap: null,
                allow: [],
                disallow: [],
                userAgents: [],
                crawlDelay: null,
                size: 0,
                preview: [],
                findings: [
                    "robots.txt not found"
                ],
                message: "robots.txt not found"
            };
        }

        const text = response.data;
        const lines = text.split("\n");

        const userAgents = [];
        const allow = [];
        const disallow = [];
        let crawlDelay = null;
        let sitemap = null;

        lines.forEach((line) => {
            line = line.trim();

            if (line.toLowerCase().startsWith("user-agent:")) {
                userAgents.push(line.substring(11).trim());
            }

            if (line.toLowerCase().startsWith("crawl-delay:")) {
                crawlDelay = line.substring(12).trim();
            }

            if (line.toLowerCase().startsWith("allow:")) {
                allow.push(line.substring(6).trim());
            }

            if (line.toLowerCase().startsWith("disallow:")) {
                disallow.push(line.substring(9).trim());
            }

            if (line.toLowerCase().startsWith("sitemap:")) {
                sitemap = line.substring(8).trim();
            }
        });

        const findings = [];

        if (allow.length === 0) {
            findings.push("No Allow rules");
        }

        if (disallow.length === 0) {
            findings.push("No Disallow rules");
        }

        if (!sitemap) {
            findings.push("Sitemap not declared");
        }

        return {
            exists: true,
            status: response.status,
            sitemap,
            allow,
            disallow,
            userAgents,
            crawlDelay,
            size: Buffer.byteLength(text, "utf8"),
            preview: lines.slice(0, 10),
            findings,
            message: `Found ${allow.length} Allow and ${disallow.length} Disallow rules${sitemap ? `, sitemap declared` : ""}.`
        };
    }
    catch (error) {
        return {
            exists: false,
            status: 0,
            sitemap: null,
            allow: [],
            disallow: [],
            userAgents: [],
            crawlDelay: null,
            size: 0,
            preview: [],
            findings: [
                error.message
            ],
            message: error.message
        };
    }
}

module.exports = analyseRobots;
