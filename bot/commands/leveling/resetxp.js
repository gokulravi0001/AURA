const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const UserXP = require('../../../models/UserXP');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset XP for a specific member or all server members (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
      const result = await UserXP.deleteMany({ guildId: interaction.guild.id });
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('⚠️ Server XP Reset')
            .setDescription(`Successfully reset XP and levels for **${result.deletedCount} members** across the entire server.`)
        ]
      });
    }

    if (target) {
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
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('🚫 Administrator permission required.');
    }

    if (args[0]?.toLowerCase() === 'all' || args[0]?.toLowerCase() === 'server') {
      const result = await UserXP.deleteMany({ guildId: message.guild.id });
      return message.reply(`⚠️ Reset XP and levels for **${result.deletedCount} members** across the server.`);
    }

    const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
    if (!target) {
      return message.reply('❌ Usage: `+resetxp @user` or `+resetxp all`');
    }

    await UserXP.deleteOne({ guildId: message.guild.id, userId: target.id });
    return message.reply(`🔄 Reset XP and level for <@${target.id}> back to Level 0.`);
  }
};
