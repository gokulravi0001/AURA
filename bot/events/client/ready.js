const { ActivityType } = require('discord.js');
const logger = require('../../../shared/logger');
const birthdayService = require('../../modules/birthdayService');
const bumpService = require('../../modules/bumpService');
const stickyService = require('../../modules/stickyService');
const inviteService = require('../../modules/inviteService');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.success(`================================================`);
    logger.success(`  AURA BOT ONLINE: ${client.user.tag}`);
    logger.success(`  Guilds: ${client.guilds.cache.size} | Users: ${client.users.cache.size}`);
    logger.success(`  Default Prefix: +`);
    logger.success(`================================================`);

    // Set Discord Rich Presence
    client.user.setPresence({
      activities: [{
        name: `+help | Serving ${client.guilds.cache.size} servers`,
        type: ActivityType.Custom
      }],
      status: 'online'
    });

    // Initialize Background Schedulers & Caches
    try {
      birthdayService.init(client);
      bumpService.init(client);
      await stickyService.loadCache();
      await inviteService.init(client);
      logger.info('Background schedulers & caches initialized (Birthdays, Bump Reminders, Sticky Messages, Invites).');
    } catch (err) {
      logger.error('Error starting background schedulers:', err.message);
    }
  }
};
