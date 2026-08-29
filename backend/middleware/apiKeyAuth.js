const crypto = require("crypto");
const pool = require("../config/db");

function hashKey(rawKey) {
    return crypto.createHash("sha256").update(rawKey).digest("hex");
}

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
            [hashKey(apiKey)]
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

        // Atomic check-and-increment: the rollover, the limit check, and the
        // increment all happen inside ONE UPDATE's WHERE/SET, so Postgres's
        // row lock serializes concurrent requests on the same key — no
        // separate read-then-write gap for two requests to race through.
        const updateResult = await pool.query(
            `UPDATE api_keys
             SET
               requests_today = CASE WHEN requests_today_date = $2 THEN requests_today + 1 ELSE 1 END,
               requests_today_date = $2,
               requests_month = CASE WHEN requests_month_ym = $3 THEN requests_month + 1 ELSE 1 END,
               requests_month_ym = $3,
               total_requests = total_requests + 1,
               last_used_at = NOW()
             WHERE id = $1
               AND active = TRUE
               AND (CASE WHEN requests_today_date = $2 THEN requests_today ELSE 0 END) < daily_limit
             RETURNING id, user_id`,
            [keyRow.id, today, month]
        );

        if (updateResult.rows.length === 0) {
            // Either the limit was hit or the key got deactivated between the
            // lookup above and now — record it atomically too.
            const limitResult = await pool.query(
                `UPDATE api_keys
                 SET limit_exceeded_count = limit_exceeded_count + 1,
                     active = CASE WHEN limit_exceeded_count + 1 >= 5 THEN false ELSE active END
                 WHERE id = $1
                 RETURNING limit_exceeded_count, active`,
                [keyRow.id]
            );
            const shouldDisable = limitResult.rows[0] && !limitResult.rows[0].active;

            return res.status(429).json({
                success: false,
                message: shouldDisable
                    ? "Daily limit exceeded too many times — this API key has been automatically disabled for security. Please regenerate a new key."
                    : `Daily limit of ${keyRow.daily_limit} requests reached. Try again tomorrow.`,
                dailyLimit: keyRow.daily_limit,
                remaining: 0
            });
        }

        req.apiUser = { id: updateResult.rows[0].user_id };
        req.apiKeyId = updateResult.rows[0].id;

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
