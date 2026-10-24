const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('Configure leveling options and announcement channels (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server leveling parameters')
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the level-up announcement channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Announcement channel (leave empty to announce where user is chatting)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('rates')
        .setDescription('Configure min/max XP per message and cooldown')
        .addIntegerOption(opt => opt.setName('min').setDescription('Minimum XP per message').setRequired(true))
        .addIntegerOption(opt => opt.setName('max').setDescription('Maximum XP per message').setRequired(true))
        .addIntegerOption(opt => opt.setName('cooldown').setDescription('Cooldown between messages in seconds').setRequired(true))
    ),
  name: 'levels',
  description: 'Configure leveling parameters',
  aliases: ['levelsettings', 'level-settings'],
  permissions: [PermissionFlagsBits.Administrator],
  module: 'leveling',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });

    if (sub === 'view') {
      const embed = buildSettingsEmbed(interaction.guild, guildDoc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'channel') {
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
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('🚫 Administrator permission required.');
    }

    if (action === 'channel') {
      const channel = message.mentions.channels.first();
      guildDoc.leveling.announcementChannelId = channel ? channel.id : null;
      await guildDoc.save();
      return message.reply(channel ? `📢 Level-up channel set to <#${channel.id}>.` : '📢 Level-up messages will post where user chats.');
    }

    const embed = buildSettingsEmbed(message.guild, guildDoc);
    return message.reply({ embeds: [embed] });
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
    .setFooter({ text: 'Edit anytime via commands or web dashboard' })
    .setTimestamp();
}
