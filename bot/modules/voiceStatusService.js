const { Routes, ChannelType, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');

// In-memory cache for fast lookups & anti-spam debounce
// channelId -> status string
const statusCache = new Map();
// channelId -> last enforcement timestamp (ms)
const cooldownCache = new Map();

const voiceStatusService = {
  /**
   * Set or update a permanent voice channel status
   */
  async setPermanentStatus(guild, channelId, statusText, setBy, client) {
    if (!guild || !channelId) {
      throw new Error('Guild and Channel ID are required.');
    }

    const cleanStatus = (statusText || '').trim();
    if (!cleanStatus) {
      throw new Error('Status text cannot be empty. Use remove to clear status.');
    }

    if (cleanStatus.length > 500) {
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
      guildDoc.permanentVoiceStatuses[existingIdx].status = cleanStatus;
      guildDoc.permanentVoiceStatuses[existingIdx].enabled = true;
      guildDoc.permanentVoiceStatuses[existingIdx].setBy = setBy;
      guildDoc.permanentVoiceStatuses[existingIdx].updatedAt = new Date();
    } else {
      guildDoc.permanentVoiceStatuses.push({
        channelId,
        status: cleanStatus,
        enabled: true,
        setBy,
        updatedAt: new Date()
      });
    }

    await guildDoc.save();

    // 2. Update Cache
    statusCache.set(channelId, cleanStatus);
    cooldownCache.set(channelId, Date.now());

    // 3. Apply to Discord
    await this.applyStatusToDiscord(client, channelId, cleanStatus, `Permanent VC Status by ${setBy || 'Admin'}`);

    logger.info(`[VoiceStatus] Set permanent status on channel ${channel.name} (${channel.id}) in ${guild.name}: "${cleanStatus}"`);
    return { channel, status: cleanStatus };
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
      return { channelId, status: statusCache.get(channelId), enabled: true };
    }

    const guildDoc = await Guild.findOne({ guildId }).lean();
    const entry = (guildDoc?.permanentVoiceStatuses || []).find(s => s.channelId === channelId && s.enabled);
    if (entry) {
      statusCache.set(channelId, entry.status);
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
   * Enforce permanent status if it was changed or cleared on Discord
   */
  async enforceChannelStatus(client, guildId, channelId, currentDiscordStatus) {
    if (!client || !channelId) return;

    // Check anti-spam cooldown: minimum 3 seconds between reapplying to the same channel
    const lastApply = cooldownCache.get(channelId) || 0;
    const now = Date.now();
    if (now - lastApply < 3000) return;

    let targetStatus = statusCache.get(channelId);
    if (targetStatus === undefined) {
      const entry = await this.getStatus(guildId, channelId);
      targetStatus = entry?.status || null;
    }

    if (!targetStatus) return;

    // If Discord already has this exact status, no action needed
    if (currentDiscordStatus !== undefined && currentDiscordStatus === targetStatus) {
      return;
    }

    cooldownCache.set(channelId, now);
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

    // If channel has a permanent status and new status is different (or cleared)
    const expected = statusCache.get(channelId);
    if (expected !== undefined) {
      if (newStatus !== expected) {
        setTimeout(() => {
          this.enforceChannelStatus(client, guildId, channelId, newStatus);
        }, 1500);
      }
      return;
    }

    // If not in cache, check DB
    const entry = await this.getStatus(guildId, channelId);
    if (entry && entry.status !== newStatus) {
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

    // If a permanent status is saved, enforce it after a short moment
    if (statusCache.has(channelId)) {
      setTimeout(() => {
        this.enforceChannelStatus(client, guildId, channelId);
      }, 2000);
    }
  },

  /**
   * Handle channel deletion to clean up database
   */
  async handleChannelDelete(channel) {
    if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) return;
    statusCache.delete(channel.id);
    cooldownCache.delete(channel.id);

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
   * Initialize service on startup: load all permanent statuses and apply them
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
          statusCache.set(entry.channelId, entry.status);

          // Apply to Discord
          await this.applyStatusToDiscord(client, entry.channelId, entry.status, 'Permanent VC Status startup sync');
          count++;
        }
      }

      logger.success(`[VoiceStatus] Loaded and applied ${count} permanent voice statuses across servers.`);

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
