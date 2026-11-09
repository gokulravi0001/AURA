const Guild = require('../models/Guild');
const logger = require('./logger');
const immunityService = require('./immunityService');
const { isOwnerOrAdmin } = require('./permissionHelper');

// In-memory active rules
// channelRules: Map<channelId, { guildId, channelId, expiresAt: number|null, delaySeconds: number, timeoutId: any } >
const channelRules = new Map();

// userRules: Map<`${guildId}:${userId}`, { guildId, userId, channelId: string|null, expiresAt: number|null, timeoutId: any } >
const userRules = new Map();

/**
 * Parse a user duration string into milliseconds.
 * Supports: 30s, 5m, 1h, 2d, 1w, or plain number (defaults to minutes).
 * Special keywords: 'stop', 'off', 'cancel', 'disable', '0' -> { stop: true, ms: 0 }
 * 'forever', 'perm', 'permanent' -> { stop: false, ms: null }
 */
function parseDuration(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();

  if (['stop', 'off', 'cancel', 'disable', 'none', '0', 'remove', 'halt'].includes(str)) {
    return { stop: true, ms: 0 };
  }

  if (['forever', 'perm', 'permanent', 'infinite', 'always'].includes(str)) {
    return { stop: false, ms: null };
  }

  const match = str.match(/^(\d+)\s*([a-z]+)?$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  if (isNaN(value) || value <= 0) return null;

  const unit = (match[2] || 'm').toLowerCase();

  let ms = 0;
  if (['s', 'sec', 'secs', 'second', 'seconds'].includes(unit)) {
    ms = value * 1000;
  } else if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unit)) {
    ms = value * 60 * 1000;
  } else if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unit)) {
    ms = value * 60 * 60 * 1000;
  } else if (['d', 'day', 'days'].includes(unit)) {
    ms = value * 24 * 60 * 60 * 1000;
  } else if (['w', 'week', 'weeks'].includes(unit)) {
    ms = value * 7 * 24 * 60 * 60 * 1000;
  } else {
    return null;
  }

  // Cap at 30 days
  const maxMs = 30 * 24 * 60 * 60 * 1000;
  if (ms > maxMs) ms = maxMs;

  return { stop: false, ms };
}

/**
 * Format milliseconds into a readable string (e.g. "15 minutes", "2 hours 30 seconds")
 */
function formatDuration(ms) {
  if (ms === null) return 'Permanent (until manually stopped)';
  if (ms <= 0) return 'Expired';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || `${totalSeconds}s`;
}

/**
 * Format remaining time until an epoch timestamp
 */
function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return 'Permanent';
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';
  return formatDuration(remaining);
}

