const express = require('express');
const router = express.Router();
const client = require('../../bot/client');
const healthService = require('../../shared/healthService');
const backupService = require('../../shared/backupService');
const auditService = require('../../shared/auditService');
const SystemLog = require('../../models/SystemLog');
const SystemConfig = require('../../models/SystemConfig');
const Guild = require('../../models/Guild');
const { requireAuth } = require('../middleware/auth');
const { sensitiveRateLimiter } = require('../middleware/security');
const { MODULES } = require('../../shared/constants');

// 1. GET /api/system/overview - Overall system health & stats
router.get('/overview', async (req, res) => {
  try {
    const health = await healthService.getSystemHealth();
    const totalGuilds = client?.guilds?.cache?.size || 0;
    const totalUsers = client?.users?.cache?.size || 0;

    // Recent errors from SystemLog (last 10)
    const recentErrors = await SystemLog.find({ level: 'ERROR' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .catch(() => []);

    // Recent system activities (last 10)
    const recentActivities = await SystemLog.find({ level: { $in: ['INFO', 'WARN'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .catch(() => []);

    res.json({
      operationalStatus: health.status,
      bot: health.bot,
      database: health.database,
      totalConnectedServers: totalGuilds,
      totalCachedUsers: totalUsers,
      uptimeSeconds: health.uptimeSeconds,
      activeModules: Object.values(MODULES).filter(m => !health.emergencyDisabledModules.includes(m)),
      emergencyDisabledModules: health.emergencyDisabledModules,
      maintenance: health.maintenance,
      recentErrors,
      recentActivities
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve system overview.', message: err.message });
  }
});

// 2. GET /api/system/logs - Search and filter logs
router.get('/logs', async (req, res) => {
  const { level, scope, guildId, search, limit = 50, page = 1 } = req.query;

  const query = {};
  if (level) query.level = String(level).toUpperCase();
  if (scope) query.scope = String(scope).toUpperCase();
  if (guildId) query.guildId = String(guildId);
  if (search) {
    query.message = { $regex: String(search), $options: 'i' };
  }

  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  try {
    const [logs, total] = await Promise.all([
      SystemLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      SystemLog.countDocuments(query)
    ]);

    res.json({
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
      logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system logs.', message: err.message });
  }
});

// 3. GET /api/system/database - Database status & backup list
router.get('/database', async (req, res) => {
  try {
    const health = await healthService.getSystemHealth();
    const backups = await backupService.listBackups();
    res.json({
      database: health.database,
      backups
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch database information.', message: err.message });
  }
});

// 4. POST /api/system/database/backup - Create backup
router.post('/database/backup', requireAuth, sensitiveRateLimiter, async (req, res) => {
  try {
    const operator = req.session?.user ? `${req.session.user.username} (${req.session.user.id})` : 'admin';
    const backup = await backupService.createBackup({
      name: req.body.name || `Backup ${new Date().toLocaleDateString()}`,
      description: req.body.description || 'Manual backup via dashboard',
      createdBy: operator
    });

    await auditService.recordAction({
      action: 'DATABASE_BACKUP_CREATED',
      executorId: req.session?.user?.id || 'system',
      executorName: req.session?.user?.username || 'system',
      details: { backupId: backup.backupId, totalDocuments: backup.totalDocuments }
    });

    res.json({ success: true, backup });
  } catch (err) {
    res.status(500).json({ error: 'Backup creation failed.', message: err.message });
  }
});

// 5. POST /api/system/database/restore - Restore backup (Requires confirm: true)
router.post('/database/restore', requireAuth, sensitiveRateLimiter, async (req, res) => {
  const { backupId, confirm } = req.body;
  if (!confirm) {
    return res.status(400).json({
      error: 'Restoration confirmation required. Pass { confirm: true } to proceed.'
    });
  }

  try {
    const operator = req.session?.user ? `${req.session.user.username} (${req.session.user.id})` : 'admin';
    const result = await backupService.restoreBackup(backupId, { confirm: true, operator });

    await auditService.recordAction({
      action: 'DATABASE_RESTORED',
      executorId: req.session?.user?.id || 'system',
      executorName: req.session?.user?.username || 'system',
      details: { backupId, operator }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Restore operation failed.', message: err.message });
  }
});

// 6. GET /api/system/security - Security info & audit logs
router.get('/security', async (req, res) => {
  try {
    const auditLogs = await auditService.getAuditLogs({ limit: 50 });
    res.json({
      auditLogs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch security logs.', message: err.message });
  }
});

// 7. GET /api/system/changelogs - Fetch changelogs
router.get('/changelogs', async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ configKey: 'global_config' }).lean();
    res.json({ changelogs: config?.changelogs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch changelogs.', message: err.message });
  }
});

// 8. GET /api/system/announcements - Fetch announcements
router.get('/announcements', async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ configKey: 'global_config' }).lean();
    res.json({ announcements: config?.announcements || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements.', message: err.message });
  }
});

module.exports = router;
