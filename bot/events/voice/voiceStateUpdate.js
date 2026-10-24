const logger = require('../../../shared/logger');
const guildService = require('../../../shared/guildService');
const voiceManager = require('../../modules/voiceManager');
const counterService = require('../../modules/counterService');
const statsService = require('../../modules/statsService');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    try {
      const settings = await guildService.getSettings(guild.id);

      // 1. Join-to-Create Voice Channels
      if (settings?.modules?.join_to_create && settings.joinToCreate?.enabled) {
        await voiceManager.handleVoiceStateUpdate(oldState, newState, settings, client);
      }

      // 2. Server Stat Voice Counters (Update if member joined/left voice)
      if (oldState.channelId !== newState.channelId) {
        if (settings?.modules?.voice_counters && settings.voiceCounters?.enabled) {
          counterService.queueCounterUpdate(guild, settings);
        }

        // Track live voice participation stats
        statsService.updateVoiceCount(guild.id, guild);
      }
    } catch (err) {
      logger.error('Error in voiceStateUpdate event:', err);
    }
  }
};
