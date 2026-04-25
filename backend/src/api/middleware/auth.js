module.exports = function(req, res, next) {
  const expectedApiKey = process.env.API_KEY;
  if (!expectedApiKey || expectedApiKey === 'your_secret_api_key_here' || expectedApiKey === 'your_api_key_here') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized', code: 'INVALID_API_KEY' },
    });
  }
  next();
};
