const guildService = require('../../../shared/guildService');
const tagRoleService = require('../../modules/tagRoleService');

module.exports = {
  name: 'userUpdate',
  async execute(oldUser, newUser, client) {
    if (!newUser || newUser.bot) return;

    // Check if username, displayName, or globalName changed
    const nameChanged = (oldUser.username !== newUser.username) ||
                        (oldUser.displayName !== newUser.displayName) ||
                        (oldUser.globalName !== newUser.globalName);
    if (!nameChanged) return;

    // Find all mutual guilds where tagRole is enabled
    for (const guild of client.guilds.cache.values()) {
      const settings = await guildService.getSettings(guild.id);
      if (settings?.tagRole?.enabled) {
        const member = guild.members.cache.get(newUser.id) || await guild.members.fetch(newUser.id).catch(() => null);
        if (member) {
          await tagRoleService.checkAndApply(member, settings, client, 'userUpdate');
        }
      }
    }
  }
};
