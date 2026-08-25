const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");

async function analyseSitemap(target) {
    try {
        const url = target.replace(/\/$/, "") + "/sitemap.xml";
        const response = await axios.get(url, {
            timeout: 5000,
            validateStatus: () => true
        });

        if (response.status !== 200) {
            return {
                exists: false,
                status: response.status,
                isIndex: false,
                totalUrls: 0,
                urls: [],
                size: 0,
                preview: [],
                findings: [
                    "Sitemap not found"
                ],
                message: "Sitemap not found"
            };
        }

        const parser = new XMLParser({
            ignoreAttributes: false
        });
        const xml = parser.parse(response.data);
        const isIndex = !!xml.sitemapindex;

        let urls = [];

        if (xml.urlset && xml.urlset.url) {
            if (Array.isArray(xml.urlset.url)) {
                urls = xml.urlset.url;
            }
            else {
                urls = [xml.urlset.url];
            }
        }

        const list = urls.map((item) => ({
            location: item.loc || "",
            lastModified: item.lastmod || "Unknown",
            changeFrequency: item.changefreq || "Unknown",
            priority: item.priority || "Unknown"
        }));

        const findings = [];

        if (isIndex) {
            findings.push("This is a sitemap index (references other sitemaps)");
        }

        if (list.length === 0) {
            findings.push("Sitemap contains no URLs");
        }

        if (list.length > 1000) {
            findings.push("Large sitemap detected");
        }

        return {
            exists: true,
            status: response.status,
            isIndex,
            totalUrls: list.length,
            urls: list,
            size: Buffer.byteLength(response.data, "utf8"),
            preview: list.slice(0, 10),
            findings,
            message: isIndex
                ? "Sitemap index found (contains references to other sitemaps)."
                : `Found ${list.length} URL${list.length === 1 ? "" : "s"} in sitemap.`
        };
    }
    catch (error) {
        return {
            exists: false,
            status: 0,
            isIndex: false,
            totalUrls: 0,
            urls: [],
            size: 0,
            preview: [],
            findings: [
                error.message
            ],
            message: error.message
        };
    }
}

module.exports = analyseSitemap;
