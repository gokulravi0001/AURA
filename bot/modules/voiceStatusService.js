const { Routes, ChannelType, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');

// In-memory cache for fast lookups & anti-spam debounce
// channelId -> status string currently on Discord
const statusCache = new Map();
// channelId -> last enforcement timestamp (ms)
const cooldownCache = new Map();
// channelId -> { guildId, template, lastApplied } for dynamic live-updating statuses
const dynamicChannelsCache = new Map();
// guildId set for debouncing member join/leave dynamic status updates
const pendingDynamicUpdates = new Set();

const voiceStatusService = {
  /**
   * Parse status input and expand 'stats' shorthand with custom emojis
   * e.g. 'stats <:online:123> <:members:456>' -> '<:online:123> {online} Online • <:members:456> {members} Members'
   * or 'stats' -> '🟢 {online} Online • 👥 {members} Members'
   */
  parseStatsTemplate(input) {
    const trimmed = (input || '').trim();
    if (/^stats\b/i.test(trimmed)) {
      const parts = trimmed.split(/\s+/).slice(1);
      const onlineEmoji = parts[0] || '🟢';
      const membersEmoji = parts[1] || '👥';
      return `${onlineEmoji} {online} Online • ${membersEmoji} {members} Members`;
    }
    return trimmed;
  },

  /**
   * Check if a template contains dynamic placeholders (e.g. {online}, {members})
   */
  isDynamicTemplate(text) {
    return /\{online(?:_humans|_members)?\}|\{members\}|\{humans\}|\{human_members\}/i.test(text || '');
  },

  /**
   * Calculate guild human counts strictly excluding bots
   */
  async getGuildMemberCounts(guild) {
    if (!guild) return { totalMembers: 0, humanMembers: 0, onlineHumans: 0, botCount: 0 };

    let approximatePresence = guild.approximatePresenceCount;
    let approximateMembers = guild.memberCount || guild.approximateMemberCount;

    // Fetch guild counts via REST if missing
    if (typeof guild.fetch === 'function' && (approximatePresence === undefined || approximateMembers === undefined)) {
      const fetched = await guild.fetch().catch(() => null);
      if (fetched) {
        approximatePresence = fetched.approximatePresenceCount;
        approximateMembers = fetched.memberCount || fetched.approximateMemberCount;
      }
    }

    // Ensure member cache is available to accurately count bots
    if (typeof guild.members?.fetch === 'function' && (guild.members?.cache?.size || 0) < Math.min(approximateMembers || 10, 50)) {
      await guild.members.fetch().catch(() => {});
    }

    const memberCache = guild.members?.cache || new Map();
    let botCount = 0;
    let cachedOnlineHumans = 0;
    let cachedOnlineBots = 0;

    if (typeof memberCache.forEach === 'function') {
      memberCache.forEach(m => {
        const isBot = Boolean(m.user?.bot);
        const isOnline = m.presence && m.presence.status !== 'offline';
        if (isBot) {
          botCount++;
          if (isOnline) cachedOnlineBots++;
        } else {
          if (isOnline) cachedOnlineHumans++;
        }
      });
    }

    const totalMembers = approximateMembers || guild.memberCount || memberCache.size || 0;
    const humanMembers = Math.max(0, totalMembers - botCount);

    // Approximate online humans (excluding bots)
    const estimatedOnlineBots = cachedOnlineBots > 0 ? cachedOnlineBots : botCount;
    const approximateOnlineHumans = Math.max(0, (approximatePresence || 0) - estimatedOnlineBots);

    const onlineHumans = Math.max(cachedOnlineHumans, approximateOnlineHumans);

    return {
      totalMembers,
      humanMembers,
      onlineHumans,
      botCount
    };
  },

  /**
   * Resolve dynamic template placeholders with live counts
   */
  async resolveStatusTemplate(guild, template) {
    if (!template) return '';
    const counts = await this.getGuildMemberCounts(guild);
    return template
      .replace(/\{online(?:_humans|_members)?\}/gi, String(counts.onlineHumans))
      .replace(/\{members\}|\{humans\}|\{human_members\}/gi, String(counts.humanMembers))
      .replace(/\{total\}/gi, String(counts.totalMembers))
      .replace(/\{bots\}/gi, String(counts.botCount));
  },

  /**
   * Set or update a permanent voice channel status (supports live dynamic counts and custom emojis)
   */
  async setPermanentStatus(guild, channelId, statusText, setBy, client) {
    if (!guild || !channelId) {
      throw new Error('Guild and Channel ID are required.');
    }

    const rawStatus = (statusText || '').trim();
    if (!rawStatus) {
      throw new Error('Status text cannot be empty. Use remove to clear status.');
    }

    // Parse stats template shorthand if provided
    const parsedTemplate = this.parseStatsTemplate(rawStatus);
    const isDynamic = this.isDynamicTemplate(parsedTemplate);

    let evaluatedStatus = parsedTemplate;
    let counts = null;
    if (isDynamic) {
      counts = await this.getGuildMemberCounts(guild);
      evaluatedStatus = await this.resolveStatusTemplate(guild, parsedTemplate);
    }

    if (evaluatedStatus.length > 500) {
      throw new Error('Voice channel status cannot exceed 500 characters.');
    }

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      throw new Error(`Voice channel <#${channelId}> was not found in this server.`);
    }

    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
      throw new Error(`Channel <#${channelId}> is not a voice or stage channel.`);
    }

    // Check bot permissions
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasPerm = botMember && (
      botMember.permissions.has(PermissionFlagsBits.Administrator) ||
      channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SetVoiceChannelStatus) ||
      channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageChannels)
    );

    if (!hasPerm) {
      throw new Error('I do not have the **Set Voice Channel Status** or **Manage Channels** permission in that voice channel.');
    }

    // 1. Update Database
    let guildDoc = await Guild.findOne({ guildId: guild.id });
    if (!guildDoc) {
      guildDoc = await Guild.create({ guildId: guild.id, name: guild.name });
    }

    if (!Array.isArray(guildDoc.permanentVoiceStatuses)) {
      guildDoc.permanentVoiceStatuses = [];
    }

    const existingIdx = guildDoc.permanentVoiceStatuses.findIndex(s => s.channelId === channelId);
    if (existingIdx !== -1) {
      guildDoc.permanentVoiceStatuses[existingIdx].status = parsedTemplate;
      guildDoc.permanentVoiceStatuses[existingIdx].template = parsedTemplate;
      guildDoc.permanentVoiceStatuses[existingIdx].isDynamic = isDynamic;
      guildDoc.permanentVoiceStatuses[existingIdx].lastAppliedStatus = evaluatedStatus;
      guildDoc.permanentVoiceStatuses[existingIdx].enabled = true;
      guildDoc.permanentVoiceStatuses[existingIdx].setBy = setBy;
      guildDoc.permanentVoiceStatuses[existingIdx].updatedAt = new Date();
    } else {
      guildDoc.permanentVoiceStatuses.push({
        channelId,
        status: parsedTemplate,
        template: parsedTemplate,
        isDynamic,
        lastAppliedStatus: evaluatedStatus,
        enabled: true,
        setBy,
        updatedAt: new Date()
      });
    }

    await guildDoc.save();

    // 2. Update In-Memory Cache
    statusCache.set(channelId, evaluatedStatus);
    cooldownCache.set(channelId, Date.now());

    if (isDynamic) {
      dynamicChannelsCache.set(channelId, {
        guildId: guild.id,
        template: parsedTemplate,
        lastApplied: evaluatedStatus
      });
    } else {
      dynamicChannelsCache.delete(channelId);
    }

    // 3. Apply to Discord
    await this.applyStatusToDiscord(client, channelId, evaluatedStatus, `Permanent VC Status by ${setBy || 'Admin'}`);

    logger.info(`[VoiceStatus] Set permanent status on channel ${channel.name} (${channel.id}) in ${guild.name}: "${evaluatedStatus}"${isDynamic ? ' (Live Dynamic)' : ''}`);
    return {
      channel,
      status: evaluatedStatus,
      template: parsedTemplate,
      isDynamic,
      counts
    };
  },

  /**
   * Remove a permanent voice channel status
   */
  async removePermanentStatus(guild, channelId, client) {
    if (!guild || !channelId) {
      throw new Error('Guild and Channel ID are required.');
    }

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);

    // 1. Update Database
    const guildDoc = await Guild.findOne({ guildId: guild.id });
    if (guildDoc && Array.isArray(guildDoc.permanentVoiceStatuses)) {
      guildDoc.permanentVoiceStatuses = guildDoc.permanentVoiceStatuses.filter(s => s.channelId !== channelId);
      await guildDoc.save();
    }

    // 2. Update Cache
    statusCache.delete(channelId);
    cooldownCache.delete(channelId);
    dynamicChannelsCache.delete(channelId);

    // 3. Clear on Discord
    if (client) {
      await this.applyStatusToDiscord(client, channelId, '', 'Permanent VC Status Removed');
    }

    logger.info(`[VoiceStatus] Removed permanent status on channel ${channelId} in ${guild.name}`);
    return { channel, channelId };
  },

  /**
   * Get all permanent statuses configured for a guild
   */
  async getStatuses(guildId) {
    const guildDoc = await Guild.findOne({ guildId }).lean();
    return (guildDoc?.permanentVoiceStatuses || []).filter(s => s.enabled);
  },

  /**
   * Get single permanent status for a specific channel
   */
  async getStatus(guildId, channelId) {
    if (statusCache.has(channelId)) {
      const dynamicInfo = dynamicChannelsCache.get(channelId);
      return {
        channelId,
        status: statusCache.get(channelId),
        template: dynamicInfo?.template || statusCache.get(channelId),
        isDynamic: Boolean(dynamicInfo),
        enabled: true
      };
    }

    const guildDoc = await Guild.findOne({ guildId }).lean();
    const entry = (guildDoc?.permanentVoiceStatuses || []).find(s => s.channelId === channelId && s.enabled);
    if (entry) {
      const isDynamic = entry.isDynamic || this.isDynamicTemplate(entry.template || entry.status);
      statusCache.set(channelId, entry.lastAppliedStatus || entry.status);
      if (isDynamic) {
        dynamicChannelsCache.set(channelId, {
          guildId,
          template: entry.template || entry.status,
          lastApplied: entry.lastAppliedStatus || entry.status
        });
      }
    }
    return entry || null;
  },

  /**
   * Send the voice status update directly to Discord via REST
   */
  async applyStatusToDiscord(client, channelId, statusText, reason = 'Permanent Voice Status') {
    if (!client || !channelId) return;

    try {
      await client.rest.put(Routes.channelVoiceStatus(channelId), {
        body: { status: statusText || '' },
        reason
      });
    } catch (err) {
      logger.warn(`[VoiceStatus] Failed to apply status to channel ${channelId}:`, err.message);
    }
  },

  /**
   * Update all dynamic channels with fresh live member counts
   */
  async updateDynamicStatuses(client, targetGuildId = null) {
    if (!client) return;

    for (const [channelId, info] of dynamicChannelsCache.entries()) {
      if (targetGuildId && info.guildId !== targetGuildId) continue;

      const guild = client.guilds.cache.get(info.guildId);
      if (!guild) continue;

      try {
        const freshStatus = await this.resolveStatusTemplate(guild, info.template);
        if (freshStatus && freshStatus !== info.lastApplied) {
          info.lastApplied = freshStatus;
          statusCache.set(channelId, freshStatus);
          await this.applyStatusToDiscord(client, channelId, freshStatus, 'Live Dynamic VC Status Update');
          logger.info(`[VoiceStatus] Refreshed live dynamic status on channel ${channelId} in ${guild.name}: "${freshStatus}"`);

          await Guild.updateOne(
            { guildId: guild.id, 'permanentVoiceStatuses.channelId': channelId },
            { $set: { 'permanentVoiceStatuses.$.lastAppliedStatus': freshStatus, 'permanentVoiceStatuses.$.updatedAt': new Date() } }
          ).catch(() => {});
        }
      } catch (err) {
        logger.warn(`[VoiceStatus] Error updating dynamic status on channel ${channelId}:`, err.message);
      }
    }
  },

  /**
   * Queue debounced update for a guild when members join or leave
   */
  queueDynamicStatusUpdate(guild, client) {
    if (!guild || !client) return;
    if (pendingDynamicUpdates.has(guild.id)) return;
    pendingDynamicUpdates.add(guild.id);

    setTimeout(async () => {
      pendingDynamicUpdates.delete(guild.id);
      await this.updateDynamicStatuses(client, guild.id);
    }, 10000);
  },

  /**
   * Enforce permanent status if it was changed or cleared on Discord
   */
  async enforceChannelStatus(client, guildId, channelId, currentDiscordStatus) {
    if (!client || !channelId) return;

    // Check anti-spam cooldown: minimum 3 seconds between reapplying to the same channel
    const lastApply = cooldownCache.get(channelId) || 0;
    const now = Date.now();
    if (now - lastApply < 3000) return;

    let targetStatus = statusCache.get(channelId);
    const dynamicInfo = dynamicChannelsCache.get(channelId);

    // If channel is dynamic, re-resolve with latest counts before enforcing
    if (dynamicInfo) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        targetStatus = await this.resolveStatusTemplate(guild, dynamicInfo.template);
        dynamicInfo.lastApplied = targetStatus;
      }
    } else if (targetStatus === undefined) {
      const entry = await this.getStatus(guildId, channelId);
      targetStatus = entry?.status || null;
    }

    if (!targetStatus) return;

    // If Discord already has this exact status, no action needed
    if (currentDiscordStatus !== undefined && currentDiscordStatus === targetStatus) {
      return;
    }

    cooldownCache.set(channelId, now);
    statusCache.set(channelId, targetStatus);
    logger.info(`[VoiceStatus] Re-enforcing permanent status on channel ${channelId}: "${targetStatus}"`);
    await this.applyStatusToDiscord(client, channelId, targetStatus, 'Permanent VC Status auto-restore');
  },

  /**
   * Handle raw gateway packets (e.g. VOICE_CHANNEL_STATUS_UPDATE)
   */
  async handleRawPacket(packet, client) {
    if (packet?.t !== 'VOICE_CHANNEL_STATUS_UPDATE') return;
    const { id: channelId, guild_id: guildId, status: newStatus } = packet.d || {};
    if (!channelId || !guildId) return;

    const expected = statusCache.get(channelId);
    if (expected !== undefined) {
      if (newStatus !== expected) {
        setTimeout(() => {
          this.enforceChannelStatus(client, guildId, channelId, newStatus);
        }, 1500);
      }
      return;
    }

    const entry = await this.getStatus(guildId, channelId);
    if (entry && (entry.lastAppliedStatus || entry.status) !== newStatus) {
      setTimeout(() => {
        this.enforceChannelStatus(client, guildId, channelId, newStatus);
      }, 1500);
    }
  },

  /**
   * Handle voiceStateUpdate: when people leave or channel becomes empty, re-assert
   */
  async handleVoiceStateUpdate(oldState, newState, client) {
    const channelId = oldState?.channelId;
    if (!channelId || oldState.channelId === newState?.channelId) return;

    const guildId = oldState.guild?.id;
    if (!guildId) return;

    if (statusCache.has(channelId)) {
      setTimeout(() => {
        this.enforceChannelStatus(client, guildId, channelId);
      }, 2000);
    }
  },

  /**
   * Handle channel deletion to clean up database and cache
   */
  async handleChannelDelete(channel) {
    if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) return;
    statusCache.delete(channel.id);
    cooldownCache.delete(channel.id);
    dynamicChannelsCache.delete(channel.id);

    try {
      await Guild.updateOne(
        { guildId: channel.guild.id },
        { $pull: { permanentVoiceStatuses: { channelId: channel.id } } }
      );
    } catch (e) {
      // ignore
    }
  },

  /**
   * Initialize service on startup: load all permanent statuses, resolve dynamic counts, and apply them
   */
  async init(client) {
    logger.info('[VoiceStatus] Initializing Permanent Voice Status Service...');

    try {
      const guildsWithStatus = await Guild.find({
        'permanentVoiceStatuses.0': { $exists: true }
      }).lean();

      let count = 0;
      for (const guildDoc of guildsWithStatus) {
        const guild = client.guilds.cache.get(guildDoc.guildId);
        if (!guild) continue;

        for (const entry of (guildDoc.permanentVoiceStatuses || [])) {
          if (!entry.enabled || !entry.channelId || !entry.status) continue;

          const isDynamic = entry.isDynamic || this.isDynamicTemplate(entry.template || entry.status);
          let targetStatus = entry.status;

          if (isDynamic) {
            const template = entry.template || entry.status;
            targetStatus = await this.resolveStatusTemplate(guild, template);
            dynamicChannelsCache.set(entry.channelId, {
              guildId: guildDoc.guildId,
              template,
              lastApplied: targetStatus
            });
          }

          statusCache.set(entry.channelId, targetStatus);

          // Apply to Discord
          await this.applyStatusToDiscord(client, entry.channelId, targetStatus, 'Permanent VC Status startup sync');
          count++;
        }
      }

      logger.success(`[VoiceStatus] Loaded and applied ${count} permanent voice statuses across servers (${dynamicChannelsCache.size} dynamic).`);

      // Periodic dynamic status refresh: every 5 minutes, update all dynamic stats statuses
      setInterval(async () => {
        try {
          await this.updateDynamicStatuses(client);
        } catch (err) {
          logger.warn('[VoiceStatus] Periodic dynamic sync error:', err.message);
        }
      }, 5 * 60 * 1000);

      // Periodic health check: every 15 minutes, re-assert all statuses
      setInterval(async () => {
        try {
          for (const [channelId, status] of statusCache.entries()) {
            await this.applyStatusToDiscord(client, channelId, status, 'Periodic Permanent VC Status Sync');
          }
        } catch (err) {
          logger.warn('[VoiceStatus] Periodic sync error:', err.message);
        }
      }, 15 * 60 * 1000);

    } catch (err) {
      logger.error('[VoiceStatus] Initialization error:', err.message);
    }
  }
};

module.exports = voiceStatusService;
