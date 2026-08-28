const axios = require("axios");
const https = require("https");

const paths = [
    "/admin",
    "/login",
    "/dashboard",
    "/administrator",
    "/admin/login",
    "/api",
    "/graphql",
    "/config",
    "/config.php",
    "/uploads",
    "/backup",
    "/backup.zip",
    "/backup.sql",
    "/.git",
    "/.git/config",
    "/.env",
    "/phpinfo.php",
    "/server-status",
    "/wp-admin",
    "/wp-login.php",
    "/cpanel",
    "/adminer.php",
    "/vendor",
    "/storage",
    "/logs",
    "/test",
    "/old",
    "/dev",
    "/staging",
    "/phpmyadmin"
];

async function checkPath(target, path, lookup) {
    const url = target.replace(/\/$/, "") + path;
    try {
        const response = await axios.get(
            url,
            {
                timeout: 3000,
                validateStatus: () => true,
                httpsAgent: lookup ? new https.Agent({ lookup }) : undefined
            }
        );

        if (
            response.status === 200 ||
            response.status === 301 ||
            response.status === 302 ||
            response.status === 401 ||
            response.status === 403
        ) {
            let severity = "Low";
            if (
                path.includes(".env") ||
                path.includes(".git") ||
                path.includes("phpinfo") ||
                path.includes("backup")
            ) {
                severity = "Critical";
            }
            else if (
                path.includes("admin") ||
                path.includes("cpanel") ||
                path.includes("adminer") ||
                path.includes("phpmyadmin")
            ) {
                severity = "High";
            }

            return {
                path,
                status: response.status,
                severity,
                redirected:
                    response.status === 301 ||
                    response.status === 302,
                contentLength:
                    response.headers["content-length"] ||
                    "Unknown"
            };
        }

        return { status: response.status };
    }
    catch {
        return null;
    }
}

/**
 * Checks all candidate paths concurrently instead of one-by-one — same
 * result shape as before, just bounded by the slowest single request
 * (~3s worst case) rather than the sum of all of them (~90s worst case).
 */
async function scanDirectories(target, lookup) {
    const outcomes = await Promise.all(paths.map((path) => checkPath(target, path, lookup)));

    let accessible = 0;
    let forbidden = 0;
    let redirected = 0;
    const results = [];

    for (const outcome of outcomes) {
        if (!outcome) continue;
        if (outcome.status === 200) accessible++;
        if (outcome.status === 401 || outcome.status === 403) forbidden++;
        if (outcome.status === 301 || outcome.status === 302) redirected++;
        if (outcome.path) results.push(outcome);
    }

    return {
        scanned: paths.length,
        accessible,
        forbidden,
        redirected,
        totalFound: results.length,
        critical: results.filter(r => r.severity === "Critical").length,
        high: results.filter(r => r.severity === "High").length,
        low: results.filter(r => r.severity === "Low").length,
        directories: results
    };
}

module.exports = scanDirectories;
