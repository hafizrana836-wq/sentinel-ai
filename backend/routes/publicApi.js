const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const apiKeyAuth = require("../middleware/apiKeyAuth");
const { startScanAsync } = require("../controllers/scanController");
const Scan = require("../models/Scan");
const { validateTarget } = require("../utils/ssrfGuard");
const { isValidUUID } = require("../utils/validate");

const MAX_CONCURRENT_SCANS_PER_USER = 3;

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
// Returns immediately once the scan is queued (202) instead of blocking the
// request for the full pipeline — poll GET /api/v1/scan/:id for the result.
router.post("/v1/scan", apiKeyAuth, async (req, res) => {
    const startedAt = Date.now();
    const { target } = req.body;

    let hostname;
    try {
        ({ hostname } = await validateTarget(target));
    } catch (err) {
        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target, success: false, startedAt });
        return res.status(400).json({ success: false, message: err.message });
    }

    try {
        const activeCount = await Scan.activeCountForOwner(req.apiUser.id);
        if (activeCount >= MAX_CONCURRENT_SCANS_PER_USER) {
            await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: false, startedAt });
            return res.status(429).json({
                success: false,
                message: `You already have ${activeCount} scans running. Wait for one to finish before starting another.`,
            });
        }

        const scan = await startScanAsync(hostname, req.apiUser.id);
        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: true, startedAt });

        res.status(202).json({
            success: true,
            scanId: scan.id,
            status: scan.status || "queued",
            message: "Scan queued — poll GET /api/v1/scan/:id for the result.",
        });
    } catch (err) {
        console.log(err);
        await logRequest({ keyId: req.apiKeyId, userId: req.apiUser.id, target: hostname, success: false, startedAt });
        res.status(500).json({ success: false, message: "Could not queue scan" });
    }
});

// GET /api/v1/scan/:id — poll for status/result of a scan started via POST /v1/scan.
router.get("/v1/scan/:id", apiKeyAuth, async (req, res) => {
    if (!isValidUUID(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid scan id" });
    }

    const scan = await Scan.findByIdForOwner(req.params.id, req.apiUser.id);
    if (!scan) return res.status(404).json({ success: false, message: "Scan not found" });

    if (scan.status === "failed") {
        return res.json({ success: false, status: "failed", message: scan.error || "Scan failed" });
    }
    if (scan.status !== "completed") {
        return res.json({ success: true, status: scan.status });
    }

    res.json({
        success: true,
        status: "completed",
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
});

module.exports = router;
