const { PermissionsBitField, Routes } = require('discord.js');
const Guild = require('../../models/Guild');
const guildService = require('../../shared/guildService');
const logger = require('../../shared/logger');

const VERIFICATION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_VERIFIED_CACHE_SIZE = 25000;
const AUTO_SYNC_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown for reconnect/auto sync bursts
const PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Tracks user IDs whose `primary_guild` key was authoritatively present in a Gateway or REST payload
const verifiedPrimaryGuildUsers = new Map();
const activeGuildSyncs = new Set();
const lastAutoSyncTrigger = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRawPrimaryGuild(rawPrimaryGuild) {
  if (!rawPrimaryGuild) return null;
  return {
    identityGuildId: rawPrimaryGuild.identity_guild_id ?? rawPrimaryGuild.identityGuildId ?? null,
    identityEnabled: rawPrimaryGuild.identity_enabled ?? rawPrimaryGuild.identityEnabled ?? null,
    tag: rawPrimaryGuild.tag ?? null,
    badge: rawPrimaryGuild.badge ?? null
  };
}

const serverTagService = {
  /**
   * Record that Discord authoritatively included the `primary_guild` field for this user.
   * Distinguishes verified `primary_guild: null` from omitted/partial user payloads.
   */
  markPrimaryGuildVerified(userId, rawUser = null) {
    if (!userId) return;
    if (rawUser && !('primary_guild' in rawUser)) return;

    if (verifiedPrimaryGuildUsers.size >= MAX_VERIFIED_CACHE_SIZE) {
      // Evict oldest 20% entries cleanly
      const toDelete = Math.floor(MAX_VERIFIED_CACHE_SIZE * 0.2);
      let count = 0;
      for (const key of verifiedPrimaryGuildUsers.keys()) {
        verifiedPrimaryGuildUsers.delete(key);
        if (++count >= toDelete) break;
      }
    }

    verifiedPrimaryGuildUsers.set(userId, Date.now());
  },

  /**
   * Inspect raw Gateway packets to record verified `primary_guild` fields immediately.
   */
  handleRawPacket(packet) {
    if (!packet || !packet.t || !packet.d) return;

    switch (packet.t) {
      case 'GUILD_MEMBERS_CHUNK': {
        const members = packet.d.members;
        if (Array.isArray(members)) {
          for (const m of members) {
            if (m?.user?.id && 'primary_guild' in m.user) {
              this.markPrimaryGuildVerified(m.user.id, m.user);
            }
          }
        }
        break;
      }
      case 'GUILD_MEMBER_ADD':
      case 'GUILD_MEMBER_UPDATE': {
        const rawUser = packet.d.user;
        if (rawUser?.id && 'primary_guild' in rawUser) {
          this.markPrimaryGuildVerified(rawUser.id, rawUser);
        }
        break;
      }
      case 'USER_UPDATE': {
        if (packet.d.id && 'primary_guild' in packet.d) {
          this.markPrimaryGuildVerified(packet.d.id, packet.d);
        }
        break;
      }
      default:
        break;
    }
  },

  /**
   * Clear verification state (useful for unit tests).
   */
  _clearVerificationCache() {
    verifiedPrimaryGuildUsers.clear();
  },

  /**
   * Check whether a member's `primaryGuild` state can be trusted as verified.
   */
  isPrimaryGuildVerified(memberOrUser) {
    const user = memberOrUser?.user || memberOrUser;
    if (!user || !user.id) return false;

    // Explicit test / pre-verified flag on mock objects
    if (memberOrUser?._primaryGuildVerified === true || user._primaryGuildVerified === true) {
      return true;
    }

    // A non-null primaryGuild object always came from Discord's `primary_guild` payload
    if (user.primaryGuild && typeof user.primaryGuild === 'object') {
      return true;
    }

    // If primaryGuild is null, verify we actually saw `'primary_guild' in data` recently
    const verifiedAt = verifiedPrimaryGuildUsers.get(user.id);
    if (verifiedAt && Date.now() - verifiedAt < VERIFICATION_TTL_MS) {
      return true;
    }

    return false;
  },

  /**
   * Fetch authoritative member primary_guild directly from Discord REST if Gateway status was ambiguous.
   */
  async fetchAuthoritativePrimaryGuild(guild, userId, client) {
    const rest = client?.rest;
    if (!rest || !guild?.id || !userId) {
      return { verified: false, primaryGuild: null };
    }

    try {
      const rawMember = await rest.get(Routes.guildMember(guild.id, userId));
      const rawUser = rawMember?.user;
      if (!rawUser || !('primary_guild' in rawUser)) {
        return { verified: false, primaryGuild: null };
      }

      this.markPrimaryGuildVerified(userId, rawUser);
      const normalized = normalizeRawPrimaryGuild(rawUser.primary_guild);

      // Update cached discord.js User if present
      const cachedUser = client.users?.cache?.get(userId);
      if (cachedUser && typeof cachedUser._patch === 'function') {
        cachedUser._patch(rawUser);
      }

      return { verified: true, primaryGuild: normalized };
    } catch (err) {
      logger.warn(`[ServerTag] Could not verify primary_guild via REST for user ${userId} in ${guild.id}: ${err.message}`);
      return { verified: false, primaryGuild: null };
    }
  },

  /**
   * Pure evaluation of a member's official Discord Server Tag status against a target guild.
   * Does NOT guess from nicknames, usernames, or profile bios.
   *
   * @returns {{ status: 'has_tag' | 'no_tag' | 'unverified', primaryGuild: object|null }}
   */
  evaluateMemberTagStatus(member, targetGuildId, primaryGuildOverride = undefined) {
    if (!member || !targetGuildId) {
      return { status: 'unverified', primaryGuild: null };
    }

    const user = member.user || member;
    const rawPrimaryGuild = primaryGuildOverride !== undefined ? primaryGuildOverride : user?.primaryGuild;
    const primaryGuild = normalizeRawPrimaryGuild(rawPrimaryGuild);

    if (primaryGuild && typeof primaryGuild === 'object') {
      if (primaryGuild.identityEnabled === true && primaryGuild.identityGuildId === targetGuildId) {
        return { status: 'has_tag', primaryGuild };
      }
      // Discord sent a primary_guild object with either a different guild or identityEnabled: false
      return { status: 'no_tag', primaryGuild };
    }

    // primaryGuild is null or undefined: confirm whether Discord authoritatively reported `primary_guild: null`
    if (primaryGuildOverride !== undefined || this.isPrimaryGuildVerified(member)) {
      return { status: 'no_tag', primaryGuild: null };
    }

    return { status: 'unverified', primaryGuild: null };
  },

  /**
   * Validate bot Manage Roles permission, role existence, managed status, and role hierarchy.
   */
  async validateRoleConfiguration(guild, roleId) {
    if (!guild) {
      return { valid: false, code: 'NO_GUILD', error: 'Guild is unavailable.' };
    }

    let botMember = guild.members?.me || guild.members?.cache?.get(guild.client?.user?.id);
    if (!botMember && typeof guild.members?.fetchMe === 'function') {
      botMember = await guild.members.fetchMe().catch(() => null);
    }

    if (!botMember) {
      return { valid: false, code: 'NO_BOT_MEMBER', error: 'Unable to resolve bot member in this server.' };
    }

    if (!botMember.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return {
        valid: false,
        code: 'MISSING_MANAGE_ROLES',
        error: 'AURA does not have the "Manage Roles" permission in this server.',
        botMember
      };
    }

    if (!roleId) {
      return { valid: false, code: 'NO_ROLE', error: 'No target role is configured.', botMember };
    }

    const role = guild.roles?.cache?.get(roleId);
    if (!role) {
      return {
        valid: false,
        code: 'ROLE_DELETED',
        error: 'The configured role no longer exists in this server.',
        botMember
      };
    }

    if (role.id === guild.id) {
      return {
        valid: false,
        code: 'EVERYONE_ROLE',
        error: 'The @everyone role cannot be assigned.',
        role,
        botMember
      };
    }

    if (role.managed) {
      return {
        valid: false,
        code: 'MANAGED_ROLE',
        error: `Role "${role.name}" is managed by an integration or bot and cannot be assigned manually.`,
        role,
        botMember
      };
    }

    const botHighestPos = botMember.roles?.highest?.position ?? 0;
    if (role.position >= botHighestPos) {
      return {
        valid: false,
        code: 'ROLE_HIERARCHY',
        error: `Role "${role.name}" is above or equal to AURA's highest role (${botMember.roles?.highest?.name || 'Bot Role'}). Move AURA's role above it in Server Settings > Roles.`,
        role,
        botMember
      };
    }

    return { valid: true, role, botMember };
  },

  /**
   * Inspect official guild metadata and cached members to expose Server Tag information.
   */
  detectGuildServerTagInfo(guild, config = null) {
    if (!guild) {
      return {
        supportsGuildTags: false,
        guildId: null,
        serverTagId: config?.serverTagId || null,
        tag: config?.detectedTag || null,
        badge: config?.detectedBadge || null,
        badgeUrl: null,
        adoptersInCache: 0
      };
    }

    const supportsGuildTags = Array.isArray(guild.features) && guild.features.includes('GUILD_TAGS');
    const targetTagGuildId = config?.serverTagId || guild.id;

    let tag = null;
    let badge = null;
    let adoptersInCache = 0;

    if (guild.members?.cache) {
      for (const m of guild.members.cache.values()) {
        const pg = m.user?.primaryGuild;
        if (pg && pg.identityEnabled === true && pg.identityGuildId === targetTagGuildId) {
          adoptersInCache++;
          if (!tag && pg.tag) tag = pg.tag;
          if (!badge && pg.badge) badge = pg.badge;
        }
      }
    }

    const finalTag = tag || config?.detectedTag || null;
    const finalBadge = badge || config?.detectedBadge || null;
    const badgeUrl = finalBadge
      ? `https://cdn.discordapp.com/guild-tag-badges/${targetTagGuildId}/${finalBadge}.png`
      : null;

    return {
      supportsGuildTags,
      guildId: guild.id,
      serverTagId: targetTagGuildId,
      tag: finalTag,
      badge: finalBadge,
      badgeUrl,
      adoptersInCache
    };
  },

  /**
   * Emit live Socket.IO event to any connected dashboard client viewing this guild.
   */
  emitDashboardUpdate(guildId, client, payload = {}) {
    try {
      if (client?.io && guildId) {
        client.io.to(`guild_${guildId}`).emit('server_tag_role_updated', {
          guildId,
          ...payload
        });
      }
    } catch (_) {
      // Ignore socket broadcast errors
    }
  },

  /**
   * Persist observed server tag metadata (tag string & badge hash) when discovered.
   */
  async updateDetectedMetadata(guildId, tag, badge, currentConfig) {
    if (!guildId || (!tag && !badge)) return;
    if (currentConfig?.detectedTag === tag && currentConfig?.detectedBadge === badge) return;

    const $set = {};
    if (tag) $set['serverTagRole.detectedTag'] = tag;
    if (badge) $set['serverTagRole.detectedBadge'] = badge;
    if (Object.keys($set).length === 0) return;

    await Guild.updateOne({ guildId }, { $set }).catch(() => {});
    guildService.invalidateCache(guildId);
  },

  /**
   * Check a single guild member's primary_guild status and safely add/remove ONLY the configured role.
   */
  async syncMember(member, settings = null, client = null, options = {}) {
    if (!member || !member.guild) {
      return { action: 'skipped', reason: 'missing_member' };
    }

    const guild = member.guild;
    const activeSettings = settings || await guildService.getSettings(guild.id);

    if (activeSettings?.modules?.server_tag_role === false) {
      return { action: 'disabled' };
    }

    const config = activeSettings?.serverTagRole;
    if (!config?.enabled || !config?.roleId) {
      return { action: 'disabled' };
    }

    // Avoid assigning roles to bots unless explicitly configured
    if (member.user?.bot && !config.includeBots) {
      return { action: 'skipped_bot' };
    }

    // Resolve partial member if needed before evaluating roles
    let targetMember = member;
    if (targetMember.partial && typeof targetMember.fetch === 'function') {
      try {
        targetMember = await targetMember.fetch();
      } catch (err) {
        logger.warn(`[ServerTag] Could not fetch partial member ${member.id} in ${guild.id}: ${err.message}`);
        return { action: 'skipped_unverified', reason: 'partial_fetch_failed' };
      }
    }

    // Validate permissions & role before attempting mutation
    const validation = await this.validateRoleConfiguration(guild, config.roleId);
    if (!validation.valid) {
      return { action: 'error', code: validation.code, error: validation.error };
    }

    const role = validation.role;
    const targetTagGuildId = config.serverTagId || guild.id;
    const hasRole = targetMember.roles?.cache?.has(role.id) ?? false;

    let evaluation = this.evaluateMemberTagStatus(targetMember, targetTagGuildId);

    // If unverified AND member currently holds the role, try authoritative REST check if allowed
    if (evaluation.status === 'unverified') {
      if (hasRole && options.allowRestVerify !== false) {
        const fetched = await this.fetchAuthoritativePrimaryGuild(guild, targetMember.id, client || guild.client);
        if (fetched.verified) {
          evaluation = this.evaluateMemberTagStatus(targetMember, targetTagGuildId, fetched.primaryGuild);
        }
      }

      // CRITICAL SAFETY GUARD: Never remove role if member's tag status cannot be verified
      if (evaluation.status === 'unverified') {
        return { action: 'skipped_unverified', reason: 'tag_info_unavailable' };
      }
    }

    // 1. Member adopted this server's tag and lacks the role -> Assign ONLY the configured role
    if (evaluation.status === 'has_tag' && !hasRole) {
      try {
        await targetMember.roles.add(role.id, `Server Tag Auto Role (${evaluation.primaryGuild?.tag || targetTagGuildId})`);
        logger.info(`[ServerTag] Assigned role [${role.name}] to ${targetMember.user?.tag || targetMember.id} in ${guild.name} (Source: ${options.source || 'event'})`);

        await this.updateDetectedMetadata(
          guild.id,
          evaluation.primaryGuild?.tag || null,
          evaluation.primaryGuild?.badge || null,
          config
        );

        if (!options.suppressSocketEmit) {
          this.emitDashboardUpdate(guild.id, client || guild.client, {
            event: 'member_assigned',
            userId: targetMember.id
          });
        }

        return {
          action: 'assigned',
          role,
          tag: evaluation.primaryGuild?.tag || null
        };
      } catch (err) {
        logger.warn(`[ServerTag] Failed assigning role [${role.name}] to ${targetMember.id} in ${guild.name}: ${err.message}`);
        return { action: 'error', code: 'ROLE_ADD_FAILED', error: err.message };
      }
    }

    // Keep cached tag metadata fresh even if member already had role
    if (evaluation.status === 'has_tag' && (evaluation.primaryGuild?.tag || evaluation.primaryGuild?.badge)) {
      this.updateDetectedMetadata(
        guild.id,
        evaluation.primaryGuild.tag || null,
        evaluation.primaryGuild.badge || null,
        config
      ).catch(() => {});
    }

    // 2. Member verified as NOT holding this server's tag (removed or switched tag) -> Remove ONLY the configured role
    if (evaluation.status === 'no_tag' && hasRole) {
      try {
        await targetMember.roles.remove(role.id, `Server Tag Auto Role: tag removed or changed in ${guild.name}`);
        logger.info(`[ServerTag] Removed role [${role.name}] from ${targetMember.user?.tag || targetMember.id} in ${guild.name} (Source: ${options.source || 'event'})`);

        if (!options.suppressSocketEmit) {
          this.emitDashboardUpdate(guild.id, client || guild.client, {
            event: 'member_removed',
            userId: targetMember.id
          });
        }

        return { action: 'removed', role };
      } catch (err) {
        logger.warn(`[ServerTag] Failed removing role [${role.name}] from ${targetMember.id} in ${guild.name}: ${err.message}`);
        return { action: 'error', code: 'ROLE_REMOVE_FAILED', error: err.message };
      }
    }

    return { action: 'unchanged' };
  },

  /**
   * Synchronize all eligible members in a guild.
   * Respects rate limits, preserves unrelated roles, and skips removal when tag status is unverified.
   */
  async syncGuild(guild, settings = null, client = null, options = {}) {
    if (!guild) {
      return { success: false, error: 'Server not found in bot cache.' };
    }

    if (activeGuildSyncs.has(guild.id)) {
      return { success: false, inProgress: true, error: 'A synchronization is already running for this server.' };
    }

    // Cooldown protection for automatic reconnect/startup bursts unless explicitly forced
    if (options.autoCooldown) {
      const lastTrigger = lastAutoSyncTrigger.get(guild.id) || 0;
      if (Date.now() - lastTrigger < AUTO_SYNC_COOLDOWN_MS) {
        return { success: false, skippedCooldown: true };
      }
      lastAutoSyncTrigger.set(guild.id, Date.now());
    }

    activeGuildSyncs.add(guild.id);

    try {
      const activeSettings = settings || await guildService.getSettings(guild.id);
      if (activeSettings?.modules?.server_tag_role === false) {
        return { success: false, error: 'Server Tag Auto Role module is disabled in Server Modules.' };
      }

      const config = activeSettings?.serverTagRole;
      if (!config?.enabled || !config?.roleId) {
        return { success: false, error: 'Server Tag Auto Role is disabled or has no role selected.' };
      }

      const validation = await this.validateRoleConfiguration(guild, config.roleId);
      if (!validation.valid) {
        await Guild.updateOne(
          { guildId: guild.id },
          {
            $set: {
              'serverTagRole.lastSyncAt': new Date(),
              'serverTagRole.lastSyncStatus': 'error',
              'serverTagRole.lastSyncMessage': validation.error
            }
          }
        ).catch(() => {});
        guildService.invalidateCache(guild.id);
        this.emitDashboardUpdate(guild.id, client || guild.client, { event: 'sync_error', error: validation.error });
        return { success: false, code: validation.code, error: validation.error };
      }

      const role = validation.role;
      const targetTagGuildId = config.serverTagId || guild.id;

      await Guild.updateOne(
        { guildId: guild.id },
        { $set: { 'serverTagRole.lastSyncStatus': 'syncing' } }
      ).catch(() => {});

      let membersFetchedFresh = false;
      let members;
      try {
        // Fetches authoritative member chunks via Gateway (includes primary_guild on Discord API v10)
        members = await guild.members.fetch();
        membersFetchedFresh = true;
      } catch (err) {
        logger.warn(`[ServerTag] Gateway members fetch failed in ${guild.name}, falling back cleanly to cache: ${err.message}`);
        members = guild.members.cache;
      }

      const stats = {
        checked: 0,
        assigned: 0,
        removed: 0,
        skippedUnverified: 0,
        errors: 0
      };

      const mutationPaceMs = options.paceMs ?? 150;
      let restChecksUsed = 0;
      const MAX_REST_CHECKS_PER_SYNC = 25;

      for (const member of members.values()) {
        if (member.user?.bot && !config.includeBots) continue;

        const hasRole = member.roles?.cache?.has(role.id) ?? false;
        const primaryGuild = member.user?.primaryGuild;
        const matchesThisServer = primaryGuild?.identityEnabled === true && primaryGuild?.identityGuildId === targetTagGuildId;

        // Fast-path optimization: only mutate or REST-verify members who either hold the role OR have this guild's tag
        if (!hasRole && !matchesThisServer) {
          stats.checked++;
          continue;
        }

        stats.checked++;

        const allowRestVerify = restChecksUsed < MAX_REST_CHECKS_PER_SYNC;
        if (hasRole && primaryGuild === null && !this.isPrimaryGuildVerified(member) && allowRestVerify) {
          restChecksUsed++;
        }

        const res = await this.syncMember(member, activeSettings, client || guild.client, {
          source: options.source || 'sync',
          allowRestVerify,
          suppressSocketEmit: true
        });

        if (res.action === 'assigned') {
          stats.assigned++;
          if (mutationPaceMs > 0) await sleep(mutationPaceMs);
        } else if (res.action === 'removed') {
          stats.removed++;
          if (mutationPaceMs > 0) await sleep(mutationPaceMs);
        } else if (res.action === 'skipped_unverified') {
          stats.skippedUnverified++;
        } else if (res.action === 'error') {
          stats.errors++;
        }
      }

      const tagInfo = this.detectGuildServerTagInfo(guild, config);
      const activeMemberCount = guild.members?.cache
        ? guild.members.cache.filter(m => m.roles?.cache?.has(role.id) && (config.includeBots || !m.user?.bot)).size
        : (role.members?.size ?? 0);

      let status = 'success';
      let message = `Synced ${stats.checked} member(s): +${stats.assigned} assigned, -${stats.removed} removed.`;
      if (stats.errors > 0 || stats.skippedUnverified > 0 || !membersFetchedFresh) {
        status = stats.errors > 0 && stats.assigned === 0 && stats.removed === 0 ? 'error' : 'partial';
        message = `Checked ${stats.checked}: +${stats.assigned} assigned, -${stats.removed} removed, ${stats.skippedUnverified} skipped (unverified), ${stats.errors} errors.`;
      }

      const $set = {
        'serverTagRole.activeMemberCount': activeMemberCount,
        'serverTagRole.lastSyncAt': new Date(),
        'serverTagRole.lastSyncStatus': status,
        'serverTagRole.lastSyncMessage': message,
        'serverTagRole.lastSyncStats': stats
      };
      if (tagInfo.tag) $set['serverTagRole.detectedTag'] = tagInfo.tag;
      if (tagInfo.badge) $set['serverTagRole.detectedBadge'] = tagInfo.badge;

      await Guild.updateOne({ guildId: guild.id }, { $set }).catch(() => {});
      guildService.invalidateCache(guild.id);

      this.emitDashboardUpdate(guild.id, client || guild.client, {
        event: 'sync_complete',
        stats,
        tagInfo,
        activeMemberCount,
        lastSyncStatus: status,
        lastSyncMessage: message
      });

      return {
        success: true,
        stats,
        tagInfo,
        activeMemberCount,
        status,
        message
      };
    } catch (err) {
      logger.error(`[ServerTag] Sync error for guild ${guild.id}: ${err.message}`);
      await Guild.updateOne(
        { guildId: guild.id },
        {
          $set: {
            'serverTagRole.lastSyncAt': new Date(),
            'serverTagRole.lastSyncStatus': 'error',
            'serverTagRole.lastSyncMessage': err.message
          }
        }
      ).catch(() => {});
      guildService.invalidateCache(guild.id);
      return { success: false, error: err.message };
    } finally {
      activeGuildSyncs.delete(guild.id);
    }
  },

  /**
   * Synchronize all guilds where Server Tag Auto Role is enabled (startup / reconnect / periodic).
   */
  async syncAllEnabledGuilds(client, source = 'periodic', staggerMs = 1500) {
    if (!client?.guilds?.cache) return;

    try {
      const enabledDocs = await Guild.find({ 'serverTagRole.enabled': true }).lean();
      for (const doc of enabledDocs) {
        const guild = client.guilds.cache.get(doc.guildId);
        if (!guild) continue;

        const settings = await guildService.getSettings(guild.id);
        await this.syncGuild(guild, settings, client, {
          source,
          autoCooldown: source === 'reconnect'
        });

        if (staggerMs > 0) await sleep(staggerMs);
      }
    } catch (err) {
      logger.error(`[ServerTag] Error running ${source} sync across guilds: ${err.message}`);
    }
  },

  /**
   * Safely handle a member leaving a server (no error if role or member is gone).
   */
  async handleMemberLeave(member, settings = null, client = null) {
    if (!member || !member.guild) return;
    const config = settings?.serverTagRole;
    if (!config?.enabled || !config?.roleId) return;

    if (member.roles?.cache?.has(config.roleId)) {
      const remainingCount = member.guild.members?.cache
        ? member.guild.members.cache.filter(
            m => m.id !== member.id && m.roles?.cache?.has(config.roleId) && (config.includeBots || !m.user?.bot)
          ).size
        : Math.max(0, (config.activeMemberCount || 1) - 1);

      await Guild.updateOne(
        { guildId: member.guild.id },
        { $set: { 'serverTagRole.activeMemberCount': remainingCount } }
      ).catch(() => {});
      guildService.invalidateCache(member.guild.id);

      this.emitDashboardUpdate(member.guild.id, client || member.guild.client, {
        event: 'member_left',
        userId: member.id,
        activeMemberCount: remainingCount
      });
    }
  },

  /**
   * Initialize startup reconciliation and periodic background sync scheduler.
   */
  init(client) {
    // Initial sync shortly after ready (members cache already warming up)
    setTimeout(() => {
      this.syncAllEnabledGuilds(client, 'startup', 1500).catch(() => {});
    }, 8000);

    // Periodic fallback synchronization every 15 minutes
    setInterval(() => {
      this.syncAllEnabledGuilds(client, 'periodic', 2000).catch(() => {});
    }, PERIODIC_SYNC_INTERVAL_MS);

    logger.info('🏷️ Server Tag Auto Role Service initialized (Official primary_guild API + 15m sync).');
  }
};

module.exports = serverTagService;
