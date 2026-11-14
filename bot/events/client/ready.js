const { ActivityType } = require('discord.js');
const logger = require('../../../shared/logger');
const birthdayService = require('../../modules/birthdayService');
const bumpService = require('../../modules/bumpService');
const stickyService = require('../../modules/stickyService');
const inviteService = require('../../modules/inviteService');
const whitelistService = require('../../../shared/whitelistService');
const autoDeleteService = require('../../../shared/autoDeleteService');
const serverTagService = require('../../modules/serverTagService');

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
      await client.application?.fetch().catch(() => {});
      await whitelistService.init();
      birthdayService.init(client);
      bumpService.init(client);
      await stickyService.loadCache();
      await inviteService.init(client);
      await autoDeleteService.init(client);

      // Pre-fetch all members for all guilds so bot & human counters are accurate
      for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => {});
      }

      // Start Server Tag Auto Role periodic + startup sync after member caches settle
      serverTagService.init(client);

      logger.info('Background schedulers & caches initialized (Birthdays, Bump Reminders, Sticky Messages, Invites, Server Tag Roles, Guild Members).');
    } catch (err) {
      logger.error('Error starting background schedulers:', err.message);
    }
  }
};
