const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

const tagRoleService = {
  /**
   * Normalize text by stripping diacritics, zero-width characters, and converting fancy unicode fonts to ASCII.
   * Handles mathematical, cursive, and stylized fonts (e.g. 𝖳𝗁𝖾𝗋𝗂𝗅𝖺 -> therila, 𝗔𝗨𝗥𝗔 -> aura).
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
   * Intelligently find or resolve the tag role for a guild.
   * 1. Checks explicitly configured role in database.
   * 2. If not configured or disabled, automatically discovers candidate roles in the server:
   *    - Role name containing "tag" (e.g. "Tag", "Tag Role", "Tag Supporter")
   *    - Role name containing "loyal" (e.g. "Loyal" in Therila)
   *    - Role name containing "supporter" / "support"
   *    - Role name matching the server's primary name (e.g. "𝗔𝗨𝗥𝗔" in "AURA TAMIL")
   *    - Role name matching symbols in the server's name (e.g. "✧", "𝚲")
   *
   * @param {import('discord.js').Guild} guild
   * @param {object} [settings]
   * @returns {import('discord.js').Role|null}
   */
  resolveTagRole(guild, settings = null) {
    if (!guild) return null;

    // 1. Explicit configuration from settings
    const configuredRoleId = settings?.tagRole?.roleId;
    if (configuredRoleId) {
      const explicitRole = guild.roles.cache.get(configuredRoleId);
      if (explicitRole) return explicitRole;
    }

    // 2. Intelligent Auto-Discovery across all guild roles
    const botMember = guild.members.me || guild.members.cache.get(guild.client.user?.id);
    const botHighest = botMember?.roles?.highest?.position ?? 999;
    const rawGuildName = guild.name || '';
    const normGuildName = this.normalizeText(rawGuildName);

    const serverWords = normGuildName
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['the', 'and', 'for', 'server', 'official', 'community', 'discord'].includes(w));

    const candidates = [];

    for (const role of guild.roles.cache.values()) {
      if (role.id === guild.id) continue; // @everyone
      if (role.managed) continue; // bot/integration role
      if (role.position >= botHighest) continue; // unassignable

      // Exclude admin & dangerous permissions
      if (role.permissions.has(PermissionsBitField.Flags.Administrator) ||
          role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
          role.permissions.has(PermissionsBitField.Flags.BanMembers) ||
          role.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        continue;
      }

      const normRoleName = this.normalizeText(role.name);
      if (!normRoleName) continue;

      // Ignore common utility / non-tag roles
      if (normRoleName.includes('bot') || normRoleName.includes('mute') || normRoleName.includes('quarantine') ||
          normRoleName.includes('level') || normRoleName.includes('summons') || normRoleName.includes('ping') ||
          normRoleName.includes('18+') || normRoleName.includes('18-')) {
        continue;
      }

      let score = 0;

      // Highest priority: contains "tag"
      if (normRoleName === 'tag' || normRoleName === 'tag role' || normRoleName === 'tag-role') score += 100;
      else if (normRoleName.includes('tag')) score += 80;

      // High priority: "loyal" / "supporter"
      if (normRoleName === 'loyal' || normRoleName === 'loyals') score += 75;
      else if (normRoleName.includes('loyal')) score += 60;

      if (normRoleName === 'supporter' || normRoleName === 'server supporter') score += 70;
      else if (normRoleName.includes('supporter') || normRoleName.includes('support')) score += 50;

      // Matches server name primary word (e.g. role "𝗔𝗨𝗥𝗔" in "AURA TAMIL", or role "Therila")
      for (const sw of serverWords) {
        if (normRoleName === sw) score += 65;
        else if (normRoleName.includes(sw) && normRoleName.length < sw.length + 5) score += 40;
      }

      // Matches short server symbol (e.g. role "✧" or "𝚲")
      if (rawGuildName.includes(role.name.trim()) && role.name.trim().length <= 3) {
        score += 55;
      }

      if (score > 0) {
        candidates.push({ role, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.role || null;
  },

  /**
   * Automatically detect and extract all valid server tag variants from the guild and tag role.
   * Universal tag detection handles:
   * - Custom configured tag
   * - Server Vanity URL code
   * - Symbols from guild name (✧, ✦, ★, ⚡, etc.)
   * - Stylized substitutions (e.g. Lambda 𝚲 / Λ / λ for AURA)
   * - Transliterations (e.g. therila <-> therla)
   * - Bracketed & separator tags ([TAG], {TAG}, Server | TAG)
   * - Acronyms (e.g. AT for AURA TAMIL)
   * - The tag role's name itself
   *
   * @param {import('discord.js').Guild} guild
   * @param {string|null} [customTag]
   * @param {import('discord.js').Role|null} [role]
   * @returns {string[]} Array of normalized tag candidates
   */
  getServerTags(guild, customTag = null, role = null) {
    const tags = new Set();

    // 1. Explicit Custom Tag if configured
    if (customTag && typeof customTag === 'string' && customTag.trim()) {
      const cleanCustom = this.normalizeText(customTag);
      if (cleanCustom) tags.add(cleanCustom);
    }

    if (guild) {
      // 2. Vanity URL code (e.g. discord.gg/therla -> therla)
      if (guild.vanityURLCode) {
        const cleanVanity = this.normalizeText(guild.vanityURLCode);
        if (cleanVanity) tags.add(cleanVanity);
      }

      const rawName = guild.name || '';
      const normalizedName = this.normalizeText(rawName);

      // 3. Extract symbols from guild name (e.g. ✧, ✦, ★, ⚡, etc.)
      const symbols = rawName.match(/[^\p{L}\p{N}\s\[\]\(\)\{\}|•—~]/gu);
      if (symbols) {
        for (const s of symbols) {
          const cleanSym = this.normalizeText(s);
          if (cleanSym && cleanSym.length >= 1) tags.add(cleanSym);
        }
      }

      // 4. Extract bracketed tags: [TAG], (TAG), {TAG}
      const bracketMatches = rawName.match(/\[([^\]]+)\]|\(([^\)]+)\)|\{([^\}]+)\}/g);
      if (bracketMatches) {
        for (const m of bracketMatches) {
          const inner = this.normalizeText(m.slice(1, -1));
          if (inner.length >= 2) tags.add(inner);
        }
      }

      // 5. Extract separator-based segments: Server | TAG or TAG | Server
      if (rawName.includes('|') || rawName.includes('•') || rawName.includes('—') || rawName.includes('~')) {
        const parts = rawName.split(/[|•—~]/).map(p => this.normalizeText(p)).filter(Boolean);
        for (const p of parts) {
          if (p.length >= 2) tags.add(p);
        }
      }

      // 6. Clean words from server name (ignoring generic stop words)
      const cleanWords = normalizedName
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !['the', 'and', 'for', 'server', 'official', 'community', 'discord'].includes(w));

      for (const w of cleanWords) {
        tags.add(w);

        // Common transliteration variants
        if (w === 'therila') tags.add('therla');
        if (w === 'therla') tags.add('therila');

        // Lambda / Stylized A common tag variants for AURA
        if (w === 'aura') {
          tags.add('λ'); // greek small lamda
          tags.add('Λ'); // greek capital lamda
          tags.add('𝚲'); // math bold lamda
        }
      }

      // Server acronym (e.g. AURA TAMIL -> at)
      if (cleanWords.length >= 2) {
        const acronym = cleanWords.map(w => w[0]).join('');
        if (acronym.length >= 2) tags.add(acronym);
      }
    }

    // 7. If role is provided, include role name words/symbols
    if (role) {
      const normRole = this.normalizeText(role.name);
      if (normRole && normRole !== 'tag' && normRole !== 'loyal') {
        tags.add(normRole);
        if (normRole === 'aura') {
          tags.add('λ');
          tags.add('Λ');
          tags.add('𝚲');
        }
      }
    }

    return [...tags].filter(t => t.length >= 1);
  },

  /**
   * Check if a member or user holds the server's tag in their nickname, display name, username, or custom status.
   *
   * @param {import('discord.js').GuildMember|import('discord.js').User} memberOrUser
   * @param {import('discord.js').Guild} guild
   * @param {string|null} [customTag]
   * @param {import('discord.js').Role|null} [role]
   * @returns {boolean}
   */
  hasTag(memberOrUser, guild, customTag = null, role = null) {
    if (!memberOrUser) return false;

    const serverTags = this.getServerTags(guild, customTag, role);
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
      const norm = this.normalizeText(rawName);

      // 1. Direct tag matching
      for (const tag of serverTags) {
        const normTag = this.normalizeText(tag);
        if (!normTag) continue;

        if (normTag.length === 1) {
          // Single symbol/character (e.g. ✧ or λ or 𝚲): check raw or normalized inclusion
          if (norm.includes(normTag) || rawName.includes(tag)) {
            return true;
          }
        } else {
          // Multi-char word: check substring
          if (norm.includes(normTag)) {
            return true;
          }
        }
      }

      // 2. Nickname prefix pattern check: e.g. "𝚲・Name" or "✧・Name" or "[TAG] Name"
      const prefixMatch = rawName.match(/^([^\p{L}\p{N}\s]+)[・|•\-~ ]/u);
      if (prefixMatch) {
        const prefixNorm = this.normalizeText(prefixMatch[1]);
        for (const tag of serverTags) {
          if (this.normalizeText(tag) === prefixNorm || tag === prefixMatch[1]) {
            return true;
          }
        }
      }
    }

    return false;
  },

  /**
   * Check a member's tag status and apply or revoke the tag role accordingly.
   *
   * @param {import('discord.js').GuildMember} member
   * @param {object} [settings]
   * @param {import('discord.js').Client} [client]
   * @param {string} [source] - event source (memberJoin, memberUpdate, userUpdate, chat, sync)
   * @returns {Promise<{ action: string, role?: import('discord.js').Role, error?: string }>}
   */
  async checkAndApply(member, settings = null, client = null, source = 'event') {
    if (!member || !member.guild || member.user?.bot) return { action: 'skipped' };

    const guild = member.guild;
    const role = this.resolveTagRole(guild, settings);
    if (!role) {
      return { action: 'no_tag_role' };
    }

    // Verify bot permissions
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { action: 'error', error: 'Bot is missing Manage Roles permission.' };
    }

    if (role.position >= botMember.roles.highest.position) {
      return { action: 'error', error: 'Tag role is higher than or equal to bot highest role.' };
    }

    const customTag = settings?.tagRole?.tag || null;
    const memberHasTag = this.hasTag(member, guild, customTag, role);
    const hasRole = member.roles.cache.has(role.id);

    // 1. Member holds the server tag but doesn't have the role -> Grant Role
    if (memberHasTag && !hasRole) {
      try {
        await member.roles.add(role.id, `Adopted server tag for ${guild.name}`);
        logger.info(`Granted tag role [${role.name}] to ${member.user.tag} in ${guild.name} (Source: ${source})`);

        // Channel Announcement if configured
        if (settings?.tagRole?.channelId && source !== 'sync') {
          const channel = guild.channels.cache.get(settings.tagRole.channelId);
          if (channel?.isTextBased()) {
            const detectedTag = customTag || this.getServerTags(guild, null, role)[0] || guild.name;
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
   * @param {object} [settings]
   * @param {import('discord.js').Client} [client]
   */
  async syncGuild(guild, settings = null, client = null) {
    const role = this.resolveTagRole(guild, settings);
    if (!role) {
      return { success: false, error: 'No tag role configured or detected on this server.' };
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

      const res = await this.checkAndApply(member, settings, client, 'sync');
      if (res.action === 'added') stats.added++;
      else if (res.action === 'removed') stats.removed++;
      else if (res.action === 'unchanged') stats.unchanged++;
      else if (res.action === 'error') stats.errors++;
    }

    return { success: true, stats, role };
  },

  /**
   * Set or update server tag auto-role configuration in database.
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
   * Disable server tag auto-role for a guild.
   */
  async disableTagRole(guildId) {
    await Guild.updateOne(
      { guildId },
      { $set: { 'tagRole.enabled': false } }
    );
    return { success: true };
  },

  /**
   * Initialize background recurring sweep (runs every 10 minutes) across ALL joined servers
   * to automatically grant or revoke tag roles. Also performs an initial sweep on bot ready!
   */
  init(client) {
    const runSweep = async () => {
      try {
        const guildService = require('../../shared/guildService');
        for (const guild of client.guilds.cache.values()) {
          const settings = await guildService.getSettings(guild.id).catch(() => null);
          const role = this.resolveTagRole(guild, settings);
          if (!role) continue;

          let members;
          try {
            members = await guild.members.fetch();
          } catch (_) {
            members = guild.members.cache;
          }

          for (const member of members.values()) {
            if (member.user.bot) continue;
            await this.checkAndApply(member, settings, client, 'backgroundSweep').catch(() => {});
          }
        }
      } catch (err) {
        logger.error(`Error in tag role background sweep: ${err.message}`);
      }
    };

    // Initial sweep shortly after bot startup
    setTimeout(runSweep, 5000);

    // Recurring sweep every 10 minutes
    setInterval(runSweep, 10 * 60 * 1000);
    logger.info('🏷️ Server Tag Auto-Role Service initialized with universal auto-detection & 10m sweep.');
  }
};

module.exports = tagRoleService;
