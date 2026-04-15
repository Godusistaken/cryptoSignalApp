const logger = require('../../utils/logger');

module.exports = function(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error(`HATA [400]: ${err.message}`);
    return res.status(400).json({
      success: false,
      error: {
        message: 'Gecersiz JSON body.',
        code: 'INVALID_JSON',
      },
    });
  }

  const status = err.status || 500;
  const safeMessage = err.expose ? err.message : 'Sunucu hatasi';

  logger.error(`HATA [${status}]: ${err.stack || err.message}`);

  res.status(status).json({
    success: false,
    error: {
      message: safeMessage,
      code: err.code || 'INTERNAL_ERROR',
    },
  });
};
