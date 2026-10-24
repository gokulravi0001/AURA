/**
 * AURA Centralized Logger
 */

const formatTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

const logger = {
  info: (message, ...args) => {
    console.log(`\x1b[36m[${formatTimestamp()}] [INFO]\x1b[0m ${message}`, ...args);
  },
  success: (message, ...args) => {
    console.log(`\x1b[32m[${formatTimestamp()}] [SUCCESS]\x1b[0m ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`\x1b[33m[${formatTimestamp()}] [WARN]\x1b[0m ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`\x1b[31m[${formatTimestamp()}] [ERROR]\x1b[0m ${message}`, ...args);
  },
  bot: (message, ...args) => {
    console.log(`\x1b[35m[${formatTimestamp()}] [AURA-BOT]\x1b[0m ${message}`, ...args);
  },
  api: (message, ...args) => {
    console.log(`\x1b[34m[${formatTimestamp()}] [AURA-API]\x1b[0m ${message}`, ...args);
  },
  db: (message, ...args) => {
    console.log(`\x1b[33m[${formatTimestamp()}] [DATABASE]\x1b[0m ${message}`, ...args);
  }
};

module.exports = logger;
