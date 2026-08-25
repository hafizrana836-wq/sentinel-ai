const { Pool } = require("pg");

// DATABASE_URL .env se aa raha hai.
// Neon ke liye zaroori: hostname mein "-pooler" hona chahiye taake
// serverless/cron jaisi repeated short connections stable rahein.
// Example: ep-tiny-waterfall-ax334q4p-pooler.c-4.us-east-2.aws.neon.tech
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}
if (!connectionString.includes("-pooler")) {
  console.warn(
    "⚠️  DATABASE_URL mein '-pooler' nahi mila. Neon ka pooled endpoint use karna " +
    "recommended hai, warna scheduled/cron connections beech mein disconnect ho sakte hain."
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    // Neon hamesha SSL require karta hai. rejectUnauthorized: true rakhna
    // secure hai — Neon ka cert publicly trusted CA se signed hota hai.
    rejectUnauthorized: true,
  },
  max: 10,                     // ek waqt mein max open connections
  idleTimeoutMillis: 30000,    // idle connection 30s baad close ho jaye
  connectionTimeoutMillis: 10000, // 10s tak connect hone ka wait, warna error
});

// Pool-level errors ko catch karo taake ek bad connection poori app crash na kare
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err.message);
});

/**
 * Query helper jo transient connection errors (jaise Neon cold-start /
 * TLS drop) par ek dafa retry karta hai.
 */
async function queryWithRetry(text, params, retries = 1) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    const isTransient =
      err.message.includes("socket disconnected") ||
      err.message.includes("Connection terminated") ||
      err.code === "ECONNRESET";
    if (isTransient && retries > 0) {
      console.warn(`⚠️  Transient DB error (${err.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
      return queryWithRetry(text, params, retries - 1);
    }
    throw err;
  }
}

module.exports = pool;
module.exports.queryWithRetry = queryWithRetry;
