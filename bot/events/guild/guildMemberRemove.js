const guildService = require('../../../shared/guildService');
const counterService = require('../../modules/counterService');
const statsService = require('../../modules/statsService');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    if (!member || !member.guild) return;

    // Track leave in stats
    statsService.recordLeave(member.guild.id);

    // Update voice counters if enabled
    const settings = await guildService.getSettings(member.guild.id);
    if (settings?.modules?.voice_counters && settings.voiceCounters?.enabled) {
      counterService.queueCounterUpdate(member.guild, settings);
    }
  }
};
