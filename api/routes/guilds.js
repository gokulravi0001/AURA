const express = require('express');
const router = express.Router();
const { PermissionFlagsBits } = require('discord.js');
const client = require('../../bot/client');
const guildService = require('../../shared/guildService');
const { requireAuth, requireGuildAdmin } = require('../middleware/auth');
const UserXP = require('../../models/UserXP');
const Ticket = require('../../models/Ticket');
const StickyMessage = require('../../models/StickyMessage');
const Birthday = require('../../models/Birthday');
const ServerStats = require('../../models/ServerStats');
const AuditLog = require('../../models/AuditLog');
const statsService = require('../../bot/modules/statsService');
const serverTagService = require('../../bot/modules/serverTagService');

// All guild routes require authentication & admin permissions for the guild
router.use('/:guildId', requireAuth, requireGuildAdmin);

// 1. GET /api/guilds/:guildId/overview
router.get('/:guildId/overview', async (req, res) => {
  const { guildId } = req.params;
  const guild = client.guilds.cache.get(guildId);
  const settings = await guildService.getSettings(guildId);

  if (guild) {
    await guild.members.fetch().catch(() => {});
  }

  const totalMembers = guild ? (guild.memberCount || guild.members.cache.size) : 0;
  const botMembers = guild ? guild.members.cache.filter(m => m.user.bot).size : 0;
  const humanMembers = Math.max(0, totalMembers - botMembers);

  let activeInVoice = 0;
  if (guild) {
    guild.channels.cache.forEach(c => {
      if (c.isVoiceBased()) activeInVoice += c.members.filter(m => !m.user.bot).size;
    });
  }

  // Open tickets count
  const openTicketsCount = await Ticket.countDocuments({ guildId, status: { $ne: 'closed' } });

  // Top 5 XP members
  const topXp = await UserXP.find({ guildId }).sort({ level: -1, xp: -1 }).limit(5);

  // Stats chart history (last 7 days)
  const statsHistory = await statsService.getGuildHistory(guildId, 7);

  res.json({
    guild: {
      id: guildId,
      name: guild ? guild.name : settings?.name || 'Discord Server',
      icon: guild ? guild.iconURL({ dynamic: true }) : null,
      memberCount: totalMembers,
      humans: humanMembers,
      bots: botMembers,
      voiceActive: activeInVoice,
      openTickets: openTicketsCount
    },
    settings,
    topXp,
    statsHistory,
    canManage: !!req.canManage
  });
});

// 2. GET /api/guilds/:guildId/settings
router.get('/:guildId/settings', async (req, res) => {
  const settings = await guildService.getSettings(req.params.guildId);
  res.json({ settings, canManage: !!req.canManage });
});

// 3. PATCH /api/guilds/:guildId/settings - Update settings
router.patch('/:guildId/settings', async (req, res) => {
  const { guildId } = req.params;
  const updateData = req.body;

  try {
    const updated = await guildService.updateSettings(guildId, updateData);

    // Record audit log
    await AuditLog.create({
      guildId,
      action: 'SETTINGS_UPDATE',
      executorId: req.session.user.id,
      executorName: req.session.user.username,
      details: updateData
    });

    // Realtime notification to all connected dashboard sessions for this guild
    if (client.io) {
      client.io.to(`guild_${guildId}`).emit('settings_updated', updated);
    }

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// 4. GET /api/guilds/:guildId/channels - List text and voice channels for dropdowns
router.get('/:guildId/channels', (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Bot is not in this guild.' });
  }

  const channels = guild.channels.cache.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    isText: c.isTextBased(),
    isVoice: c.isVoiceBased(),
    isCategory: c.type === 4
  }));

  res.json({ channels });
});

// 5. GET /api/guilds/:guildId/roles - List guild roles for dropdowns
router.get('/:guildId/roles', async (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Bot is not in this guild.' });
  }

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const hasManageRoles = Boolean(botMember?.permissions?.has(PermissionFlagsBits.ManageRoles));
  const botHighestPosition = botMember?.roles?.highest?.position ?? -1;

  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id) // exclude @everyone
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      managed: Boolean(r.managed),
      assignable: Boolean(!r.managed && hasManageRoles && botHighestPosition > r.position)
    }));

  res.json({
    roles,
    botCapabilities: {
      manageRoles: hasManageRoles,
      highestRolePosition: botHighestPosition,
      highestRoleName: botMember?.roles?.highest?.name || null
    }
  });
});

