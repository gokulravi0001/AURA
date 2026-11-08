const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Invite = require('../../models/Invite');
const MemberInvite = require('../../models/MemberInvite');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const guildService = require('../../shared/guildService');
const { isBotOwner } = require('../../shared/permissionHelper');
const whitelistService = require('../../shared/whitelistService');

// Fast in-memory cache of guild invites: Map<guildId, Map<inviteCode, uses>>
const guildInvitesCache = new Map();
const guildVanityCache = new Map();

const inviteService = {
  /**
   * Pre-fetch all server invites upon bot startup / ready
   */
  async init(client) {
    for (const guild of client.guilds.cache.values()) {
      await this.cacheGuildInvites(guild);
    }
    logger.info('Invite tracker initialized and cached all guild invites.');
  },

  /**
   * Cache all invites for a specific guild
   */
  async cacheGuildInvites(guild) {
    if (!guild) return;
    try {
      const invites = await guild.invites.fetch().catch(() => null);
      if (invites) {
        const inviteMap = new Map();
        for (const [code, inv] of invites) {
          inviteMap.set(code, inv.uses || 0);
        }
        guildInvitesCache.set(guild.id, inviteMap);
      }

      // Check vanity if available
      if (guild.vanityURLCode) {
        const vanity = await guild.fetchVanityData().catch(() => null);
        if (vanity) {
          guildVanityCache.set(guild.id, vanity.uses || 0);
        }
      }
    } catch (err) {
      // Missing permissions to view invites
    }
  },

  /**
   * Checks whether a user is authorized to create / share invites
   */
  async isUserAuthorizedToInvite(userId, guild, settings, client) {
    if (!userId || !guild) return false;
    const uid = String(userId);

    // 1. Bot Developer / Owner bypass
    if (isBotOwner(uid, client)) return true;

    // 2. Server Owner bypass
    if (guild.ownerId === uid) return true;

    // 3. Whitelisted Member bypass
    if (whitelistService.isWhitelisted(uid, guild.id, settings)) return true;

    // 4. Administrator permission check
    const member = await guild.members.fetch(uid).catch(() => null);
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

    // 5. Configured Inviter Role check
    const roleId = settings?.inviteGuard?.roleId;
    if (roleId && member.roles.cache.has(roleId)) return true;

    return false;
  },

  /**
   * Handle invite create event with Inviter Role enforcement
   */
  async handleInviteCreate(invite, client) {
    if (!invite || !invite.guild) return;

    try {
      const settings = await guildService.getSettings(invite.guild.id);
      const guard = settings?.inviteGuard;

      // Check if Inviter Guard module is active and role is set
      if (settings?.modules?.invite_guard !== false && guard?.enabled && guard?.roleId) {
        const inviter = invite.inviter;

        // If inviter is bot itself, allow
        if (inviter && inviter.id === client?.user?.id) {
          // Allowed
        } else if (inviter) {
          const authorized = await this.isUserAuthorizedToInvite(inviter.id, invite.guild, settings, client);

          if (!authorized) {
            const inviteCode = invite.code;
            // Immediately delete the unauthorized invite
            await invite.delete('AURA Inviter Role Guard: Member lacks the required Inviter role.').catch(() => {});

            // Alert the member via DM
            try {
              const dmEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('🛡️ Unauthorized Invite Link Blocked')
                .setDescription(
                  `Hello **${inviter.username}**! In **${invite.guild.name}**, only members with the <@&${guard.roleId}> role are authorized to generate server invite links.\n\n` +
                  `❌ The invite link you created (\`${inviteCode}\`) was automatically deleted.`
                )
                .setFooter({ text: invite.guild.name, iconURL: invite.guild.iconURL({ dynamic: true }) })
                .setTimestamp();

              await inviter.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (_) {}

            // Log to channel if configured
            const logChannelId = guard.logChannelId || settings?.inviteTracker?.channelId;
            if (logChannelId) {
              const channel = invite.guild.channels.cache.get(logChannelId);
              if (channel && channel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                  .setColor(COLORS.ERROR)
                  .setTitle('🛡️ Unauthorized Invite Intercepted & Deleted')
                  .setDescription(
                    `👤 **User:** <@${inviter.id}> (\`${inviter.tag}\`)\n` +
                    `🔗 **Invite Code:** \`${inviteCode}\` *(Deleted)*\n` +
                    `📍 **Channel:** ${invite.channel ? `<#${invite.channel.id}>` : 'Unknown'}\n` +
                    `⚠️ **Reason:** Missing required Inviter role (<@&${guard.roleId}>).`
                  )
                  .setTimestamp();

                await channel.send({ embeds: [logEmbed] }).catch(() => {});
              }
            }

            logger.warn(`[InviteGuard] Deleted unauthorized invite ${inviteCode} created by ${inviter.tag} in ${invite.guild.name}`);
            return; // Do not cache deleted invite
          }
        }
      }
    } catch (err) {
      logger.error('Error in handleInviteCreate:', err.message);
    }

    const cache = guildInvitesCache.get(invite.guild.id) || new Map();
    cache.set(invite.code, invite.uses || 0);
    guildInvitesCache.set(invite.guild.id, cache);
  },

  /**
   * Intercept and block Discord invite links sent by unauthorized members in chat
   */
  async handleChatInviteCheck(message, settings, client) {
    if (!message || !message.guild || message.author.bot) return false;
    const guard = settings?.inviteGuard;
    if (!guard?.enabled || !guard?.roleId || guard?.blockChatInvites === false) {
      return false;
    }

    const DISCORD_INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|com)|discordapp\.com\/invite)\/[a-zA-Z0-9_-]+/gi;
    if (!DISCORD_INVITE_REGEX.test(message.content)) {
      return false;
    }

    const authorized = await this.isUserAuthorizedToInvite(message.author.id, message.guild, settings, client);
    if (authorized) {
      return false; // Authorized to share invites
    }

    // Delete message
    await message.delete().catch(() => {});

    // Send temporary warning
    const warnMsg = await message.channel.send({
      content: `⚠️ <@${message.author.id}>, only members with the <@&${guard.roleId}> role are authorized to share invite links.`
    }).catch(() => {});
    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

    // Log to log channel
    const logChannelId = guard.logChannelId || settings?.inviteTracker?.channelId;
    if (logChannelId) {
      const channel = message.guild.channels.cache.get(logChannelId);
      if (channel && channel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('🛡️ Unauthorized Invite Link Blocked in Chat')
          .setDescription(
            `👤 **User:** <@${message.author.id}> (\`${message.author.tag}\`)\n` +
            `📍 **Channel:** <#${message.channel.id}>\n` +
            `💬 **Blocked Content:** \`${message.content.substring(0, 100)}\`\n` +
            `⚠️ **Reason:** Missing required Inviter role (<@&${guard.roleId}>).`
          )
          .setTimestamp();
        await channel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    return true; // Handled and blocked
  },

  /**
   * Sync Discord server permissions for the Inviter role:
   * - Remove CreateInstantInvite from @everyone
   * - Add CreateInstantInvite to the target Inviter role
   * - Sync channel overwrites
   */
  async syncInvitePermissions(guild, roleId) {
    if (!guild || !roleId) return { success: false, error: 'Invalid parameters' };

    let everyoneDisabled = false;
    let roleGranted = false;
    let channelsUpdated = 0;

    try {
      // 1. Remove CreateInstantInvite from @everyone role
      const everyoneRole = guild.roles.everyone;
      if (everyoneRole && everyoneRole.permissions.has(PermissionsBitField.Flags.CreateInstantInvite)) {
        const newPerms = everyoneRole.permissions.remove(PermissionsBitField.Flags.CreateInstantInvite);
        await everyoneRole.setPermissions(newPerms, 'AURA Inviter Role Guard: Restrict invite creation');
        everyoneDisabled = true;
      }

      // 2. Grant CreateInstantInvite to the target Inviter role
      const inviterRole = guild.roles.cache.get(roleId);
      if (inviterRole) {
        if (!inviterRole.permissions.has(PermissionsBitField.Flags.CreateInstantInvite)) {
          const newRolePerms = inviterRole.permissions.add(PermissionsBitField.Flags.CreateInstantInvite);
          await inviterRole.setPermissions(newRolePerms, 'AURA Inviter Role Guard: Allow invite creation');
        }
        roleGranted = true;
      }

      // 3. Update channel permission overwrites so channels don't override @everyone to allow invites
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased() && !channel.isVoiceBased()) continue;
        try {
          const everyoneOverwrite = channel.permissionOverwrites?.cache?.get(guild.id);
          if (everyoneOverwrite && everyoneOverwrite.allow.has(PermissionsBitField.Flags.CreateInstantInvite)) {
            await channel.permissionOverwrites.edit(guild.id, {
              CreateInstantInvite: false
            }, { reason: 'AURA Inviter Role Guard: Channel overwrite sync' });
            channelsUpdated++;
          }
        } catch (_) {}
      }

      return { success: true, everyoneDisabled, roleGranted, channelsUpdated };
    } catch (err) {
      logger.error('Failed to sync invite permissions:', err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Purge pre-existing server invites created by users who lack the Inviter role
   */
  async purgeUnauthorizedInvites(guild, settings, client) {
    if (!guild || !settings?.inviteGuard?.roleId) return 0;
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites || invites.size === 0) return 0;

    let purged = 0;
    for (const [code, inv] of invites) {
      if (!inv.inviter) continue;
      if (inv.inviter.id === client?.user?.id) continue;

      const authorized = await this.isUserAuthorizedToInvite(inv.inviter.id, guild, settings, client);
      if (!authorized) {
        await inv.delete('AURA Inviter Role Guard: Purging pre-existing unauthorized invite').catch(() => {});
        purged++;
      }
    }
    return purged;
  },

  /**
   * Handle invite delete event
   */
  handleInviteDelete(invite) {
    if (!invite || !invite.guild) return;
    const cache = guildInvitesCache.get(invite.guild.id);
    if (cache) {
      cache.delete(invite.code);
    }
  },

  /**
   * Handle member join: find who invited them
   */
  async handleMemberJoin(member, settings, client) {
    if (!member || !member.guild) return;
    if (member.user.bot) return; // Bots are not tracked

    const guild = member.guild;
    const cachedInvites = guildInvitesCache.get(guild.id) || new Map();
    const currentInvites = await guild.invites.fetch().catch(() => null);

    let usedInvite = null;
    let inviterUser = null;
    let isVanity = false;

    if (currentInvites) {
      for (const [code, inv] of currentInvites) {
        const prevUses = cachedInvites.get(code) || 0;
        if ((inv.uses || 0) > prevUses) {
          usedInvite = inv;
          inviterUser = inv.inviter;
          break;
        }
      }

      // Update cache
      const newCache = new Map();
      for (const [code, inv] of currentInvites) {
        newCache.set(code, inv.uses || 0);
      }
      guildInvitesCache.set(guild.id, newCache);
    }

    // Check vanity URL if no regular invite was matched
    if (!usedInvite && guild.vanityURLCode) {
      const prevVanityUses = guildVanityCache.get(guild.id) || 0;
      const currentVanity = await guild.fetchVanityData().catch(() => null);
      if (currentVanity && currentVanity.uses > prevVanityUses) {
        isVanity = true;
        guildVanityCache.set(guild.id, currentVanity.uses);
      }
    }

    // Account age check (Alt / Fake detection: accounts created less than 3 days ago)
    const isFake = (Date.now() - member.user.createdTimestamp) < (3 * 24 * 60 * 60 * 1000);

    let inviterRecord = null;
    let totalInvites = 0;

    if (inviterUser) {
      // 1. Record MemberInvite
      await MemberInvite.findOneAndUpdate(
        { guildId: guild.id, memberId: member.id },
        { inviterId: inviterUser.id, code: usedInvite.code, isFake },
        { upsert: true, new: true }
      );

      // 2. Increment Inviter Stats
      inviterRecord = await Invite.findOne({ guildId: guild.id, userId: inviterUser.id });
      if (!inviterRecord) {
        inviterRecord = new Invite({ guildId: guild.id, userId: inviterUser.id });
      }

      if (isFake) {
        inviterRecord.fake += 1;
      } else {
        inviterRecord.regular += 1;
      }
      await inviterRecord.save();
      totalInvites = inviterRecord.total;
    } else if (isVanity) {
      await MemberInvite.findOneAndUpdate(
        { guildId: guild.id, memberId: member.id },
        { inviterId: 'vanity', code: guild.vanityURLCode, isFake },
        { upsert: true, new: true }
      );
    } else {
      await MemberInvite.findOneAndUpdate(
        { guildId: guild.id, memberId: member.id },
        { inviterId: 'unknown', code: 'unknown', isFake },
        { upsert: true, new: true }
      );
    }

    // 3. Post invite welcome announcement if channel is configured
    const logChannelId = settings?.inviteTracker?.channelId;
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setAuthor({ name: `${member.user.tag} joined!`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: `Member #${guild.memberCount}` })
          .setTimestamp();

        if (inviterUser && inviterRecord) {
          embed.setDescription(
            `👋 Welcome <@${member.id}> to **${guild.name}**!\n\n` +
            `👤 **Invited by:** <@${inviterUser.id}> (\`${inviterUser.tag}\`)\n` +
            `📈 **Total Invites:** **${totalInvites}** (Regular: ${inviterRecord.regular}, Bonus: ${inviterRecord.bonus}, Left: ${inviterRecord.left}${isFake ? ', Fake: ' + inviterRecord.fake : ''})\n` +
            `🔗 **Invite Code:** \`${usedInvite.code}\`${isFake ? '\n⚠️ *Note: Account is under 3 days old (flagged as new/alt).*' : ''}`
          );
        } else if (isVanity) {
          embed.setDescription(`👋 Welcome <@${member.id}> to **${guild.name}**!\n\n🔗 Joined using the server's **Vanity Invite URL**.`);
        } else {
          embed.setDescription(`👋 Welcome <@${member.id}> to **${guild.name}**!\n\n🔗 Joined via direct invite or integration.`);
        }

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  },

  /**
   * Handle member leave: update inviter's leave count
   */
  async handleMemberLeave(member, settings, client) {
    if (!member || !member.guild) return;
    if (member.user.bot) return;

    const guild = member.guild;
    const memberInvite = await MemberInvite.findOne({ guildId: guild.id, memberId: member.id });
    if (!memberInvite || !memberInvite.inviterId || ['vanity', 'unknown'].includes(memberInvite.inviterId)) {
      return;
    }

    try {
      const inviterRecord = await Invite.findOne({ guildId: guild.id, userId: memberInvite.inviterId });
      if (inviterRecord) {
        inviterRecord.left += 1;
        await inviterRecord.save();

        const logChannelId = settings?.inviteTracker?.channelId;
        if (logChannelId) {
          const channel = guild.channels.cache.get(logChannelId);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor(COLORS.ERROR)
              .setAuthor({ name: `${member.user.tag} left`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
              .setDescription(
                `📤 **${member.user.tag}** has left the server.\n\n` +
                `👤 **Invited by:** <@${memberInvite.inviterId}>\n` +
                `📈 **Inviter's New Total:** **${inviterRecord.total}** invites (Left: ${inviterRecord.left})`
              )
              .setFooter({ text: `Members remaining: ${guild.memberCount}` })
              .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error('Error handling member leave invite update:', err.message);
    }
  }
};

module.exports = inviteService;
