const mongoose = require('mongoose');
const Guild = require('../models/Guild');
const SystemConfig = require('../models/SystemConfig');
const logger = require('./logger');
const { DEFAULT_GUILD_CONFIG } = require('./constants');

const migrationRunner = {
  /**
   * Run automated safe schema migrations and index verification
   */
  async runMigrations() {
    logger.info('[Migrations] Checking database schema and index integrity...');
    const results = {
      indexesCreated: 0,
      globalConfigInitialized: false,
      guildsChecked: 0
    };

    try {
      // 1. Ensure global system configuration exists
      let globalConfig = await SystemConfig.findOne({ configKey: 'global_config' });
      if (!globalConfig) {
        globalConfig = await SystemConfig.create({
          configKey: 'global_config',
          globalDefaults: DEFAULT_GUILD_CONFIG,
          changelogs: [{
            version: '1.0.0',
            releaseDate: new Date(),
            features: [
              'All-in-One Categorized Interactive Guidance Hubs (/levels, /bday, /vc, /ticket, /servertools, /games)',
              'Core System Upgrade with Database Health & Backup Manager',
              'Centralized Multi-Level Logging & Sensitive Credential Masking',
              'Maintenance Mode & Global Blacklist Protection',
              'Multi-Server Isolation & Localization Engine'
            ],
            bugFixes: ['Fixed Discord REST command deployment connection lingering'],
            improvements: ['Streamlined interactive embeds with 1-click select menus & buttons']
          }]
        });
        results.globalConfigInitialized = true;
        logger.info('[Migrations] Created initial SystemConfig record.');
      }

      // 2. Ensure all indexes on Guilds and collections are registered
      await Guild.init();
      results.indexesCreated++;

      logger.success('[Migrations] Schema migrations and index verification completed cleanly.');
      return { success: true, results };
    } catch (err) {
      logger.error('[Migrations] Schema migration encountered error:', err.message);
      return { success: false, error: err.message };
    }
  }
};

module.exports = migrationRunner;
