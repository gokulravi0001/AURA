const voiceStatusService = require('../../modules/voiceStatusService');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    if (!channel?.guild) return;

    try {
      await voiceStatusService.handleChannelDelete(channel);
    } catch (_) {
      // safe ignore
    }
  }
};
