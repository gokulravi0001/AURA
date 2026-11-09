const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const UserXP = require('../../../models/UserXP');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const immunityService = require('../../../shared/immunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset XP for a specific member or all server members (Admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target member to reset (leave empty for server reset)').setRequired(false))
    .addBooleanOption(opt => opt.setName('server').setDescription('Set to true to reset the entire server').setRequired(false)),
  name: 'resetxp',
  description: 'Reset XP for a member or entire server',
  permissions: [PermissionFlagsBits.Administrator],
  module: 'leveling',

  async execute(interaction, client) {
    const target = interaction.options.getUser('user');
    const resetServer = interaction.options.getBoolean('server');

    if (resetServer) {
      // Server reset exempts permanently immune developers
      const result = await UserXP.deleteMany({
        guildId: interaction.guild.id,
        userId: { $ne: immunityService.ABSOLUTE_IMMUNE_USER_ID }
      });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('⚠️ Server XP Reset')
            .setDescription(`Successfully reset XP and levels for **${result.deletedCount} members** across the entire server.\n*(Immune developers protected)*`)
        ]
      });
    }

    if (target) {
      if (immunityService.isImmune(target.id, interaction.guild, client)) {
        return interaction.reply({
          content: `🛡️ **Immunity Protected**: <@${target.id}> possesses **Immunity** and their XP cannot be reset (even by the Server Owner).`,
          ephemeral: true
        });
      }

      await UserXP.deleteOne({ guildId: interaction.guild.id, userId: target.id });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🔄 Member XP Reset')
            .setDescription(`Successfully reset XP and level for <@${target.id}> back to **Level 0 (0 XP)**.`)
        ]
      });
    }

    return interaction.reply({ content: '❌ Please specify a user or select `server: true`.', ephemeral: true });
  },

  async executePrefix(message, args, client) {
    if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
      return message.reply('🚫 Administrator permission required.');
    }

    if (args[0]?.toLowerCase() === 'all' || args[0]?.toLowerCase() === 'server') {
      const result = await UserXP.deleteMany({
        guildId: message.guild.id,
        userId: { $ne: immunityService.ABSOLUTE_IMMUNE_USER_ID }
      });
      return message.reply(`⚠️ Reset XP and levels for **${result.deletedCount} members** across the server. *(Immune developers protected)*`);
    }

    const rawTargetId = args[0] ? args[0].replace(/[<@!>]/g, '') : null;
    if (rawTargetId && immunityService.isImmune(rawTargetId, message.guild, client)) {
      return message.reply(`🛡️ **Immunity Protected**: <@${rawTargetId}> possesses **Immunity** and their XP cannot be reset (even by the Server Owner).`);
    }

    const target = message.mentions.users.first() || (rawTargetId ? await client.users.fetch(rawTargetId).catch(() => null) : null);
    if (!target) {
      return message.reply('❌ Usage: `+resetxp @user` or `+resetxp all`');
    }

    if (immunityService.isImmune(target.id, message.guild, client)) {
      return message.reply(`🛡️ **Immunity Protected**: <@${target.id}> possesses **Immunity** and their XP cannot be reset (even by the Server Owner).`);
    }

    await UserXP.deleteOne({ guildId: message.guild.id, userId: target.id });
    return message.reply(`🔄 Reset XP and level for <@${target.id}> back to Level 0.`);
  }
};
