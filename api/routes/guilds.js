const express = require('express');
const router = express.Router();
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

// All guild routes require authentication & admin permissions for the guild
router.use('/:guildId', requireAuth, requireGuildAdmin);

// 1. GET /api/guilds/:guildId/overview
router.get('/:guildId/overview', async (req, res) => {
  const { guildId } = req.params;
  const guild = client.guilds.cache.get(guildId);
  const settings = await guildService.getSettings(guildId);

  const totalMembers = guild ? guild.memberCount : 0;
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
    statsHistory
  });
});

// 2. GET /api/guilds/:guildId/settings
router.get('/:guildId/settings', async (req, res) => {
  const settings = await guildService.getSettings(req.params.guildId);
  res.json({ settings });
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
router.get('/:guildId/roles', (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) {
    return res.status(404).json({ error: 'Bot is not in this guild.' });
  }

  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id) // exclude @everyone
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor
    }));

  res.json({ roles });
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

module.exports = router;
