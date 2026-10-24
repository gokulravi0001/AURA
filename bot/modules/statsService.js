const ServerStats = require('../../models/ServerStats');
const logger = require('../../shared/logger');

const getTodayString = () => new Date().toISOString().split('T')[0];

const statsService = {
  /**
   * Record message event
   */
  async recordMessage(guildId) {
    try {
      const today = getTodayString();
      await ServerStats.updateOne(
        { guildId, date: today },
        { $inc: { messagesRecorded: 1 } },
        { upsert: true }
      );
    } catch (err) {
      // Non-critical background task
    }
  },

  /**
   * Record member join event
   */
  async recordJoin(guildId) {
    try {
      const today = getTodayString();
      await ServerStats.updateOne(
        { guildId, date: today },
        { $inc: { joinsRecorded: 1 } },
        { upsert: true }
      );
    } catch (err) {}
  },

  /**
   * Record member leave event
   */
  async recordLeave(guildId) {
    try {
      const today = getTodayString();
      await ServerStats.updateOne(
        { guildId, date: today },
        { $inc: { leavesRecorded: 1 } },
        { upsert: true }
      );
    } catch (err) {}
  },

  /**
   * Update active voice counts & guild member snapshots
   */
  async updateVoiceCount(guildId, guild) {
    try {
      const today = getTodayString();
      let voiceCount = 0;
      guild.channels.cache.forEach(channel => {
        if (channel.isVoiceBased()) {
          voiceCount += channel.members.filter(m => !m.user.bot).size;
        }
      });

      if (guild.members.cache.size < (guild.memberCount || 0)) {
        await guild.members.fetch().catch(() => {});
      }

      const totalMembers = guild.memberCount || guild.members.cache.size || 0;
      const botCount = guild.members.cache.filter(m => m.user.bot).size;
      const humanCount = Math.max(0, totalMembers - botCount);

      await ServerStats.updateOne(
        { guildId, date: today },
        {
          $set: {
            totalMembers,
            humans: humanCount,
            bots: botCount,
            voiceActive: voiceCount
          }
        },
        { upsert: true }
      );
    } catch (err) {}
  },

  /**
   * Fetch 7-day or 30-day analytics for Dashboard
   */
  async getGuildHistory(guildId, days = 7) {
    try {
      const records = await ServerStats.find({ guildId })
        .sort({ date: -1 })
        .limit(days)
        .lean();

      return records.reverse();
    } catch (err) {
      logger.error('Error fetching server stats history:', err.message);
      return [];
    }
  }
};

module.exports = statsService;
