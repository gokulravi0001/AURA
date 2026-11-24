const guildService = require('../../../shared/guildService');
const counterService = require('../../modules/counterService');
const statsService = require('../../modules/statsService');
const inviteService = require('../../modules/inviteService');
const serverTagService = require('../../modules/serverTagService');
const voiceStatusService = require('../../modules/voiceStatusService');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    if (!member || !member.guild) return;

    // Track join in stats
    statsService.recordJoin(member.guild.id);

    // Queue dynamic VC status update if dynamic online/member stats are active
    voiceStatusService.queueDynamicStatusUpdate(member.guild, client);

    // Fetch guild settings
    const settings = await guildService.getSettings(member.guild.id);

    // 1. Update voice counters if enabled
    if (settings?.modules?.voice_counters && settings.voiceCounters?.enabled) {
      counterService.queueCounterUpdate(member.guild, settings);
    }

    // 2. Track Invites
    if (settings?.modules?.invite_tracker !== false && settings?.inviteTracker?.enabled !== false) {
      await inviteService.handleMemberJoin(member, settings, client);
    }

    // 3. Server Tag Auto Role check
    if (settings?.modules?.server_tag_role !== false && settings?.serverTagRole?.enabled && settings?.serverTagRole?.roleId) {
      await serverTagService.syncMember(member, settings, client, { source: 'guildMemberAdd' });
    }
  }
};
