const Guild = require('../models/Guild');
const logger = require('./logger');

// In-memory cache for fast lookups
const guildCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const guildService = {
  /**
   * Get guild configuration with in-memory caching
   */
  async getSettings(guildId) {
    if (!guildId) return null;

    const cached = guildCache.get(guildId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      let guild = await Guild.findOne({ guildId });
      if (!guild) {
        guild = await Guild.create({ guildId });
        logger.info(`Created default configuration for Guild: ${guildId}`);
      }

      guildCache.set(guildId, {
        timestamp: Date.now(),
        data: guild
      });

      return guild;
    } catch (err) {
      logger.error(`Error fetching guild settings for ${guildId}:`, err.message);
      return null;
    }
  },

  /**
   * Update guild settings and invalidate cache
   */
  async updateSettings(guildId, updateData) {
    try {
      const updated = await Guild.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { new: true, upsert: true }
      );

      guildCache.set(guildId, {
        timestamp: Date.now(),
        data: updated
      });

      return updated;
    } catch (err) {
      logger.error(`Error updating guild settings for ${guildId}:`, err.message);
      throw err;
    }
  },

  /**
   * Clear cache for a guild
   */
  invalidateCache(guildId) {
    guildCache.delete(guildId);
  }
};

module.exports = guildService;
