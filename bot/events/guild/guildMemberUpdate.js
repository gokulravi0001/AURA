const guildService = require('../../../shared/guildService');
const tagRoleService = require('../../modules/tagRoleService');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    if (!newMember || !newMember.guild) return;

    // Fetch guild settings
    const settings = await guildService.getSettings(newMember.guild.id);
    if (!settings?.tagRole?.enabled) return;

    // Check if nickname, display name, or username might have changed
    await tagRoleService.checkAndApply(newMember, settings, client, 'guildMemberUpdate');
  }
};
