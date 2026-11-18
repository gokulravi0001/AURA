const express = require('express');
const router = express.Router();
const client = require('../../bot/client');
const maintenanceService = require('../../shared/maintenanceService');
const blacklistService = require('../../shared/blacklistService');
const auditService = require('../../shared/auditService');
const healthService = require('../../shared/healthService');
const SystemConfig = require('../../models/SystemConfig');
const { requireDeveloper, sensitiveRateLimiter } = require('../middleware/security');

// Strict Developer Check on all developer endpoints
router.use(requireDeveloper);

// 1. GET /api/developer/status - Complete diagnostic telemetry
router.get('/status', async (req, res) => {
  try {
    const health = await healthService.getSystemHealth();
    const blacklist = await blacklistService.listBlacklist();
    const config = await SystemConfig.findOne({ configKey: 'global_config' }).lean();

    res.json({
      health,
      maintenance: maintenanceService.getStatus(),
      blacklistCount: blacklist.length,
      blacklist,
      emergencyDisabledModules: config?.globalEmergencyDisabledModules || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch developer status.', message: err.message });
  }
});

// 2. POST /api/developer/maintenance - Toggle maintenance mode
router.post('/maintenance', sensitiveRateLimiter, async (req, res) => {
  const { enabled, message } = req.body;
  const operator = `${req.session.user.username} (${req.session.user.id})`;

  try {
    let result;
    if (enabled) {
      result = await maintenanceService.enableMaintenance({ message, updatedBy: operator });
    } else {
      result = await maintenanceService.disableMaintenance({ updatedBy: operator });
    }

    await auditService.recordAction({
      action: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
      executorId: req.session.user.id,
      executorName: req.session.user.username,
      details: { enabled, message: result.message }
    });

    res.json({ success: true, maintenance: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance mode.', message: err.message });
  }
});

// 3. POST /api/developer/emergency-toggle - Globally disable/enable a module
router.post('/emergency-toggle', sensitiveRateLimiter, async (req, res) => {
  const { moduleKey, disable } = req.body;
  if (!moduleKey) {
    return res.status(400).json({ error: 'Module key is required.' });
  }

  try {
    const config = await SystemConfig.findOne({ configKey: 'global_config' });
    if (!config) {
      return res.status(500).json({ error: 'System config not found.' });
    }

    const currentDisabled = new Set(config.globalEmergencyDisabledModules || []);
    if (disable) {
      currentDisabled.add(moduleKey);
    } else {
      currentDisabled.delete(moduleKey);
    }

    config.globalEmergencyDisabledModules = Array.from(currentDisabled);
    await config.save();

    await auditService.recordAction({
      action: disable ? 'GLOBAL_MODULE_DISABLED' : 'GLOBAL_MODULE_ENABLED',
      executorId: req.session.user.id,
      executorName: req.session.user.username,
      details: { moduleKey, disabled: disable }
    });

    res.json({
      success: true,
      moduleKey,
      disabled: disable,
      globalEmergencyDisabledModules: config.globalEmergencyDisabledModules
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle module.', message: err.message });
  }
});

// 4. GET /api/developer/blacklist - List blacklisted users and servers
router.get('/blacklist', async (req, res) => {
  try {
    const list = await blacklistService.listBlacklist();
    res.json({ blacklist: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list blacklist.', message: err.message });
  }
});

// 5. POST /api/developer/blacklist - Add target to blacklist
router.post('/blacklist', sensitiveRateLimiter, async (req, res) => {
  const { targetId, type, reason } = req.body;
  if (!targetId || !['user', 'guild'].includes(type)) {
    return res.status(400).json({ error: 'Valid targetId and type (user | guild) are required.' });
  }

  try {
    const record = await blacklistService.addBlacklist({
      targetId,
      type,
      reason: reason || 'Violation of AURA Bot Usage Policy',
      blacklistedBy: req.session.user.id,
      blacklistedByName: req.session.user.username
    });

    await auditService.recordAction({
      action: 'BLACKLIST_ADDED',
      executorId: req.session.user.id,
      executorName: req.session.user.username,
      targetId,
      details: { type, reason: record.reason }
    });

    res.json({ success: true, blacklistEntry: record });
  } catch (err) {
    res.status(500).json({ error: 'Failed to blacklist target.', message: err.message });
  }
});

// 6. DELETE /api/developer/blacklist/:targetId - Remove from blacklist
router.delete('/blacklist/:targetId', sensitiveRateLimiter, async (req, res) => {
  const { targetId } = req.params;

  try {
    const success = await blacklistService.removeBlacklist(targetId);

    await auditService.recordAction({
      action: 'BLACKLIST_REMOVED',
      executorId: req.session.user.id,
      executorName: req.session.user.username,
      targetId
    });

    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from blacklist.', message: err.message });
  }
});

// 7. POST /api/developer/announcements - Publish developer announcement
router.post('/announcements', sensitiveRateLimiter, async (req, res) => {
  const { title, content, isPinned } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  try {
    await SystemConfig.updateOne(
      { configKey: 'global_config' },
      {
        $push: {
          announcements: {
            title,
            content,
            authorId: req.session.user.id,
            authorName: req.session.user.username,
            publishedAt: new Date(),
            isPinned: !!isPinned
          }
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post announcement.', message: err.message });
  }
});

// 8. POST /api/developer/changelogs - Publish changelog entry
router.post('/changelogs', sensitiveRateLimiter, async (req, res) => {
  const { version, features = [], bugFixes = [], improvements = [] } = req.body;
  if (!version) {
    return res.status(400).json({ error: 'Version string is required.' });
  }

  try {
    await SystemConfig.updateOne(
      { configKey: 'global_config' },
      {
        $push: {
          changelogs: {
            version,
            releaseDate: new Date(),
            features,
            bugFixes,
            improvements,
            publishedBy: req.session.user.username
          }
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record changelog.', message: err.message });
  }
});

module.exports = router;
