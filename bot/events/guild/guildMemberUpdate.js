const guildService = require('../../../shared/guildService');
const logger = require('../../../shared/logger');
const serverTagService = require('../../modules/serverTagService');
const inviteService = require('../../modules/inviteService');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    try {
      if (!newMember?.guild) return;

      const settings = await guildService.getSettings(newMember.guild.id);

      // 1. Membership Screening / Server Application Acceptance Tracking
      // Logs when a member who was previously pending screening accepts the server rules/application
      if (oldMember?.pending === true && newMember?.pending === false) {
        if (settings?.modules?.invite_tracker !== false && settings?.inviteTracker?.enabled !== false) {
          await inviteService.handleMemberApplicationAccepted(newMember, settings, client);
        }
      }

      // 2. Server Tag Auto Role
      if (
        settings?.modules?.server_tag_role === false ||
        !settings?.serverTagRole?.enabled ||
        !settings?.serverTagRole?.roleId
      ) {
        return;
      }

      await serverTagService.syncMember(newMember, settings, client, {
        source: 'guildMemberUpdate'
      });
    } catch (err) {
      logger.error('guildMemberUpdate handler error:', err.message);
    }
  }
};
