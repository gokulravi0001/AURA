const Guild = require('../models/Guild');
const logger = require('./logger');
const { isBotOwner, DEFAULT_BOT_OWNERS } = require('./permissionHelper');

// Primary User ID with absolute, permanent, global immunity
const ABSOLUTE_IMMUNE_USER_ID = '1487429529717706842';

// In-memory cache of guild immunities: guildId -> { users: Set(userId), roles: Set(roleId) }
const guildImmunityCache = new Map();

const immunityService = {
  ABSOLUTE_IMMUNE_USER_ID,

  /**
   * Check whether a user or member has Immunity against disruptive commands
   * (e.g. bounce, disconnect, mute, move).
   *
   * @param {import('discord.js').GuildMember|import('discord.js').User|string} userOrMember
   * @param {import('discord.js').Guild} [guild]
   * @param {import('discord.js').Client} [client]
   * @param {object} [settings]
   * @returns {boolean}
   */
  isImmune(userOrMember, guild = null, client = null, settings = null) {
    if (!userOrMember) return false;

    // Resolve userId and member
    let userId = null;
    let member = null;

    if (typeof userOrMember === 'string') {
      userId = userOrMember.replace(/[<@!>]/g, '');
      member = guild?.members?.cache?.get(userId);
    } else {
      userId = userOrMember.id || userOrMember.user?.id || userOrMember.author?.id || userOrMember.member?.id;
      member = userOrMember.roles ? userOrMember : guild?.members?.cache?.get(userId);
    }

    if (!userId) return false;
    const uid = String(userId);

    // 1. Primary User ID: Permanent Absolute Global Immunity
    // Absolutely untouchable across ALL servers. Even Server Owners cannot affect this user.
    if (uid === ABSOLUTE_IMMUNE_USER_ID) {
      return true;
    }

    // 2. Bot Developer / Owner Global Immunity
    if (DEFAULT_BOT_OWNERS.includes(uid) || isBotOwner(uid, client)) {
      return true;
    }

    // 3. Server Owner Immunity in their own server
    if (guild && guild.ownerId === uid) {
      return true;
    }

    // 4. Server-configured Immune Users check
    if (settings?.immunity?.users && Array.isArray(settings.immunity.users)) {
      if (settings.immunity.users.includes(uid)) return true;
    }

    const guildId = guild?.id;
    if (guildId) {
      const cached = guildImmunityCache.get(guildId);
      if (cached && cached.users && cached.users.has(uid)) {
        return true;
      }

      // 5. Server-configured Immune Roles check
      if (member && member.roles && member.roles.cache) {
        // Check settings roles
        if (settings?.immunity?.roles && Array.isArray(settings.immunity.roles)) {
          for (const roleId of settings.immunity.roles) {
            if (member.roles.cache.has(roleId)) return true;
          }
        }

        // Check cached roles
        if (cached && cached.roles) {
          for (const roleId of cached.roles) {
            if (member.roles.cache.has(roleId)) return true;
          }
        }
      }
    }

    return false;
  },

  /**
   * Check whether a user is the primary absolute immune user.
   * Untouchable across all servers, even by Server Owners.
   *
   * @param {import('discord.js').GuildMember|import('discord.js').User|string} userOrMember
   * @returns {boolean}
   */
  isAbsoluteImmune(userOrMember) {
    if (!userOrMember) return false;
    let userId = null;
    if (typeof userOrMember === 'string') {
      userId = userOrMember.replace(/[<@!>]/g, '');
    } else {
      userId = userOrMember.id || userOrMember.user?.id || userOrMember.author?.id || userOrMember.member?.id;
    }
    return String(userId) === ABSOLUTE_IMMUNE_USER_ID;
  },

  /**
   * Get cached or settings immunity for a guild
   */
  getImmunity(guildId, settings = null) {
    let cached = guildImmunityCache.get(guildId);
    if (!cached) {
      cached = {
        users: new Set(settings?.immunity?.users || []),
        roles: new Set(settings?.immunity?.roles || [])
      };
      guildImmunityCache.set(guildId, cached);
    }
    return {
      users: [...cached.users],
      roles: [...cached.roles]
    };
  },

  /**
   * Add an immune user to a server
   */
  async addImmuneUser(guildId, userId) {
    const uid = String(userId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $addToSet: { 'immunity.users': uid } },
      { new: true, upsert: true }
    );

    let cached = guildImmunityCache.get(guildId);
    if (!cached) {
      cached = { users: new Set(), roles: new Set() };
      guildImmunityCache.set(guildId, cached);
    }
    cached.users.add(uid);

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.immunity || { users: [], roles: [] };
  },

  /**
   * Remove an immune user from a server
   */
  async removeImmuneUser(guildId, userId) {
    const uid = String(userId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $pull: { 'immunity.users': uid } },
      { new: true, upsert: true }
    );

    const cached = guildImmunityCache.get(guildId);
    if (cached) {
      cached.users.delete(uid);
    }

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.immunity || { users: [], roles: [] };
  },

  /**
   * Add an immune role to a server
   */
  async addImmuneRole(guildId, roleId) {
    const rid = String(roleId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $addToSet: { 'immunity.roles': rid } },
      { new: true, upsert: true }
    );

    let cached = guildImmunityCache.get(guildId);
    if (!cached) {
      cached = { users: new Set(), roles: new Set() };
      guildImmunityCache.set(guildId, cached);
    }
    cached.roles.add(rid);

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.immunity || { users: [], roles: [] };
  },

  /**
   * Remove an immune role from a server
   */
  async removeImmuneRole(guildId, roleId) {
    const rid = String(roleId);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      { $pull: { 'immunity.roles': rid } },
      { new: true, upsert: true }
    );

    const cached = guildImmunityCache.get(guildId);
    if (cached) {
      cached.roles.delete(rid);
    }

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return guild.immunity || { users: [], roles: [] };
  },

  /**
   * Clear all server-configured immunities
   */
  async clearImmunity(guildId) {
    await Guild.findOneAndUpdate(
      { guildId },
      { $set: { 'immunity.users': [], 'immunity.roles': [] } }
    );

    guildImmunityCache.delete(guildId);

    const guildService = require('./guildService');
    guildService.invalidateCache(guildId);

    return { users: [], roles: [] };
  }
};

module.exports = immunityService;
