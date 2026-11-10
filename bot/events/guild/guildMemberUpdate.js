const guildService = require('../../../shared/guildService');
const tagRoleService = require('../../modules/tagRoleService');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    if (!newMember || !newMember.guild) return;

    // Fetch guild settings
    const settings = await guildService.getSettings(newMember.guild.id).catch(() => null);

    // Check if member adopted or dropped the server tag
    await tagRoleService.checkAndApply(newMember, settings, client, 'guildMemberUpdate');
  }
};
