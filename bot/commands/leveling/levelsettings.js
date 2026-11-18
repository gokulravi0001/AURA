const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const levelingHub = require('../../modules/levelingHub');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Interactive Leveling & XP Hub (Rank, Leaderboard, Rewards, Settings)')
    .addSubcommand(sub =>
      sub.setName('hub')
        .setDescription('Open the Interactive Leveling Hub')
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server leveling parameters')
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the level-up announcement channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Announcement channel (leave empty to announce where user is chatting)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('rates')
        .setDescription('Configure min/max XP per message and cooldown (Admin only)')
        .addIntegerOption(opt => opt.setName('min').setDescription('Minimum XP per message').setRequired(true))
        .addIntegerOption(opt => opt.setName('max').setDescription('Maximum XP per message').setRequired(true))
        .addIntegerOption(opt => opt.setName('cooldown').setDescription('Cooldown between messages in seconds').setRequired(true))
    ),
  name: 'levels',
  description: 'Interactive Leveling & XP Hub (Rank, Leaderboard, Rewards, Settings)',
  aliases: ['level', 'leveling', 'xp', 'levelsettings', 'level-settings'],
  module: 'leveling',

  async execute(interaction, client, settings) {
    let guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: interaction.guild.id });

    const sub = interaction.options.getSubcommand(false);

    if (sub === 'view') {
      const embed = buildSettingsEmbed(interaction.guild, guildDoc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'channel') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      guildDoc.leveling.announcementChannelId = channel ? channel.id : null;
      await guildDoc.save();

      return interaction.reply({
        content: channel
          ? `📢 Level-up announcements will now be sent to <#${channel.id}>.`
          : '📢 Level-up announcements will now be sent in the channel where the user levels up.'
      });
    }

    if (sub === 'rates') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const min = interaction.options.getInteger('min');
      const max = interaction.options.getInteger('max');
      const cooldown = interaction.options.getInteger('cooldown');

      if (min <= 0 || max < min || cooldown < 5) {
        return interaction.reply({ content: '❌ Invalid rates. Max must be >= Min (>0) and Cooldown >= 5 seconds.', ephemeral: true });
      }

      guildDoc.leveling.xpMin = min;
      guildDoc.leveling.xpMax = max;
      guildDoc.leveling.cooldownSeconds = cooldown;
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('⚙️ Leveling Rates Updated')
            .addFields(
              { name: 'XP Range', value: `\`${min} - ${max} XP\``, inline: true },
              { name: 'Cooldown', value: `\`${cooldown}s\``, inline: true }
            )
        ]
      });
    }

    // Default: Interactive Leveling Hub
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);
    const embed = await levelingHub.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
    const components = levelingHub.buildHubComponents(isAdmin, guildDoc);
    return interaction.reply({ embeds: [embed], components });
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();
    let guildDoc = await Guild.findOne({ guildId: message.guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: message.guild.id });

    if (action === 'channel') {
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply('🚫 Administrator permission required.');
      }
      const channel = message.mentions.channels.first();
      guildDoc.leveling.announcementChannelId = channel ? channel.id : null;
      await guildDoc.save();
      return message.reply(channel ? `📢 Level-up channel set to <#${channel.id}>.` : '📢 Level-up messages will post where user chats.');
    }

    if (action === 'view') {
      const embed = buildSettingsEmbed(message.guild, guildDoc);
      return message.reply({ embeds: [embed] });
    }

    // Default: Interactive Leveling Hub
    const isAdmin = isOwnerOrAdmin(message.member || message.author, message.guild, client);
    const embed = await levelingHub.buildHubEmbed(message.guild, guildDoc, message.author, isAdmin);
    const components = levelingHub.buildHubComponents(isAdmin, guildDoc);
    return message.reply({ embeds: [embed], components });
  }
};

function buildSettingsEmbed(guild, guildDoc) {
  const lev = guildDoc?.leveling;
  const channel = lev?.announcementChannelId ? `<#${lev.announcementChannelId}>` : 'Current chat channel';
  const rewardsCount = lev?.roleRewards?.length || 0;

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚙️ Leveling Settings — ${guild.name}`)
    .addFields(
      { name: 'Status', value: lev?.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'XP Range', value: `\`${lev?.xpMin || 15} - ${lev?.xpMax || 25} XP\``, inline: true },
      { name: 'Cooldown', value: `\`${lev?.cooldownSeconds || 60} seconds\``, inline: true },
      { name: 'Announcement Channel', value: channel, inline: true },
      { name: 'Role Rewards', value: `\`${rewardsCount} roles\``, inline: true }
    )
    .setFooter({ text: 'Edit anytime via commands or interactive hub' })
    .setTimestamp();
}
