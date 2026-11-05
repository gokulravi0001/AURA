const { PermissionsBitField } = require('discord.js');

// Known Bot Developer / Owner Discord IDs (Team Members: redflash00._95995 & .ahl_1)
const DEFAULT_BOT_OWNERS = [
  '1487429529717706842',
  '1447912706232422443'
];

/**
 * Checks whether a given user ID belongs to the Bot Developer / Owner.
 * Bypasses all server permissions across all Discord guilds.
 *
 * @param {string} userId
 * @param {import('discord.js').Client} [client]
 * @returns {boolean}
 */
function isBotOwner(userId, client = null) {
  if (!userId) return false;
  const uid = String(userId);

  // 1. Check environment variable
  const envOwners = (process.env.BOT_OWNER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (envOwners.includes(uid)) return true;

  // 2. Check hardcoded primary developer IDs
  if (DEFAULT_BOT_OWNERS.includes(uid)) return true;

  // 3. Check client.application owner / team members dynamically
  if (client?.application?.owner) {
    const owner = client.application.owner;
    if (owner.members && typeof owner.members.has === 'function') {
      if (owner.members.has(uid)) return true;
    }
    if (owner.id === uid) return true;
  }

  return false;
}

/**
 * Checks whether a user/member is privileged (Bot Developer, Server Owner, or Administrator).
 *
 * @param {import('discord.js').GuildMember|import('discord.js').User} userOrMember
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} [client]
 * @returns {boolean}
 */
function isOwnerOrAdmin(userOrMember, guild, client = null) {
  if (!userOrMember) return false;
  const userId = userOrMember.id || userOrMember.user?.id;
  if (!userId) return false;

  // 1. Bot Developer / Owner (Bypass in all servers)
  if (isBotOwner(userId, client)) return true;

  // 2. Server Owner
  if (guild && guild.ownerId === userId) return true;

  // 3. Guild Administrator Permission
  const member = userOrMember.permissions ? userOrMember : guild?.members?.cache?.get(userId);
  if (member?.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;

  return false;
}

/**
 * Checks whether a member has a specific permission, or has Administrator / Server Owner / Bot Developer bypass.
 *
 * @param {import('discord.js').GuildMember|import('discord.js').User} member
 * @param {bigint|string} permission
 * @param {import('discord.js').Client} [client]
 * @returns {boolean}
 */
function hasPermissionOrOwner(member, permission, client = null) {
  if (!member) return false;
  const userId = member.id || member.user?.id;
  if (!userId) return false;

  // 1. Bot Developer / Owner bypass
  if (isBotOwner(userId, client)) return true;

  // 2. Server Owner bypass
  if (member.guild && member.guild.ownerId === userId) return true;

  // 3. Guild Administrator bypass
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;

  // 4. Specific Permission check
  if (permission && member.permissions?.has(permission)) return true;

  return false;
}

module.exports = {
  isBotOwner,
  isOwnerOrAdmin,
  hasPermissionOrOwner,
  DEFAULT_BOT_OWNERS
};
