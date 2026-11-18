const { SlashCommandBuilder } = require('discord.js');
const serverToolsHub = require('../../modules/serverToolsHub');
const Guild = require('../../../models/Guild');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servertools')
    .setDescription('Interactive Server Management & Growth Hub (Tag role, counters, invite logs)'),
  name: 'servertools',
  description: 'Interactive Server Management & Growth Hub',
  aliases: ['tools', 'growth', 'growthhub'],
  module: 'server_tools',

  async execute(interaction, client) {
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
    const embed = await serverToolsHub.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
    const components = serverToolsHub.buildHubComponents(isAdmin, guildDoc);
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  },

  async executePrefix(message, args, client) {
    const isAdmin = isOwnerOrAdmin(message.member || message.author, message.guild, client);
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });
    const embed = await serverToolsHub.buildHubEmbed(message.guild, guildDoc, message.author, isAdmin);
    const components = serverToolsHub.buildHubComponents(isAdmin, guildDoc);
    return message.reply({ embeds: [embed], components });
  }
};
