const UserXP = require('../../models/UserXP');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const { EmbedBuilder } = require('discord.js');

// User cooldown map: key = `${guildId}-${userId}`
const cooldowns = new Map();

const levelingService = {
  /**
   * Calculate XP required to reach next level
   */
  getXpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
  },

  /**
   * Calculate total XP required to reach a specific level from 0
   */
  getTotalXpForLevel(level) {
    let total = 0;
    for (let i = 0; i < level; i++) {
      total += this.getXpForLevel(i);
    }
    return total;
  },

  /**
   * Process message for XP reward
   */
  async handleMessageXP(message, settings, client) {
    const { guild, author, channel, member } = message;

    // Check no-XP channels and roles
    if (settings.leveling.noXpChannels?.includes(channel.id)) return;
    if (member && settings.leveling.noXpRoles?.some(r => member.roles.cache.has(r))) return;

    const cooldownKey = `${guild.id}-${author.id}`;
    const now = Date.now();
    const cooldownTime = (settings.leveling.cooldownSeconds || 60) * 1000;

    if (cooldowns.has(cooldownKey)) {
      const expiration = cooldowns.get(cooldownKey) + cooldownTime;
      if (now < expiration) return;
    }

    cooldowns.set(cooldownKey, now);

    // Random XP within configured bounds
    const min = settings.leveling.xpMin || 15;
    const max = settings.leveling.xpMax || 25;
    const earnedXp = Math.floor(Math.random() * (max - min + 1)) + min;

    try {
      let userDoc = await UserXP.findOne({ guildId: guild.id, userId: author.id });
      if (!userDoc) {
        userDoc = new UserXP({
          guildId: guild.id,
          userId: author.id,
          xp: 0,
          level: 0,
          totalMessages: 0
        });
      }

      userDoc.xp += earnedXp;
      userDoc.totalMessages += 1;
      userDoc.lastXpEarnedAt = new Date();

      // Check for level ups
      let leveledUp = false;
      let nextLevelXp = this.getXpForLevel(userDoc.level);

      while (userDoc.xp >= nextLevelXp) {
        userDoc.xp -= nextLevelXp;
        userDoc.level += 1;
        leveledUp = true;
        nextLevelXp = this.getXpForLevel(userDoc.level);
      }

      await userDoc.save();

      // Realtime update to dashboard
      if (client.io) {
        client.io.to(`guild_${guild.id}`).emit('level_update', {
          userId: author.id,
          username: author.username,
          level: userDoc.level,
          xp: userDoc.xp,
          nextLevelXp
        });
      }

      // If leveled up, send notification and grant role rewards
      if (leveledUp) {
        await this.handleLevelUp(message, userDoc.level, settings);
      }
    } catch (err) {
      logger.error('Error handling message XP:', err.message);
    }
  },

  /**
   * Handle level up announcements and role rewards
   */
  async handleLevelUp(message, newLevel, settings) {
    const { guild, author, member } = message;

    // 1. Role Rewards Check
    if (member && settings.leveling.roleRewards?.length) {
      const eligibleRewards = settings.leveling.roleRewards.filter(r => r.level <= newLevel);
      for (const reward of eligibleRewards) {
        if (!member.roles.cache.has(reward.roleId)) {
          const role = guild.roles.cache.get(reward.roleId);
          if (role && guild.members.me?.permissions.has('ManageRoles')) {
            await member.roles.add(role).catch(err => {
              logger.warn(`Could not add role reward ${role.name}: ${err.message}`);
            });
          }
        }
      }
    }

    // 2. Level Up Announcement
    const rawMsg = settings.leveling.levelUpMessage || '🎉 Congratulations {user}, you leveled up to **Level {level}**!';
    const formattedMsg = rawMsg
      .replace(/{user}/g, `<@${author.id}>`)
      .replace(/{username}/g, author.username)
      .replace(/{level}/g, newLevel);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🚀 Level Up!')
      .setDescription(formattedMsg)
      .setThumbnail(author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    let targetChannel = message.channel;
    if (settings.leveling.announcementChannelId) {
      const designated = guild.channels.cache.get(settings.leveling.announcementChannelId);
      if (designated && designated.isTextBased()) {
        targetChannel = designated;
      }
    }

    targetChannel.send({ embeds: [embed] }).catch(() => {});
  }
};

module.exports = levelingService;
