const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const locales = {};
const DEFAULT_LOCALE = 'en';

// Load all JSON locale files from shared/locales
const localesDir = path.join(__dirname, 'locales');
if (fs.existsSync(localesDir)) {
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const lang = file.replace('.json', '');
    try {
      locales[lang] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
    } catch (err) {
      logger.error(`Failed to load locale file ${file}:`, err.message);
    }
  }
}

const i18n = {
  /**
   * Translate a key with optional variable interpolation
   * e.g. i18n.t('common.cooldown', { seconds: '3.5', command: 'ping' }, 'en')
   */
  t(key, params = {}, lang = DEFAULT_LOCALE) {
    const activeLang = locales[lang] ? lang : DEFAULT_LOCALE;
    const dict = locales[activeLang] || locales[DEFAULT_LOCALE] || {};

    const parts = key.split('.');
    let value = dict;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = null;
        break;
      }
    }

    if (!value || typeof value !== 'string') {
      // Fallback to English if activeLang is different
      if (activeLang !== DEFAULT_LOCALE) {
        return this.t(key, params, DEFAULT_LOCALE);
      }
      return key; // return raw key if missing
    }

    // Interpolate parameters: {user}, {level}, etc.
    let interpolated = value;
    for (const [pKey, pVal] of Object.entries(params)) {
      interpolated = interpolated.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
    }

    return interpolated;
  },

  getAvailableLanguages() {
    return Object.keys(locales);
  }
};

module.exports = i18n;
