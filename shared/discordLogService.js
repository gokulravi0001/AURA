const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');
const logger = require('./logger');
const SystemConfig = require('../models/SystemConfig');

const discordLogService = {
  /**
   * Dispatch a formatted operational alert to the configured log channel
   */
  async sendLog({ client, level = 'INFO', title, description, fields = [], guildId = null } = {}) {
    if (!client) return;

    try {
      // Find log channel from global config or guild config
      let channelId = null;
      const globalConfig = await SystemConfig.findOne({ configKey: 'global_config' }).lean().catch(() => null);
      if (globalConfig?.operationalLogChannelId) {
        channelId = globalConfig.operationalLogChannelId;
      }

      if (!channelId && guildId) {
        const Guild = require('../models/Guild');
        const guildDoc = await Guild.findOne({ guildId }).lean().catch(() => null);
        channelId = guildDoc?.tickets?.logChannelId || guildDoc?.inviteGuard?.logChannelId;
      }

      if (!channelId) return;

      const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const colorMap = {
        DEBUG: 0x6b7280,
        INFO: COLORS.EMBED_DEFAULT,
        WARN: 0xf59e0b,
        ERROR: COLORS.EMBED_ERROR
      };

      const embed = new EmbedBuilder()
        .setColor(colorMap[level] || COLORS.EMBED_DEFAULT)
        .setTitle(`[${level}] ${title}`)
        .setDescription(logger.maskSensitive(description || ''))
        .setTimestamp();

      if (fields.length > 0) {
        embed.addFields(fields.map(f => ({
          name: f.name,
          value: logger.maskSensitive(String(f.value)),
          inline: !!f.inline
        })));
      }

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (_) {
      // Non-critical, ignore delivery failures
    }
  }
};

module.exports = discordLogService;
