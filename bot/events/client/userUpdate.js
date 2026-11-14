const guildService = require('../../../shared/guildService');
const logger = require('../../../shared/logger');
const serverTagService = require('../../modules/serverTagService');

function didPrimaryGuildChange(oldUser, newUser) {
  if (oldUser?.partial) return true;

  const oldPg = oldUser?.primaryGuild ?? null;
  const newPg = newUser?.primaryGuild ?? null;

  if (!oldPg && !newPg) return false;
  if (!oldPg || !newPg) return true;

  return (
    oldPg.identityGuildId !== newPg.identityGuildId ||
    oldPg.identityEnabled !== newPg.identityEnabled ||
    oldPg.tag !== newPg.tag ||
    oldPg.badge !== newPg.badge
  );
}

module.exports = {
  name: 'userUpdate',
  async execute(oldUser, newUser, client) {
    try {
      if (!newUser?.id || !didPrimaryGuildChange(oldUser, newUser)) return;

      const oldTargetGuildId = oldUser?.primaryGuild?.identityGuildId || null;
      const newTargetGuildId = newUser?.primaryGuild?.identityGuildId || null;

      for (const guild of client.guilds.cache.values()) {
        const memberInCache = guild.members.cache.has(newUser.id);
        const matchesOldOrNewTagGuild =
          guild.id === oldTargetGuildId || guild.id === newTargetGuildId;

        if (!memberInCache && !matchesOldOrNewTagGuild) continue;

        const settings = await guildService.getSettings(guild.id);
        if (
          settings?.modules?.server_tag_role === false ||
          !settings?.serverTagRole?.enabled ||
          !settings?.serverTagRole?.roleId
        ) {
          continue;
        }

        if (!settings.serverTagRole.includeBots && newUser.bot) continue;

        const member =
          guild.members.cache.get(newUser.id) ||
          (await guild.members.fetch(newUser.id).catch(() => null));
        if (!member) continue;

        await serverTagService.syncMember(member, settings, client, {
          source: 'userUpdate'
        });
      }
    } catch (err) {
      logger.error('userUpdate Server Tag handler error:', err.message);
    }
  }
};
