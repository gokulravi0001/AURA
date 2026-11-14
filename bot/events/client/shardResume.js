const logger = require('../../../shared/logger');
const serverTagService = require('../../modules/serverTagService');

module.exports = {
  name: 'shardResume',
  async execute(shardId, replayedEvents, client) {
    try {
      logger.bot(`Shard ${shardId} resumed (${replayedEvents} replayed). Queuing Server Tag Auto Role sync...`);
      await serverTagService.syncAllEnabledGuilds(client, 'reconnect', 1500);
    } catch (err) {
      logger.error('shardResume Server Tag sync error:', err.message);
    }
  }
};
