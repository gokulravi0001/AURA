const guildService = require('../../../shared/guildService');
const logger = require('../../../shared/logger');
const serverTagService = require('../../modules/serverTagService');

module.exports = {
  name: 'raw',
  async execute(packet, client) {
    try {
      serverTagService.handleRawPacket(packet);

      // Handle uncached member/user updates where discord.js skips userUpdate/guildMemberUpdate
      if (packet?.t !== 'GUILD_MEMBER_UPDATE' || !packet.d?.guild_id || !packet.d?.user?.id) {
        return;
      }

      const guild = client.guilds.cache.get(packet.d.guild_id);
      if (!guild) return;

      const userId = packet.d.user.id;
      const isUserCached = client.users.cache.has(userId);
      const isMemberCached = guild.members.cache.has(userId);

      // Cached users & members are handled synchronously by userUpdate / guildMemberUpdate
      if (isUserCached && isMemberCached) return;

      const settings = await guildService.getSettings(guild.id);
      if (
        settings?.modules?.server_tag_role === false ||
        !settings?.serverTagRole?.enabled ||
        !settings?.serverTagRole?.roleId
      ) {
        return;
      }

      const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const hasField = 'primary_guild' in packet.d.user;
      await serverTagService.syncMember(member, settings, client, {
        source: 'rawGuildMemberUpdate',
        primaryGuildOverride: hasField ? packet.d.user.primary_guild : undefined
      });
    } catch (err) {
      logger.error('raw event Server Tag handler error:', err.message);
    }
  }
};
