// ─────────────────────────────────────────────────────
// src/middleware/errorHandler.js — Global error handler
// ─────────────────────────────────────────────────────
import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * Global error handler middleware.
 * Never exposes stack traces in responses.
 */
export function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;

  if (config.nodeEnv === 'production') {
    return res.status(statusCode).json({
      error: 'Internal server error',
    });
  }

  // Development: return error message (no stack trace)
  return res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
}

export default errorHandler;
