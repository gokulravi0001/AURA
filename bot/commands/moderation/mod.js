const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationHub = require('../../modules/moderationHub');
const Guild = require('../../../models/Guild');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('All-in-One Moderation & Chat Protection Hub (Purge, Auto-Delete, Sticky, Threads)'),
  name: 'mod',
  description: 'All-in-One Moderation & Chat Protection Hub',
  aliases: ['moderation', 'modhub'],
  permissions: [PermissionFlagsBits.ManageMessages],
  module: null,

  async execute(interaction, client) {
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
    const embed = await moderationHub.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
    const components = moderationHub.buildHubComponents(isAdmin);
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  },

  async executePrefix(message, args, client) {
    const isAdmin = isOwnerOrAdmin(message.member || message.author, message.guild, client);
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });
    const embed = await moderationHub.buildHubEmbed(message.guild, guildDoc, message.author, isAdmin);
    const components = moderationHub.buildHubComponents(isAdmin);
    return message.reply({ embeds: [embed], components });
  }
};