const autoDeleteService = {
  parseDuration,
  formatDuration,
  formatTimeRemaining,

  /**
   * Initialize and restore active auto-delete rules from database on bot startup.
   */
  async init(client = null) {
    try {
      const guilds = await Guild.find({
        $or: [
          { 'autoDelete.channels.0': { $exists: true } },
          { 'autoDelete.users.0': { $exists: true } }
        ]
      }).lean();

      let loadedChannels = 0;
      let loadedUsers = 0;
      const now = Date.now();

      for (const g of guilds) {
        const guildId = g.guildId;

        // Restore channel rules
        if (Array.isArray(g.autoDelete?.channels)) {
          for (const ch of g.autoDelete.channels) {
            const expTime = ch.expiresAt ? new Date(ch.expiresAt).getTime() : null;
            if (expTime && expTime <= now) {
              // Already expired, clean from DB
              await Guild.updateOne({ guildId }, { $pull: { 'autoDelete.channels': { channelId: ch.channelId } } }).catch(() => {});
              continue;
            }

            const rule = {
              guildId,
              channelId: ch.channelId,
              expiresAt: expTime,
              delaySeconds: ch.delaySeconds || 0,
              createdBy: ch.createdBy,
              timeoutId: null
            };

            if (expTime) {
              const delay = expTime - now;
              rule.timeoutId = setTimeout(() => {
                autoDeleteService.removeChannelRule(guildId, ch.channelId).catch(() => {});
              }, delay);
            }

            channelRules.set(ch.channelId, rule);
            loadedChannels++;
          }
        }

        // Restore user rules
        if (Array.isArray(g.autoDelete?.users)) {
          for (const u of g.autoDelete.users) {
            const expTime = u.expiresAt ? new Date(u.expiresAt).getTime() : null;
            if (expTime && expTime <= now) {
              // Already expired, clean from DB
              await Guild.updateOne({ guildId }, { $pull: { 'autoDelete.users': { userId: u.userId, channelId: u.channelId } } }).catch(() => {});
              continue;
            }

            const key = `${guildId}:${u.userId}`;
            const rule = {
              guildId,
              userId: u.userId,
              channelId: u.channelId || null,
              expiresAt: expTime,
              createdBy: u.createdBy,
              timeoutId: null
            };

            if (expTime) {
              const delay = expTime - now;
              rule.timeoutId = setTimeout(() => {
                autoDeleteService.removeUserRule(guildId, u.userId).catch(() => {});
              }, delay);
            }

            userRules.set(key, rule);
            loadedUsers++;
          }
        }
      }

      logger.info(`Auto-Delete Service initialized: ${loadedChannels} active channel rules, ${loadedUsers} active user rules.`);
    } catch (err) {
      logger.error('Error initializing Auto-Delete Service:', err.message);
    }
  },

  /**
   * Set or update auto-delete rule on a channel.
   *
   * @param {string} guildId
   * @param {string} channelId
   * @param {number|null} durationMs - Milliseconds until auto-delete expires, or null for permanent
   * @param {number} delaySeconds - Seconds to wait after message is posted before deleting (default 0: instant)
   * @param {string|null} createdBy - User ID who set the rule
   */
  async setChannelRule(guildId, channelId, durationMs, delaySeconds = 0, createdBy = null) {
    // Clear existing timer if any
    const existing = channelRules.get(channelId);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);

    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const rule = {
      guildId,
      channelId,
      expiresAt,
      delaySeconds: Math.max(0, parseInt(delaySeconds, 10) || 0),
      createdBy,
      timeoutId: null
    };

    if (expiresAt) {
      rule.timeoutId = setTimeout(() => {
        autoDeleteService.removeChannelRule(guildId, channelId).catch(() => {});
      }, durationMs);
    }

    channelRules.set(channelId, rule);

    // Persist to MongoDB
    await Guild.updateOne(
      { guildId },
      { $pull: { 'autoDelete.channels': { channelId } } }
    ).catch(() => {});

    await Guild.updateOne(
      { guildId },
      {
        $push: {
          'autoDelete.channels': {
            channelId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            delaySeconds: rule.delaySeconds,
            createdBy
          }
        }
      },
      { upsert: true }
    );

    return {
      success: true,
      expiresAt,
      delaySeconds: rule.delaySeconds,
      formattedDuration: formatDuration(durationMs)
    };
  },

  /**
   * Remove auto-delete rule from a channel.
   */
  async removeChannelRule(guildId, channelId) {
    const existing = channelRules.get(channelId);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);
    channelRules.delete(channelId);

    await Guild.updateOne(
      { guildId },
      { $pull: { 'autoDelete.channels': { channelId } } }
    ).catch(() => {});

    return { success: true };
  },

  /**
   * Set or update auto-delete (shadow-mute / shredder) on a user.
   * Checks Immunity: Immune members cannot have auto-delete applied to them.
   *
   * @param {string} guildId
   * @param {string} userId
   * @param {number|null} durationMs - Milliseconds until auto-delete expires, or null for permanent
   * @param {string|null} channelId - Optional channel restriction, null for all channels in guild
   * @param {string|null} createdBy - User ID who set the rule
   * @param {import('discord.js').Guild} [guild]
   * @param {import('discord.js').Client} [client]
   */
  async setUserRule(guildId, userId, durationMs, channelId = null, createdBy = null, delayMs = 800) {
    const uid = String(userId).replace(/[<@!>]/g, '');

    // Check Permanent Absolute Immunity: User 1487429529717706842 cannot be targeted
    if (immunityService.isAbsoluteImmune(uid)) {
      return {
        success: false,
        error: `🛡️ **Immunity Protected**: <@${uid}> possesses **Permanent Absolute Immunity** and cannot have autodlt applied to them.`
      };
    }

    const key = `${guildId}:${uid}`;
    const existing = userRules.get(key);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);

    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const rule = {
      guildId,
      userId: uid,
      channelId: channelId || null,
      expiresAt,
      createdBy,
      delayMs,
      timeoutId: null
    };

    if (expiresAt) {
      rule.timeoutId = setTimeout(() => {
        autoDeleteService.removeUserRule(guildId, uid).catch(() => {});
      }, durationMs);
    }

    userRules.set(key, rule);

    // Persist to MongoDB
    await Guild.updateOne(
      { guildId },
      { $pull: { 'autoDelete.users': { userId: uid } } }
    ).catch(() => {});

    await Guild.updateOne(
      { guildId },
      {
        $push: {
          'autoDelete.users': {
            userId: uid,
            channelId: channelId || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy
          }
        }
      },
      { upsert: true }
    );

    return {
      success: true,
      expiresAt,
      channelId: rule.channelId,
      formattedDuration: formatDuration(durationMs)
    };
  },

  /**
   * Remove auto-delete rule from a user.
   */
  async removeUserRule(guildId, userId) {
    const uid = String(userId).replace(/[<@!>]/g, '');
    const key = `${guildId}:${uid}`;
    const existing = userRules.get(key);
    if (existing?.timeoutId) clearTimeout(existing.timeoutId);
    userRules.delete(key);

    await Guild.updateOne(
      { guildId },
      { $pull: { 'autoDelete.users': { userId: uid } } }
    ).catch(() => {});

    return { success: true };
  },

  /**
   * Clear all auto-delete rules (channels and users) for a guild.
   */
  async clearAll(guildId) {
    // Clear channel rules
    for (const [chId, rule] of channelRules.entries()) {
      if (rule.guildId === guildId) {
        if (rule.timeoutId) clearTimeout(rule.timeoutId);
        channelRules.delete(chId);
      }
    }

    // Clear user rules
    for (const [key, rule] of userRules.entries()) {
      if (rule.guildId === guildId) {
        if (rule.timeoutId) clearTimeout(rule.timeoutId);
        userRules.delete(key);
      }
    }

    await Guild.updateOne(
      { guildId },
      { $set: { 'autoDelete.channels': [], 'autoDelete.users': [] } }
    ).catch(() => {});

    return { success: true };
  },

  /**
   * Get all active auto-delete rules for a guild.
   */
  getActiveRules(guildId) {
    const channels = [];
    const users = [];
    const now = Date.now();

    for (const rule of channelRules.values()) {
      if (rule.guildId === guildId) {
        if (rule.expiresAt && rule.expiresAt <= now) continue;
        channels.push({
          channelId: rule.channelId,
          expiresAt: rule.expiresAt,
          delaySeconds: rule.delaySeconds,
          timeRemaining: formatTimeRemaining(rule.expiresAt),
          createdBy: rule.createdBy
        });
      }
    }

    for (const rule of userRules.values()) {
      if (rule.guildId === guildId) {
        if (rule.expiresAt && rule.expiresAt <= now) continue;
        users.push({
          userId: rule.userId,
          channelId: rule.channelId,
          expiresAt: rule.expiresAt,
          timeRemaining: formatTimeRemaining(rule.expiresAt),
          createdBy: rule.createdBy
        });
      }
    }

    return { channels, users };
  },

  /**
   * Check incoming message in messageCreate event.
   * If matched by channel rule or user rule, deletes the message and returns true.
   *
   * @param {import('discord.js').Message} message
   * @param {object} [settings]
   * @param {import('discord.js').Client} [client]
   * @returns {Promise<boolean>} True if the message was handled/deleted
   */
  async handleMessage(message, settings = null, client = null) {
    if (!message || !message.guild || !message.author) return false;

    // Never auto-delete bot messages or client messages
    if (message.author.bot || message.author.id === client?.user?.id) return false;

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const channelId = message.channel.id;

    // 1. Permanent Absolute Immunity Bypass:
    // Only the primary bot developer (1487429529717706842) is permanently immune and never auto-deleted
    if (immunityService.isAbsoluteImmune(authorId)) {
      return false;
    }

    // 2. Command Management Bypass:
    // If the message is a command executed by an Owner / Admin / Whitelisted user,
    // let it execute so they can configure or turn off auto-delete!
    const prefix = settings?.prefix || '+';
    if (message.content.startsWith(prefix)) {
      if (isOwnerOrAdmin(message.member || message.author, message.guild, client, settings)) {
        return false;
      }
    }

    const now = Date.now();

    // 3. Check User Auto-Delete (Shadow-Mute / Message Shredder) Rule FIRST
    const userKey = `${guildId}:${authorId}`;
    const uRule = userRules.get(userKey);
    if (uRule) {
      if (uRule.expiresAt && uRule.expiresAt <= now) {
        autoDeleteService.removeUserRule(guildId, authorId).catch(() => {});
      } else {
        // If channel restriction is set, verify channel matches
        if (!uRule.channelId || uRule.channelId === channelId) {
          // Allow message to appear and then delete within a second (~800ms)
          const delay = uRule.delayMs !== undefined ? uRule.delayMs : 800;
          setTimeout(async () => {
            await message.delete().catch(err => {
              logger.warn(`Could not auto-delete message from ${authorId}: ${err.message}`);
            });
          }, delay);
          return true;
        }
      }
    }

    // 4. Check Channel Auto-Delete Rule
    const chRule = channelRules.get(channelId);
    if (chRule) {
      // Exclude immune members and administrators from channel auto-delete
      if (immunityService.isImmune(message.member || message.author, message.guild, client, settings)) {
        return false;
      }

      if (chRule.expiresAt && chRule.expiresAt <= now) {
        autoDeleteService.removeChannelRule(guildId, channelId).catch(() => {});
      } else {
        const delay = chRule.delaySeconds > 0 ? (chRule.delaySeconds * 1000) : 800;
        setTimeout(async () => {
          await message.delete().catch(err => {
            logger.warn(`Could not auto-delete channel message in #${channelId}: ${err.message}`);
          });
        }, delay);
        return true;
      }
    }

    return false;
  }
};

module.exports = autoDeleteService;
