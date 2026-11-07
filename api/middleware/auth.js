const { PermissionsBitField } = require('discord.js');
const client = require('../../bot/client');
const { isBotOwner } = require('../../shared/permissionHelper');
const whitelistService = require('../../shared/whitelistService');

/**
 * Public-first authentication middleware:
 * - GET requests (read-only) are accessible to anyone (public guest mode)
 * - Mutating requests (POST, PATCH, PUT, DELETE) require a valid Discord session
 */
const requireAuth = (req, res, next) => {
  if (req.method === 'GET') {
    return next();
  }

  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in with Discord to make changes.' });
  }
  next();
};

/**
 * Ensures user has permission to manage the guild for write operations,
 * but allows public read-only access for GET requests.
 *
 * Checks:
 * 1. Bot Developer / Owner bypass
 * 2. Server Owner
 * 3. Whitelisted Member (via /whitelist command)
 * 4. Discord Administrator or Manage Server permission
 */
const requireGuildAdmin = async (req, res, next) => {
  const guildId = req.params.guildId || req.body.guildId;
  if (!guildId) {
    return res.status(400).json({ error: 'Missing guild ID.' });
  }

  const user = req.session?.user;
  let canManage = false;

  if (user) {
    const isBotDev = isBotOwner(user.id, client);
    const cachedGuild = client.guilds.cache.get(guildId);
    const userGuild = req.session.guilds?.find(g => g.id === guildId);
    const isGuildOwner = cachedGuild?.ownerId === user.id || userGuild?.owner;
    const isWhitelisted = whitelistService.isWhitelisted(user.id, guildId);

    let isAdminOrManager = false;
    if (userGuild?.permissions) {
      const perms = BigInt(userGuild.permissions);
      isAdminOrManager = (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
    }

    canManage = isBotDev || isGuildOwner || isWhitelisted || isAdminOrManager;
  }

  req.canManage = canManage;
  req.targetGuildId = guildId;

  // Read-only operations are public for everyone
  if (req.method === 'GET') {
    return next();
  }

  // Mutating operations require canManage
  if (!canManage) {
    return res.status(403).json({
      error: 'Viewing mode only. You must be an Administrator, Server Owner, or Whitelisted member to edit settings.'
    });
  }

  next();
};

module.exports = { requireAuth, requireGuildAdmin };
