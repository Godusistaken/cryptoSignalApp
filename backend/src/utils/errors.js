class AppError extends Error {
  constructor(message, status = 500, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.expose = options.expose ?? status < 500;
    this.code = options.code;
  }
}

module.exports = { AppError };
