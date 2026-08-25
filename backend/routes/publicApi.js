const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { startScanInternal } = require("../controllers/scanController");
const Scan = require("../models/Scan");
const { validateTarget } = require("../utils/ssrfGuard");

async function logRequest({ keyId, userId, target, success, startedAt }) {
    const responseTimeMs = Date.now() - startedAt;
    try {
        await pool.query(
            `INSERT INTO api_request_logs (key_id, user_id, target, success, response_time_ms)
             VALUES ($1, $2, $3, $4, $5)`,
            [keyId, userId, target || null, success, responseTimeMs]
        );
    } catch (err) {
        // Logging failure shouldn't break the actual API response.
        console.log("[api_request_logs] failed to write:", err.message);
    }
}

// POST /api/v1/scan  { target }  — public API, authenticated via x-api-key.
router.post("/v1/scan", apiKeyAuth, async (req, res) => {
    const startedAt = Date.now();
    const { target } = req.body;

    let hostname;
    try {
        hostname = await validateTarget(target);
    } catch (err) {
        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target, success: false, startedAt });
        return res.status(400).json({ success: false, message: err.message });
    }

    try {
        const scanId = await startScanInternal(hostname, req.apiUser.id);
        const scan = await Scan.findById(scanId);

        if (!scan || scan.status !== "completed") {
            await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: false, startedAt });
            return res.status(502).json({ success: false, message: "Scan did not complete" });
        }

        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: true, startedAt });

        res.json({
            success: true,
            target: scan.target,
            score: scan.securityScore,
            grade: scan.grade,
            risk: scan.findings?.some((f) => f.severity === "critical" || f.severity === "high")
                ? "High"
                : scan.findings?.some((f) => f.severity === "medium")
                ? "Medium"
                : "Low",
            ssl: scan.ssl ? { valid: scan.ssl.valid, issuer: scan.ssl.issuer } : null,
            findings: scan.findings || [],
        });
    } catch (err) {
        console.log(err);
        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: false, startedAt });
        res.status(500).json({ success: false, message: "Scan failed" });
    }
});

module.exports = router;
