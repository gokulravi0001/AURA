const Guild = require('../models/Guild');
const logger = require('./logger');
const whitelistService = require('./whitelistService');

// In-memory cache for fast lookups (5-minute TTL to minimize MongoDB roundtrip latency)
const guildCache = new Map();
const CACHE_TTL = 300000; // 5 minutes (invalidated instantly on updates)

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

      if (guild?.whitelist) {
        whitelistService.syncGuildCache(guildId, guild.whitelist);
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

      if (updated?.whitelist) {
        whitelistService.syncGuildCache(guildId, updated.whitelist);
      }

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
