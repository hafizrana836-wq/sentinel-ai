// Place this file at: middleware/errorHandler.js
/* eslint-disable no-unused-vars */
function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);
  if (process.env.NODE_ENV !== "production") console.error(err.stack);

  // Sequelize validation / unique-constraint errors are the Postgres
  // equivalent of what Mongoose's ValidationError / duplicate-key (11000)
  // used to cover — translate them into a clean 400 instead of a raw 500.
  if (err.name === "SequelizeValidationError") {
    const message = err.errors?.map((e) => e.message).join(", ") || "Validation failed";
    return res.status(400).json({ error: message });
  }
  if (err.name === "SequelizeUniqueConstraintError") {
    const field = err.errors?.[0]?.path || "field";
    return res.status(409).json({ error: `${field} is already in use` });
  }
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({ error: "Referenced record does not exist" });
  }

  // Known "safe to show the user" errors (validation, SSRF guard, auth) are
  // thrown as AppError/plain Error with a clear message — pass those
  // through as-is. Anything else is treated as an unexpected server error
  // (500) and its details are never sent to the client.
  const isClientError = err.statusCode && err.statusCode < 500;
  const status = err.statusCode || (err.expose ? 400 : 500);

  res.status(status).json({
    error: isClientError || err.expose ? err.message : "Something went wrong. Please try again.",
  });
}

module.exports = { notFound, errorHandler };
