const SystemConfig = require('../models/SystemConfig');
const logger = require('./logger');
const { isBotOwner } = require('./permissionHelper');

let maintenanceCache = {
  enabled: false,
  message: '🔧 **AURA is currently undergoing scheduled system maintenance.** Regular commands are temporarily paused. Diagnostics remain active for developers.',
  startedAt: null,
  updatedBy: null
};

const maintenanceService = {
  /**
   * Load current maintenance status from database into cache
   */
  async init() {
    try {
      const config = await SystemConfig.findOne({ configKey: 'global_config' }).lean();
      if (config?.maintenanceMode) {
        maintenanceCache = {
          enabled: !!config.maintenanceMode.enabled,
          message: config.maintenanceMode.message || maintenanceCache.message,
          startedAt: config.maintenanceMode.startedAt,
          updatedBy: config.maintenanceMode.updatedBy
        };
      }
    } catch (_) {}
  },

  /**
   * Fast sync check whether maintenance mode is active
   */
  isMaintenanceActive() {
    return maintenanceCache.enabled;
  },

  /**
   * Check if a caller can bypass maintenance mode (Bot Developers)
   */
  canBypassMaintenance(userId, client = null) {
    return isBotOwner(userId, client);
  },

  /**
   * Get maintenance status and message
   */
  getStatus() {
    return { ...maintenanceCache };
  },

  /**
   * Enable maintenance mode
   */
  async enableMaintenance({ message = null, updatedBy = 'Developer' } = {}) {
    maintenanceCache.enabled = true;
    if (message) maintenanceCache.message = message;
    maintenanceCache.startedAt = new Date();
    maintenanceCache.updatedBy = updatedBy;

    await SystemConfig.updateOne(
      { configKey: 'global_config' },
      {
        $set: {
          'maintenanceMode.enabled': true,
          'maintenanceMode.message': maintenanceCache.message,
          'maintenanceMode.startedAt': maintenanceCache.startedAt,
          'maintenanceMode.updatedBy': updatedBy
        }
      },
      { upsert: true }
    );

    logger.warn(`[Maintenance] Maintenance mode ENABLED by ${updatedBy}`);
    return maintenanceCache;
  },

  /**
   * Disable maintenance mode
   */
  async disableMaintenance({ updatedBy = 'Developer' } = {}) {
    maintenanceCache.enabled = false;
    maintenanceCache.startedAt = null;
    maintenanceCache.updatedBy = updatedBy;

    await SystemConfig.updateOne(
      { configKey: 'global_config' },
      {
        $set: {
          'maintenanceMode.enabled': false,
          'maintenanceMode.startedAt': null,
          'maintenanceMode.updatedBy': updatedBy
        }
      },
      { upsert: true }
    );

    logger.info(`[Maintenance] Maintenance mode DISABLED by ${updatedBy}`);
    return maintenanceCache;
  }
};

module.exports = maintenanceService;
