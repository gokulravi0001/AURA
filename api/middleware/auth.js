const { PermissionsBitField } = require('discord.js');
const client = require('../../bot/client');

/**
 * Ensures user is authenticated via Discord OAuth2 session
 */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in with Discord.' });
  }
  next();
};

/**
 * Ensures the authenticated user has Administrator or Manage Guild permission for the specified guildId
 */
const requireGuildAdmin = async (req, res, next) => {
  const guildId = req.params.guildId || req.body.guildId;
  if (!guildId) {
    return res.status(400).json({ error: 'Missing guild ID.' });
  }

  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    // 1. Check user guilds in session
    const userGuild = req.session.guilds?.find(g => g.id === guildId);
    if (!userGuild) {
      return res.status(403).json({ error: 'You are not a member of this server.' });
    }

    const permissions = BigInt(userGuild.permissions);
    const isAdmin = (permissions & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR
    const canManageGuild = (permissions & BigInt(0x20)) === BigInt(0x20); // MANAGE_GUILD

    if (!isAdmin && !canManageGuild && !userGuild.owner) {
      return res.status(403).json({ error: 'You do not have permission to manage this server.' });
    }

    // Attach verified guild info to request
    req.targetGuildId = guildId;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify guild permissions.' });
  }
};

module.exports = { requireAuth, requireGuildAdmin };
