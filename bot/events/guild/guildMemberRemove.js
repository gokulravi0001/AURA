const guildService = require('../../../shared/guildService');
const counterService = require('../../modules/counterService');
const statsService = require('../../modules/statsService');
const inviteService = require('../../modules/inviteService');
const serverTagService = require('../../modules/serverTagService');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    if (!member || !member.guild) return;

    // Track leave in stats
    statsService.recordLeave(member.guild.id);

    // Fetch guild settings
    const settings = await guildService.getSettings(member.guild.id);

    // 1. Update voice counters if enabled
    if (settings?.modules?.voice_counters && settings.voiceCounters?.enabled) {
      counterService.queueCounterUpdate(member.guild, settings);
    }

    // 2. Track Member Leave for Invites
    if (settings?.modules?.invite_tracker !== false && settings?.inviteTracker?.enabled !== false) {
      await inviteService.handleMemberLeave(member, settings, client);
    }

    // 3. Handle Server Tag Auto Role cleanup / metric refresh safely
    if (settings?.modules?.server_tag_role !== false && settings?.serverTagRole?.enabled) {
      await serverTagService.handleMemberLeave(member, settings, client);
    }
  }
};
