const inviteService = require('../../modules/inviteService');

module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    if (!invite || !invite.guild) return;
    inviteService.handleInviteCreate(invite);
  }
};
