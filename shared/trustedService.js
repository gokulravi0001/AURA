const Guild = require('../models/Guild');
const logger = require('./logger');

// Fast in-memory cache: guildId -> Set(userId)
const guildTrustedCache = new Map();

const trustedService = {
  /**
   * Check if a user is a Trusted Member in a guild.
   * Trusted Members are immune to all disruptive commands AND can run all commands without admin/owner perms.
   *
   * @param {string} userId
   * @param {string} [guildId]
   * @param {object} [settings]
   * @returns {boolean}
   */
  isTrusted(userId, guildId = null, settings = null) {
    if (!userId) return false;
    const uid = String(userId);

    // 1. Check settings.trustedMembers if provided
    if (settings && Array.isArray(settings.trustedMembers)) {
      if (settings.trustedMembers.includes(uid)) return true;
    }

    // 2. Fallback to settings.whitelist for backwards compatibility
    if (settings && Array.isArray(settings.whitelist)) {
      if (settings.whitelist.includes(uid)) return true;
    }

    // 3. Check in-memory guild cache
    if (guildId) {
      const set = guildTrustedCache.get(guildId);
      if (set && set.has(uid)) return true;
    }

    return false;
  },

  /**
   * Add a trusted member to a guild
   *
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async addTrusted(guildId, userId) {
    if (!guildId || !userId) return [];
    const uid = String(userId);

    const doc = await Guild.findOneAndUpdate(
      { guildId },
      { $addToSet: { trustedMembers: uid } },
      { new: true, upsert: true }
    );

    const updated = doc.trustedMembers || [];
    let set = guildTrustedCache.get(guildId);
    if (!set) {
      set = new Set();
      guildTrustedCache.set(guildId, set);
    }
    set.add(uid);

    logger.info(`[Trusted] Added trusted member ${uid} in guild ${guildId}`);
    return updated;
  },

  /**
   * Remove a trusted member from a guild
   *
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async removeTrusted(guildId, userId) {
    if (!guildId || !userId) return [];
    const uid = String(userId);

    const doc = await Guild.findOneAndUpdate(
      { guildId },
      { $pull: { trustedMembers: uid, whitelist: uid } },
      { new: true }
    );

    const updated = doc?.trustedMembers || [];
    const set = guildTrustedCache.get(guildId);
    if (set) {
      set.delete(uid);
    }

    logger.info(`[Trusted] Removed trusted member ${uid} from guild ${guildId}`);
    return updated;
  },

  /**
   * Get all trusted members for a guild
   *
   * @param {string} guildId
   * @param {object} [settings]
   * @returns {string[]}
   */
  getTrusted(guildId, settings = null) {
    if (!guildId) return [];
    const cached = guildTrustedCache.get(guildId);
    if (cached) {
      return Array.from(cached);
    }
    const list = settings?.trustedMembers || settings?.whitelist || [];
    guildTrustedCache.set(guildId, new Set(list));
    return list;
  },

  /**
   * Clear all trusted members from a guild
   *
   * @param {string} guildId
   * @returns {Promise<boolean>}
   */
  async clearTrusted(guildId) {
    if (!guildId) return false;
    await Guild.findOneAndUpdate(
      { guildId },
      { $set: { trustedMembers: [], whitelist: [] } }
    );
    const set = guildTrustedCache.get(guildId);
    if (set) set.clear();
    logger.info(`[Trusted] Cleared all trusted members in guild ${guildId}`);
    return true;
  }
};

module.exports = trustedService;
