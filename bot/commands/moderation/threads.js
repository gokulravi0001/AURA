const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: null,
  name: 'thread',
  description: 'Manage auto image threads',
  aliases: ['threads', 'imagethreads'],
  permissions: [PermissionFlagsBits.ManageChannels],
  module: 'image_threads',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    let guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
    if (!guildDoc) {
      guildDoc = await Guild.create({ guildId: interaction.guild.id });
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const format = interaction.options.getString('format') || '💬 Discussion - {author}';

      guildDoc.modules.image_threads = true;
      guildDoc.imageThreads = {
        enabled: true,
        channelId: channel.id,
        threadNameFormat: format,
        autoArchiveDuration: 1440
      };
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('💬 Auto Image Threads Configured')
            .setDescription(`Now monitoring <#${channel.id}> for image posts!`)
        ]
      });
    }

    if (sub === 'off') {
      guildDoc.modules.image_threads = false;
      guildDoc.imageThreads.enabled = false;
      await guildDoc.save();
      return interaction.reply({ content: '❌ Auto image threads disabled.' });
    }

    return interaction.reply({ embeds: [buildThreadStatusEmbed(interaction.guild, guildDoc)] });
  },

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('🚫 Manage Channels permission required.');
    }

    const action = args[0]?.toLowerCase();
    let guildDoc = await Guild.findOne({ guildId: message.guild.id });
    if (!guildDoc) {
      guildDoc = await Guild.create({ guildId: message.guild.id });
    }

    if (action === 'setup') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ Usage: `+thread setup #channel`');

      guildDoc.modules.image_threads = true;
      guildDoc.imageThreads = {
        enabled: true,
        channelId: channel.id,
        threadNameFormat: '💬 Discussion - {author}',
        autoArchiveDuration: 1440
      };
      await guildDoc.save();
      return message.reply(`💬 Auto image threads enabled for <#${channel.id}>!`);
    }

    if (action === 'off') {
      guildDoc.modules.image_threads = false;
      guildDoc.imageThreads.enabled = false;
      await guildDoc.save();
      return message.reply('❌ Auto image threads disabled.');
    }

    const embed = buildThreadStatusEmbed(message.guild, guildDoc);
    return message.reply({ embeds: [embed] });
  }
};

function buildThreadStatusEmbed(guild, guildDoc) {
  const conf = guildDoc?.imageThreads;
  const channel = conf?.channelId ? `<#${conf.channelId}>` : 'None';

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`💬 Auto Image Threads — ${guild.name}`)
    .addFields(
      { name: 'Status', value: conf?.enabled ? '✅ Active' : '❌ Disabled', inline: true },
      { name: 'Monitored Channel', value: channel, inline: true }
    )
    .setFooter({ text: 'Configure with +thread setup #channel' })
    .setTimestamp();
}
