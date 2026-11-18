/**
 * AURA Centralized Multi-Level Logger & Sanitizer
 */

const SENSITIVE_PATTERNS = [
  /([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,})/g,     // Discord Bot Token
  /mongodb(\+srv)?:\/\/[^:]+:([^@]+)@/g,                             // MongoDB URI Password
  /https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g,      // Discord Webhook URL
  /client_secret=[a-zA-Z0-9_-]+/g                                      // OAuth2 Client Secret
];

/**
 * Mask sensitive credentials from strings and objects
 */
function maskSensitive(input) {
  if (typeof input === 'string') {
    let sanitized = input;
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,})/g, 'DISCORD_TOKEN_REDACTED');
    sanitized = sanitized.replace(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/g, 'mongodb$1://$2:****@');
    sanitized = sanitized.replace(/https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, 'WEBHOOK_URL_REDACTED');
    sanitized = sanitized.replace(/client_secret=[a-zA-Z0-9_-]+/g, 'client_secret=REDACTED');
    return sanitized;
  }

  if (input instanceof Error) {
    input.message = maskSensitive(input.message);
    if (input.stack) {
      input.stack = maskSensitive(input.stack);
    }
    return input;
  }

  if (typeof input === 'object' && input !== null) {
    try {
      return JSON.parse(maskSensitive(JSON.stringify(input)));
    } catch (_) {
      return input;
    }
  }

  return input;
}

const formatTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

// Error deduplication cache (5-minute window)
const recentErrorCache = new Map();
const ERROR_DEDUP_WINDOW_MS = 300000;

const shouldSuppressDuplicate = (errorKey) => {
  const lastTime = recentErrorCache.get(errorKey);
  const now = Date.now();
  if (lastTime && now - lastTime < ERROR_DEDUP_WINDOW_MS) {
    return true;
  }
  recentErrorCache.set(errorKey, now);
  return false;
};

// Clean cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of recentErrorCache.entries()) {
    if (now - time > ERROR_DEDUP_WINDOW_MS) {
      recentErrorCache.delete(key);
    }
  }
}, 600000);

const logToDatabase = async (level, scope, message, context = {}) => {
  try {
    const SystemLog = require('../models/SystemLog');
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      await SystemLog.create({
        level,
        scope,
        message: maskSensitive(message),
        guildId: context.guildId || null,
        userId: context.userId || null,
        commandName: context.commandName || null,
        errorDetails: context.error ? {
          name: context.error.name,
          message: maskSensitive(context.error.message),
          stack: maskSensitive(context.error.stack)
        } : null,
        metadata: maskSensitive(context.metadata || {})
      }).catch(() => {});
    }
  } catch (_) {
    // Non-critical, ignore if DB is offline
  }
};

const logger = {
  debug: (message, ...args) => {
    if (process.env.LOG_LEVEL === 'DEBUG' || process.env.NODE_ENV !== 'production') {
      const sanitized = maskSensitive(message);
      console.log(`\x1b[90m[${formatTimestamp()}] [DEBUG]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
    }
  },

  info: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.log(`\x1b[36m[${formatTimestamp()}] [INFO]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  success: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.log(`\x1b[32m[${formatTimestamp()}] [SUCCESS]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  warn: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.warn(`\x1b[33m[${formatTimestamp()}] [WARN]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  error: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.error(`\x1b[31m[${formatTimestamp()}] [ERROR]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));

    // Async record to DB
    const firstArg = args[0];
    const errObj = firstArg instanceof Error ? firstArg : null;
    logToDatabase('ERROR', 'SYSTEM', sanitized, { error: errObj });
  },

  bot: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.log(`\x1b[35m[${formatTimestamp()}] [AURA-BOT]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  api: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.log(`\x1b[34m[${formatTimestamp()}] [AURA-API]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  db: (message, ...args) => {
    const sanitized = maskSensitive(message);
    console.log(`\x1b[33m[${formatTimestamp()}] [DATABASE]\x1b[0m ${sanitized}`, ...args.map(maskSensitive));
  },

  /**
   * Log an error with full context (Guild, User, Command, Stack) and deduplication
   */
  logError: async ({ scope = 'SYSTEM', message, error = null, guildId = null, userId = null, commandName = null, metadata = {} } = {}) => {
    const errorKey = `${scope}_${guildId || ''}_${commandName || ''}_${error?.message || message}`;
    const isDuplicate = shouldSuppressDuplicate(errorKey);

    const sanitizedMsg = maskSensitive(message || error?.message || 'Unknown error occurred');
    if (!isDuplicate) {
      console.error(`\x1b[31m[${formatTimestamp()}] [${scope}-ERROR]\x1b[0m ${sanitizedMsg}`, error ? maskSensitive(error.stack) : '');
    }

    await logToDatabase('ERROR', scope, sanitizedMsg, {
      guildId,
      userId,
      commandName,
      error,
      metadata
    });
  },

  maskSensitive,
  shouldSuppressDuplicate
};

module.exports = logger;
