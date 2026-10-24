const { EmbedBuilder } = require('discord.js');
const Invite = require('../../models/Invite');
const MemberInvite = require('../../models/MemberInvite');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

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
   * Handle invite create event
   */
  handleInviteCreate(invite) {
    if (!invite || !invite.guild) return;
    const cache = guildInvitesCache.get(invite.guild.id) || new Map();
    cache.set(invite.code, invite.uses || 0);
    guildInvitesCache.set(invite.guild.id, cache);
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
