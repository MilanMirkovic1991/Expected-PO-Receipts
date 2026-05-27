import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
import { isDwError } from '../dwClient/http.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isDwError(err)) {
    const status =
      err.code === 'DW_UNREACHABLE' ? 503 :
      err.code === 'AUTH_FAILED' ? 401 :
      err.code === 'NOT_AUTHENTICATED' ? 401 :
      502;
    logger.warn({ code: err.code, message: err.message }, 'dw error response');
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'INTERNAL', message: err?.message ?? 'unknown' });
};
