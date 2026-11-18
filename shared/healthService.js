const client = require('../bot/client');
const { getDatabaseHealth } = require('./database');
const maintenanceService = require('./maintenanceService');
const SystemConfig = require('../models/SystemConfig');

const healthService = {
  /**
   * Run live health check across all systems
   */
  async getSystemHealth() {
    const mem = process.memoryUsage();
    const dbHealth = await getDatabaseHealth();
    const maintenance = maintenanceService.getStatus();

    const isBotReady = client && client.isReady();
    const botPing = isBotReady ? client.ws.ping : null;

    // Check emergency disabled modules
    const config = await SystemConfig.findOne({ configKey: 'global_config' }).lean().catch(() => null);
    const emergencyDisabled = config?.globalEmergencyDisabledModules || [];

    return {
      status: (dbHealth.status === 'healthy' && isBotReady) ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      bot: {
        status: isBotReady ? 'connected' : 'connecting',
        tag: client?.user ? client.user.tag : 'AURA',
        pingMs: botPing,
        guildCount: client?.guilds?.cache?.size || 0,
        cachedUsers: client?.users?.cache?.size || 0
      },
      database: dbHealth,
      process: {
        memoryHeapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
        memoryRssMB: (mem.rss / 1024 / 1024).toFixed(2),
        nodeVersion: process.version,
        pid: process.pid
      },
      maintenance: {
        active: maintenance.enabled,
        startedAt: maintenance.startedAt
      },
      emergencyDisabledModules: emergencyDisabled
    };
  }
};

module.exports = healthService;
