const inviteService = require('../../modules/inviteService');

module.exports = {
  name: 'inviteDelete',
  async execute(invite, client) {
    if (!invite || !invite.guild) return;
    inviteService.handleInviteDelete(invite);
  }
};
