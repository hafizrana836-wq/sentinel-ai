// Place this file at: utils/errors.js
//
// Every controller used to define its own local `badRequest()` helper.
// Centralizing it means one place to change status-code/`expose` behavior,
// and it plugs directly into middleware/errorHandler.js's `err.expose` /
// `err.statusCode` contract.

class AppError extends Error {
  constructor(message, statusCode = 500, expose = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.expose = expose;
    Error.captureStackTrace?.(this, AppError);
  }
}

const badRequest = (message) => new AppError(message, 400);
const unauthorized = (message = "Authentication required") => new AppError(message, 401);
const forbidden = (message = "Forbidden") => new AppError(message, 403);
const notFoundError = (message = "Not found") => new AppError(message, 404);
const conflict = (message) => new AppError(message, 409);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFoundError, conflict };
