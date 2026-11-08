const inviteService = require('../../modules/inviteService');

module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    if (!invite || !invite.guild) return;
    await inviteService.handleInviteCreate(invite, client);
  }
};