// 6. GET /api/guilds/:guildId/leaderboard - Paginated leaderboard
router.get('/:guildId/leaderboard', async (req, res) => {
  const { guildId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;

  const users = await UserXP.find({ guildId })
    .sort({ level: -1, xp: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await UserXP.countDocuments({ guildId });

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// 7. GET /api/guilds/:guildId/tickets - List all tickets & transcripts
router.get('/:guildId/tickets', async (req, res) => {
  const { guildId } = req.params;
  const status = req.query.status;

  const query = { guildId };
  if (status && ['open', 'claimed', 'closed'].includes(status)) {
    query.status = status;
  }

  const tickets = await Ticket.find(query).sort({ createdAt: -1 }).limit(100);
  res.json({ tickets });
});

// 8. GET /api/guilds/:guildId/sticky - Sticky messages preview
router.get('/:guildId/sticky', async (req, res) => {
  const stickies = await StickyMessage.find({ guildId: req.params.guildId });
  res.json({ stickies });
});

// 9. POST /api/guilds/:guildId/sticky - Create or update sticky
router.post('/:guildId/sticky', async (req, res) => {
  const { channelId, content, embedData, cooldownSeconds } = req.body;
  const { guildId } = req.params;

  try {
    const updated = await StickyMessage.findOneAndUpdate(
      { channelId },
      {
        guildId,
        content: content || '',
        embedData: embedData || {},
        cooldownSeconds: cooldownSeconds || 4,
        enabled: true
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, sticky: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save sticky message.' });
  }
});

async function buildServerTagRolePayload(guild, settings) {
  const config = settings?.serverTagRole || {};
  const moduleEnabled = settings?.modules?.server_tag_role !== false;
  const tagInfo = serverTagService.detectGuildServerTagInfo(guild, config);

  let botCapabilities = {
    manageRoles: false,
    highestRolePosition: -1,
    highestRoleName: null
  };
  let roleValidation = null;
  let activeMemberCount = config.activeMemberCount || 0;

  if (guild) {
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const hasManageRoles = Boolean(botMember?.permissions?.has(PermissionFlagsBits.ManageRoles));
    botCapabilities = {
      manageRoles: hasManageRoles,
      highestRolePosition: botMember?.roles?.highest?.position ?? -1,
      highestRoleName: botMember?.roles?.highest?.name || null
    };

    if (config.roleId) {
      const check = await serverTagService.validateRoleConfiguration(guild, config.roleId);
      roleValidation = {
        valid: check.valid,
        code: check.code || null,
        error: check.error || null,
        roleName: check.role?.name || null
      };

      const role = guild.roles.cache.get(config.roleId);
      if (role) {
        activeMemberCount = guild.members.cache.filter(
          m => m.roles.cache.has(config.roleId) && (config.includeBots || !m.user.bot)
        ).size;
      }
    } else if (!hasManageRoles) {
      roleValidation = {
        valid: false,
        code: 'MISSING_MANAGE_ROLES',
        error: 'The bot is missing the Manage Roles permission in this server.',
        roleName: null
      };
    }
  }

  return {
    moduleEnabled,
    config: {
      enabled: Boolean(config.enabled),
      roleId: config.roleId || '',
      includeBots: Boolean(config.includeBots),
      serverTagId: config.serverTagId || guild?.id || null,
      detectedTag: tagInfo.tag || config.detectedTag || null,
      detectedBadge: tagInfo.badge || config.detectedBadge || null,
      activeMemberCount,
      lastSyncAt: config.lastSyncAt || null,
      lastSyncStatus: config.lastSyncStatus || 'idle',
      lastSyncMessage: config.lastSyncMessage || null
    },
    tagInfo,
    botCapabilities,
    roleValidation
  };
}

// 10. GET /api/guilds/:guildId/server-tag-role
router.get('/:guildId/server-tag-role', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    const settings = await guildService.getSettings(guildId);
    const payload = await buildServerTagRolePayload(guild, settings);
    res.json({ ...payload, canManage: req.canManage });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Server Tag Auto Role configuration.' });
  }
});

// 11. PUT /api/guilds/:guildId/server-tag-role
router.put('/:guildId/server-tag-role', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Bot is not in this guild.' });
    }

    const currentSettings = await guildService.getSettings(guildId);
    const currentConfig = currentSettings?.serverTagRole || {};
    const enabled = Boolean(req.body?.enabled);
    const roleId = typeof req.body?.roleId === 'string' && req.body.roleId.trim()
      ? req.body.roleId.trim()
      : null;
    const includeBots = Boolean(req.body?.includeBots);

    if (enabled && !roleId) {
      return res.status(400).json({
        error: 'Please select a target role before enabling Server Tag Auto Role.',
        code: 'NO_ROLE_SELECTED'
      });
    }

    if (roleId && (enabled || roleId !== currentConfig.roleId)) {
      const validation = await serverTagService.validateRoleConfiguration(guild, roleId);
      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: validation.code
        });
      }
    }

    const tagInfo = serverTagService.detectGuildServerTagInfo(guild, currentConfig);
    const updateData = {
      'serverTagRole.enabled': enabled,
      'serverTagRole.roleId': roleId,
      'serverTagRole.includeBots': includeBots,
      'serverTagRole.serverTagId': tagInfo.serverTagId || guild.id,
      'serverTagRole.detectedTag': tagInfo.tag || currentConfig.detectedTag || null,
      'serverTagRole.detectedBadge': tagInfo.badge || currentConfig.detectedBadge || null,
      'serverTagRole.updatedBy': req.user.id,
      'serverTagRole.updatedAt': new Date()
    };

    if (enabled) {
      updateData['modules.server_tag_role'] = true;
    }

    let updatedSettings = await guildService.updateSettings(guildId, updateData);

    await AuditLog.create({
      guildId,
      action: 'SERVER_TAG_ROLE_UPDATE',
      executorId: req.user.id,
      executorTag: req.user.username,
      details: `Server Tag Auto Role updated (Enabled: ${enabled}, Role: ${roleId || 'None'}, Include Bots: ${includeBots})`
    });

    if (enabled && roleId) {
      await serverTagService.syncGuild(guild, updatedSettings, client, {
        source: 'dashboardSave',
        force: true
      });
      updatedSettings = await guildService.getSettings(guildId);
    } else if (client.io) {
      client.io.to(`guild_${guildId}`).emit('settingsUpdate', updatedSettings);
    }

    const payload = await buildServerTagRolePayload(guild, updatedSettings);
    res.json({ success: true, ...payload });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save Server Tag Auto Role configuration.' });
  }
});

// 12. POST /api/guilds/:guildId/server-tag-role/sync
router.post('/:guildId/server-tag-role/sync', async (req, res) => {
  try {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Bot is not in this guild.' });
    }

    const settings = await guildService.getSettings(guildId);
    const syncResult = await serverTagService.syncGuild(guild, settings, client, {
      source: 'manual',
      force: true
    });

    const freshSettings = await guildService.getSettings(guildId);
    const payload = await buildServerTagRolePayload(guild, freshSettings);

    await AuditLog.create({
      guildId,
      action: 'SERVER_TAG_ROLE_SYNC',
      executorId: req.user.id,
      executorTag: req.user.username,
      details: syncResult.message || `Manual Server Tag sync (${syncResult.status || (syncResult.success ? 'success' : 'error')})`
    });

    if (!syncResult.success) {
      return res.status(400).json({
        success: false,
        error: syncResult.error || syncResult.message || 'Synchronization failed.',
        code: syncResult.code || 'SYNC_FAILED',
        syncResult,
        ...payload
      });
    }

    res.json({
      success: true,
      syncResult,
      ...payload
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to synchronize Server Tag Auto Role.' });
  }
});

module.exports = router;
