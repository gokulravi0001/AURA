const { isBotOwner } = require('./permissionHelper');
const trustedService = require('./trustedService');

// Map of commandName -> Map of entityKey (userId or guildId) -> timestamp
const cooldownTimestamps = new Map();

const cooldownService = {
  /**
   * Check if a command is on cooldown for a user/guild
   * @returns {null | { remainingSeconds: string, remainingMs: number }}
   */
  checkCooldown({ commandName, userId, guildId = null, durationSeconds = 3, isGuildScoped = false, client = null, settings = null }) {
    // 1. Bypass cooldowns for Bot Developers & Trusted Members
    if (userId && isBotOwner(userId, client)) return null;
    if (userId && guildId && trustedService.isTrusted(userId, guildId, settings)) return null;

    if (!cooldownTimestamps.has(commandName)) {
      cooldownTimestamps.set(commandName, new Map());
    }

    const commandCooldowns = cooldownTimestamps.get(commandName);
    const key = isGuildScoped ? `g_${guildId}` : `u_${userId}`;
    const now = Date.now();
    const cooldownMs = durationSeconds * 1000;

    if (commandCooldowns.has(key)) {
      const expiration = commandCooldowns.get(key) + cooldownMs;
      if (now < expiration) {
        const remainingMs = expiration - now;
        const remainingSeconds = (remainingMs / 1000).toFixed(1);
        return {
          remainingSeconds,
          remainingMs
        };
      }
    }

    // Set cooldown
    commandCooldowns.set(key, now);
    setTimeout(() => commandCooldowns.delete(key), cooldownMs);
    return null;
  },

  /**
   * Clear cooldown for a user or command
   */
  clearCooldown(commandName, entityKey) {
    if (cooldownTimestamps.has(commandName)) {
      cooldownTimestamps.get(commandName).delete(entityKey);
    }
  }
};

module.exports = cooldownService;
