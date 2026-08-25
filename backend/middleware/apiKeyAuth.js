const pool = require("../config/db");

function getTodayString() {
    return new Date().toISOString().split("T")[0];
}

function getMonthString() {
    return new Date().toISOString().slice(0, 7);
}

async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: "API key required (send it in the 'x-api-key' header)"
        });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM api_keys WHERE key_value = $1 AND active = TRUE",
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid or inactive API key"
            });
        }

        const keyRow = result.rows[0];
        const today = getTodayString();
        const month = getMonthString();

        // Reset daily/monthly counters if the date has rolled over
        let requestsToday = keyRow.requests_today_date?.toISOString().split("T")[0] === today
            ? keyRow.requests_today
            : 0;
        let requestsMonth = keyRow.requests_month_ym === month
            ? keyRow.requests_month
            : 0;

        // ===== Rate limit check =====
        if (requestsToday >= keyRow.daily_limit) {
            const newExceededCount = keyRow.limit_exceeded_count + 1;
            const shouldDisable = newExceededCount >= 5;

            await pool.query(
                `UPDATE api_keys
                 SET limit_exceeded_count = $1, active = $2
                 WHERE id = $3`,
                [newExceededCount, !shouldDisable, keyRow.id]
            );

            return res.status(429).json({
                success: false,
                message: shouldDisable
                    ? "Daily limit exceeded too many times — this API key has been automatically disabled for security. Please regenerate a new key."
                    : `Daily limit of ${keyRow.daily_limit} requests reached. Try again tomorrow.`,
                dailyLimit: keyRow.daily_limit,
                remaining: 0
            });
        }

        req.apiUser = { id: keyRow.user_id };
        req.apiKeyId = keyRow.id;

        // ===== Update usage counters =====
        await pool.query(
            `UPDATE api_keys
             SET requests_today = $1,
                 requests_today_date = $2,
                 requests_month = $3,
                 requests_month_ym = $4,
                 total_requests = total_requests + 1,
                 last_used_at = NOW()
             WHERE id = $5`,
            [requestsToday + 1, today, requestsMonth + 1, month, keyRow.id]
        );

        next();
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "API key validation failed"
        });
    }
}

module.exports = apiKeyAuth;
