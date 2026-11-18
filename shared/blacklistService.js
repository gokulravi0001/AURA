const Blacklist = require('../models/Blacklist');
const logger = require('./logger');

// Fast in-memory sets for instant O(1) checks during message/interaction processing
const userBlacklistSet = new Set();
const guildBlacklistSet = new Set();
const blacklistDetailsMap = new Map();

const blacklistService = {
  /**
   * Initialize in-memory blacklist cache on bot boot
   */
  async init() {
    try {
      const records = await Blacklist.find({}).lean();
      userBlacklistSet.clear();
      guildBlacklistSet.clear();
      blacklistDetailsMap.clear();

      for (const item of records) {
        if (item.type === 'user') userBlacklistSet.add(item.targetId);
        if (item.type === 'guild') guildBlacklistSet.add(item.targetId);
        blacklistDetailsMap.set(item.targetId, item);
      }
      logger.info(`[Blacklist] Loaded ${records.length} blacklist records into cache.`);
    } catch (err) {
      logger.error('Failed to initialize blacklist cache:', err.message);
    }
  },

  /**
   * Fast O(1) check if user or guild is blacklisted
   */
  isBlacklisted(userId = null, guildId = null) {
    if (userId && userBlacklistSet.has(String(userId))) {
      return { blacklisted: true, type: 'user', details: blacklistDetailsMap.get(String(userId)) };
    }
    if (guildId && guildBlacklistSet.has(String(guildId))) {
      return { blacklisted: true, type: 'guild', details: blacklistDetailsMap.get(String(guildId)) };
    }
    return { blacklisted: false };
  },

  /**
   * Add entity to blacklist
   */
  async addBlacklist({ targetId, type, reason = 'Abuse / Policy Violation', blacklistedBy, blacklistedByName = 'Developer' }) {
    const id = String(targetId);
    const record = await Blacklist.findOneAndUpdate(
      { targetId: id },
      {
        targetId: id,
        type,
        reason,
        blacklistedBy,
        blacklistedByName,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    if (type === 'user') userBlacklistSet.add(id);
    if (type === 'guild') guildBlacklistSet.add(id);
    blacklistDetailsMap.set(id, record.toObject ? record.toObject() : record);

    logger.warn(`[Blacklist] Added ${type} ${id} to blacklist by ${blacklistedByName}: ${reason}`);
    return record;
  },

  /**
   * Remove entity from blacklist
   */
  async removeBlacklist(targetId) {
    const id = String(targetId);
    const removed = await Blacklist.findOneAndDelete({ targetId: id });
    userBlacklistSet.delete(id);
    guildBlacklistSet.delete(id);
    blacklistDetailsMap.delete(id);

    if (removed) {
      logger.info(`[Blacklist] Removed ${id} from blacklist.`);
    }
    return !!removed;
  },

  /**
   * List all blacklist entries
   */
  async listBlacklist() {
    return await Blacklist.find({}).sort({ createdAt: -1 }).lean();
  }
};

module.exports = blacklistService;
