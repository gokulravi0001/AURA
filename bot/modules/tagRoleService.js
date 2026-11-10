const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

const tagRoleService = {
  /**
   * Normalize text by stripping diacritics, zero-width characters, and converting fancy unicode fonts to ASCII.
   * Handles mathematical, cursive, and stylized fonts (e.g. 𝖳𝗁𝖾𝗋𝗂𝗅𝖺 -> therila).
   */
  normalizeText(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .toLowerCase()
      .trim();
  },

  /**
   * Automatically detect and extract all valid server tag variants from the guild.
   * If a custom tag was configured, it is included along with auto-detected variants.
   *
   * @param {import('discord.js').Guild} guild
   * @param {string|null} [customTag]
   * @returns {string[]} Array of normalized tag candidates
   */
  getServerTags(guild, customTag = null) {
    const tags = new Set();

    // 1. Explicit Custom Tag if configured
    if (customTag && typeof customTag === 'string' && customTag.trim()) {
      const cleanCustom = this.normalizeText(customTag);
      if (cleanCustom) tags.add(cleanCustom);
    }

    if (!guild) return [...tags];

    // 2. Vanity URL code (e.g. discord.gg/therla -> therla)
    if (guild.vanityURLCode) {
      const cleanVanity = this.normalizeText(guild.vanityURLCode);
      if (cleanVanity) tags.add(cleanVanity);
    }

    const rawName = guild.name || '';
    const normalizedName = this.normalizeText(rawName);

    // 3. Extract bracketed tags: [TAG], (TAG), {TAG}
    const bracketMatches = rawName.match(/\[([^\]]+)\]|\(([^\)]+)\)|\{([^\}]+)\}/g);
    if (bracketMatches) {
      for (const m of bracketMatches) {
        const inner = this.normalizeText(m.slice(1, -1));
        if (inner.length >= 2) tags.add(inner);
      }
    }

    // 4. Extract separator-based segments: Server | TAG or TAG | Server
    if (rawName.includes('|') || rawName.includes('•') || rawName.includes('—') || rawName.includes('~')) {
      const parts = rawName.split(/[|•—~]/).map(p => this.normalizeText(p)).filter(Boolean);
      for (const p of parts) {
        if (p.length >= 2) tags.add(p);
      }
    }

    // 5. Clean words from server name (ignoring generic stop words)
    const cleanWords = normalizedName
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['the', 'and', 'for', 'server', 'official', 'community', 'discord'].includes(w));

    for (const w of cleanWords) {
      tags.add(w);

      // Common transliteration / vowel omission variants (e.g. therila <-> therla)
      if (w === 'therila') tags.add('therla');
      if (w === 'therla') tags.add('therila');
    }

    // Full cleaned name without symbols
    const fullClean = cleanWords.join(' ');
    if (fullClean.length >= 2) tags.add(fullClean);

    return [...tags].filter(t => t.length >= 2);
  },

  /**
   * Check if a member or user holds the server's tag in their nickname, display name, username, or custom status.
   *
   * @param {import('discord.js').GuildMember|import('discord.js').User} memberOrUser
   * @param {import('discord.js').Guild} guild
   * @param {string|null} [customTag]
   * @returns {boolean}
   */
  hasTag(memberOrUser, guild, customTag = null) {
    if (!memberOrUser) return false;

    const serverTags = this.getServerTags(guild, customTag);
    if (serverTags.length === 0) return false;

    const namesToCheck = [
      memberOrUser.nickname,
      memberOrUser.displayName,
      memberOrUser.user?.displayName,
      memberOrUser.user?.globalName,
      memberOrUser.user?.username,
      memberOrUser.username
    ].filter(Boolean);

    // Also check Discord Custom Status activity if available
    const customStatus = memberOrUser.presence?.activities?.find(a => a.type === 4)?.state;
    if (customStatus) namesToCheck.push(customStatus);

    for (const rawName of namesToCheck) {
      const normalizedMemberName = this.normalizeText(rawName);

      for (const tag of serverTags) {
        if (normalizedMemberName.includes(tag)) {
          return true;
        }
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
    if (!tagConfig?.enabled || !tagConfig.roleId) {
      return { action: 'disabled' };
    }

    const guild = member.guild;
    const roleId = tagConfig.roleId;

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

    const memberHasTag = tagRoleService.hasTag(member, guild, tagConfig.tag);
    const hasRole = member.roles.cache.has(role.id);

    // 1. Member holds the server tag but doesn't have the role -> Grant Role
    if (memberHasTag && !hasRole) {
      try {
        await member.roles.add(role.id, `Adopted server tag for ${guild.name}`);
        logger.info(`Granted tag role [${role.name}] to ${member.user.tag} in ${guild.name} (Source: ${source})`);

        // Channel Announcement
        if (tagConfig.channelId && source !== 'sync') {
          const channel = guild.channels.cache.get(tagConfig.channelId);
          if (channel?.isTextBased()) {
            const detectedTag = tagConfig.tag || tagRoleService.getServerTags(guild)[0] || guild.name;
            const embed = new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🏷️ Server Tag Adopted!')
              .setDescription(
                `🎉 <@${member.id}> (\`${member.user.tag}\`) has adopted our server tag **\`${detectedTag}\`** and has been awarded the <@&${role.id}> role!\n\n` +
                `*Thank you for supporting **${guild.name}**!*`
              )
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

            await channel.send({ embeds: [embed] }).catch(() => {});
          }
        }

        return { action: 'added', role };
      } catch (err) {
        logger.warn(`Could not add tag role to ${member.user.tag}: ${err.message}`);
        return { action: 'error', error: err.message };
      }
    }

    // 2. Member dropped the tag but still has the role -> Revoke Role
    if (!memberHasTag && hasRole) {
      try {
        await member.roles.remove(role.id, `Removed server tag for ${guild.name}`);
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
    if (!settings?.tagRole?.enabled || !settings?.tagRole?.roleId) {
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
  async setTagRole(guildId, { tag = null, roleId, channelId = null }) {
    await Guild.updateOne(
      { guildId },
      {
        $set: {
          'tagRole.enabled': true,
          'tagRole.tag': tag || null,
          'tagRole.roleId': roleId,
          'tagRole.channelId': channelId || null
        }
      },
      { upsert: true }
    );

    return { success: true, tag, roleId, channelId };
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
