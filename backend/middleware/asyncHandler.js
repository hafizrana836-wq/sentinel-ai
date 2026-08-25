// Place this file at: middleware/asyncHandler.js
/**
 * Express does not catch rejected promises from async handlers on its own.
 * Wrap every async controller with this so errors always reach next(err)
 * and get a clean JSON response instead of an unhandled rejection.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
