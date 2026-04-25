const fs = require('fs');
const path = require('path');

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { sentAlerts: {} };
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.save();
        return this.state;
      }

      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      this.state = {
        sentAlerts: parsed.sentAlerts && typeof parsed.sentAlerts === 'object' ? parsed.sentAlerts : {},
      };
      return this.state;
    } catch (error) {
      console.warn(`Alert state okunamadi, yeni state kullaniliyor: ${error.message}`);
      this.state = { sentAlerts: {} };
      return this.state;
    }
  }

  has(key) {
    return Boolean(this.state.sentAlerts[key]);
  }

  mark(key, metadata = {}) {
    this.state.sentAlerts[key] = {
      ...metadata,
      sentAt: new Date().toISOString(),
    };
  }

  save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
  }
}

module.exports = StateStore;
