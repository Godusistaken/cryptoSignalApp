module.exports = function(err, req, res, next) {
  console.error('HATA:', err.message);
  res.status(500).json({ success: false, error: { message: err.message } });
};