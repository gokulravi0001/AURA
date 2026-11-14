const guildService = require('../../../shared/guildService');
const logger = require('../../../shared/logger');
const serverTagService = require('../../modules/serverTagService');

module.exports = {
  name: 'guildMemberAvailable',
  async execute(member, client) {
    try {
      if (!member?.guild) return;

      const settings = await guildService.getSettings(member.guild.id);
      if (
        settings?.modules?.server_tag_role === false ||
        !settings?.serverTagRole?.enabled ||
        !settings?.serverTagRole?.roleId
      ) {
        return;
      }

      await serverTagService.syncMember(member, settings, client, {
        source: 'guildMemberAvailable'
      });
    } catch (err) {
      logger.error('guildMemberAvailable Server Tag handler error:', err.message);
    }
  }
};
