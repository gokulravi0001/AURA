const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

const tagRoleService = {
  /**
   * Check if a member or user has adopted the server tag in their nickname, display name, or username.
   *
   * @param {import('discord.js').GuildMember|import('discord.js').User} memberOrUser
   * @param {string} tag
   * @returns {boolean}
   */
  hasTag(memberOrUser, tag) {
    if (!memberOrUser || !tag) return false;
    const searchTag = String(tag).trim().toLowerCase();
    if (!searchTag) return false;

    const namesToCheck = [
      memberOrUser.nickname,
      memberOrUser.displayName,
      memberOrUser.user?.displayName,
      memberOrUser.user?.globalName,
      memberOrUser.user?.username,
      memberOrUser.username
    ].filter(Boolean);

    for (const name of namesToCheck) {
      if (String(name).toLowerCase().includes(searchTag)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Check a member's tag status and apply or revoke the tag role accordingly.
   *
   * @param {import('discord.js').GuildMember} member
   * @param {object} settings
   * @param {import('discord.js').Client} client
   * @param {string} [source] - event source (memberJoin, memberUpdate, userUpdate, chat, sync)
   * @returns {Promise<{ action: string, role?: import('discord.js').Role, error?: string }>}
   */
  async checkAndApply(member, settings, client, source = 'event') {
    if (!member || !member.guild || member.user?.bot) return { action: 'skipped' };

    const tagConfig = settings?.tagRole;
    if (!tagConfig?.enabled || !tagConfig.tag || !tagConfig.roleId) {
      return { action: 'disabled' };
    }

    const guild = member.guild;
    const roleId = tagConfig.roleId;
    const tag = tagConfig.tag;

    // Resolve Role
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return { action: 'error', error: 'Configured tag role not found in server.' };
    }

    // Verify bot permissions
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { action: 'error', error: 'Bot is missing Manage Roles permission.' };
    }

    if (role.position >= botMember.roles.highest.position) {
      return { action: 'error', error: 'Tag role is higher than or equal to bot highest role.' };
    }

    const memberHasTag = tagRoleService.hasTag(member, tag);
    const hasRole = member.roles.cache.has(role.id);

    // 1. Member adopted the tag but doesn't have the role -> Grant Role
    if (memberHasTag && !hasRole) {
      try {
        await member.roles.add(role.id, `Adopted server tag: ${tag}`);
        logger.info(`Granted tag role [${role.name}] to ${member.user.tag} in ${guild.name} (Source: ${source})`);

        // Channel Announcement
        if (tagConfig.channelId && source !== 'sync') {
          const channel = guild.channels.cache.get(tagConfig.channelId);
          if (channel?.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🏷️ Server Tag Adopted!')
              .setDescription(
                `🎉 <@${member.id}> (\`${member.user.tag}\`) has adopted our server tag **\`${tag}\`** in their name and has been awarded the <@&${role.id}> role!\n\n` +
                `*Thank you for representing and supporting **${guild.name}**!*`
              )
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }

        // Direct Message Notification
        if (tagConfig.dmNotification && source !== 'sync') {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setTitle(`🎉 Thank you for supporting ${guild.name}!`)
                .setDescription(
                  `You adopted our server tag **\`${tag}\`** and have automatically been granted the **${role.name}** role!\n\n` +
                  `Keep the tag in your name to retain your exclusive role and perks.`
                )
                .setTimestamp()
            ]
          }).catch(() => {});
        }

        return { action: 'added', role };
      } catch (err) {
        logger.warn(`Could not add tag role to ${member.user.tag}: ${err.message}`);
        return { action: 'error', error: err.message };
      }
    }

    // 2. Member removed the tag but still has the role -> Revoke Role
    if (!memberHasTag && hasRole) {
      try {
        await member.roles.remove(role.id, `Removed server tag: ${tag}`);
        logger.info(`Revoked tag role [${role.name}] from ${member.user.tag} in ${guild.name} (Source: ${source})`);
        return { action: 'removed', role };
      } catch (err) {
        logger.warn(`Could not remove tag role from ${member.user.tag}: ${err.message}`);
        return { action: 'error', error: err.message };
      }
    }

    return { action: 'unchanged' };
  },

  /**
   * Scan all members in a server and synchronize the tag role.
   *
   * @param {import('discord.js').Guild} guild
   * @param {object} settings
   * @param {import('discord.js').Client} client
   */
  async syncGuild(guild, settings, client) {
    if (!settings?.tagRole?.enabled || !settings?.tagRole?.tag || !settings?.tagRole?.roleId) {
      return { success: false, error: 'Tag auto-role is not configured or disabled on this server.' };
    }

    let members;
    try {
      members = await guild.members.fetch();
    } catch (_) {
      members = guild.members.cache;
    }

    const stats = {
      total: members.size,
      scanned: 0,
      added: 0,
      removed: 0,
      unchanged: 0,
      errors: 0
    };

    for (const member of members.values()) {
      if (member.user.bot) continue;
      stats.scanned++;

      const res = await tagRoleService.checkAndApply(member, settings, client, 'sync');
      if (res.action === 'added') stats.added++;
      else if (res.action === 'removed') stats.removed++;
      else if (res.action === 'unchanged') stats.unchanged++;
      else if (res.action === 'error') stats.errors++;
    }

    return { success: true, stats };
  },

  /**
   * Configure Tag Auto-Role in the database.
   */
  async setTagRole(guildId, { tag, roleId, channelId = null, dmNotification = false }) {
    await Guild.updateOne(
      { guildId },
      {
        $set: {
          'tagRole.enabled': true,
          'tagRole.tag': tag,
          'tagRole.roleId': roleId,
          'tagRole.channelId': channelId,
          'tagRole.dmNotification': dmNotification
        }
      },
      { upsert: true }
    );

    return { success: true, tag, roleId, channelId, dmNotification };
  },

  /**
   * Disable Tag Auto-Role for a guild.
   */
  async disableTagRole(guildId) {
    await Guild.updateOne(
      { guildId },
      { $set: { 'tagRole.enabled': false } }
    );

    return { success: true };
  },

  /**
   * Initialize background recurring sweep for tag auto-roles (runs every 15 minutes).
   * Ensures roles are automatically revoked even if a member dropped the tag while offline.
   */
  init(client) {
    const guildService = require('../../shared/guildService');
    const SWEEP_INTERVAL = 15 * 60 * 1000;

    setInterval(async () => {
      try {
        if (!client.isReady()) return;
        for (const guild of client.guilds.cache.values()) {
          const settings = await guildService.getSettings(guild.id);
          if (settings?.tagRole?.enabled) {
            await tagRoleService.syncGuild(guild, settings, client);
          }
        }
      } catch (err) {
        logger.error('Error during scheduled tag role sweep:', err.message);
      }
    }, SWEEP_INTERVAL);

    logger.info('Tag Auto-Role background scheduler initialized (15m recurring sweep).');
  }
};

module.exports = tagRoleService;
