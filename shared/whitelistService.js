const Guild = require('../models/Guild');
const GlobalWhitelist = require('../models/GlobalWhitelist');
const logger = require('./logger');

// Fast in-memory sets & maps
const globalWhitelistSet = new Set();
const guildWhitelistCache = new Map(); // guildId -> Set(userId)

const whitelistService = {
  /**
   * Initialize and pre-load global whitelist into memory
   */
  async init() {
    try {
      const records = await GlobalWhitelist.find({}).lean();
      globalWhitelistSet.clear();
      for (const r of records) {
        globalWhitelistSet.add(r.userId);
      }
      logger.info(`Loaded ${globalWhitelistSet.size} globally whitelisted users into memory.`);
    } catch (err) {
      logger.error('Failed to load global whitelist:', err.message);
    }
  },

  /**
   * Check if a user is whitelisted (globally or within a specific guild)
   *
   * @param {string} userId
   * @param {string} [guildId]
   * @param {object} [settings]
   * @returns {boolean}
   */
  isWhitelisted(userId, guildId = null, settings = null) {
    if (!userId) return false;
    const uid = String(userId);

    // 1. Check Global Whitelist (In-memory Set)
    if (globalWhitelistSet.has(uid)) return true;

    // 2. Check settings.whitelist if available
    if (settings && Array.isArray(settings.whitelist)) {
      if (settings.whitelist.includes(uid)) return true;
    }

    // 3. Check in-memory guild cache
    if (guildId) {
      const guildSet = guildWhitelistCache.get(guildId);
      if (guildSet && guildSet.has(uid)) return true;
    }

    return false;
  },

  /**
   * Add a user to a server's whitelist
   *
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async addServerWhitelist(guildId, userId) {
    const uid = String(userId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $addToSet: { whitelist: uid } },
      { new: true, upsert: true }
    );

    // Update in-memory cache
    let set = guildWhitelistCache.get(guildId);
    if (!set) {
      set = new Set();
      guildWhitelistCache.set(guildId, set);
    }
    set.add(uid);

    // Invalidate guildService cache
    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.whitelist || [];
  },

  /**
   * Remove a user from a server's whitelist
   *
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async removeServerWhitelist(guildId, userId) {
    const uid = String(userId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $pull: { whitelist: uid } },
      { new: true, upsert: true }
    );

    // Update in-memory cache
    const set = guildWhitelistCache.get(guildId);
    if (set) {
      set.delete(uid);
    }

    // Invalidate guildService cache
    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.whitelist || [];
  },

  /**
   * Clear all server whitelisted users
   *
   * @param {string} guildId
   * @returns {Promise<string[]>}
   */
  async clearServerWhitelist(guildId) {
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $set: { whitelist: [] } },
      { new: true, upsert: true }
    );

    guildWhitelistCache.set(guildId, new Set());

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return [];
  },

  /**
   * Add a user to the global whitelist (Bot Developers only)
   *
   * @param {string} userId
   * @param {string} addedBy
   * @param {string} [tag]
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  async addGlobalWhitelist(userId, addedBy, tag = null, reason = 'Bot Developer Whitelist') {
    const uid = String(userId);
    const doc = await GlobalWhitelist.findOneAndUpdate(
      { userId: uid },
      { $set: { userId: uid, addedBy, tag, reason, createdAt: new Date() } },
      { upsert: true, new: true }
    );

    globalWhitelistSet.add(uid);
    return doc;
  },

  /**
   * Remove a user from the global whitelist
   *
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async removeGlobalWhitelist(userId) {
    const uid = String(userId);
    await GlobalWhitelist.deleteOne({ userId: uid });
    globalWhitelistSet.delete(uid);
    return true;
  },

  /**
   * Get server whitelist
   *
   * @param {string} guildId
   * @returns {Promise<string[]>}
   */
  async getServerWhitelist(guildId) {
    const guild = await Guild.findOne({ guildId }).lean();
    return guild?.whitelist || [];
  },

  /**
   * Get all global whitelisted users
   *
   * @returns {Promise<object[]>}
   */
  async getGlobalWhitelist() {
    return await GlobalWhitelist.find({}).lean();
  },

  /**
   * Synchronize guild cache from settings object
   *
   * @param {string} guildId
   * @param {string[]} whitelist
   */
  syncGuildCache(guildId, whitelist) {
    if (guildId && Array.isArray(whitelist)) {
      guildWhitelistCache.set(guildId, new Set(whitelist));
    }
  }
};

module.exports = whitelistService;
