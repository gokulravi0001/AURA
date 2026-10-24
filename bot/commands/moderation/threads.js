const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('threads')
    .setDescription('Configure automatic discussion threads for image posts (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set the channel monitored for image thread creation')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to monitor for image posts')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName('format').setDescription('Thread name format (e.g. 💬 Discussion - {author})'))
        .addIntegerOption(opt => opt.setName('duration').setDescription('Auto-archive duration (minutes: 60, 1440, 4320, 10080)'))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current image threads configuration')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable automatic image threads')
    ),
  name: 'threads',
  description: 'Manage auto image threads',
  aliases: ['imagethreads', 'thread-setup'],
  permissions: [PermissionFlagsBits.ManageChannels],
  module: 'image_threads',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const format = interaction.options.getString('format') || '💬 Discussion - {author}';
      const duration = interaction.options.getInteger('duration') || 1440;

      guildDoc.modules.image_threads = true;
      guildDoc.imageThreads = {
        enabled: true,
        channelId: channel.id,
        threadNameFormat: format,
        autoArchiveDuration: duration
      };
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('💬 Auto Image Threads Configured')
            .setDescription(`Now monitoring <#${channel.id}>.\nAny qualifying image post will automatically get a thread named \`${format}\`!`)
        ]
      });
    }

    if (sub === 'disable') {
      guildDoc.modules.image_threads = false;
      guildDoc.imageThreads.enabled = false;
      await guildDoc.save();
      return interaction.reply({ content: '❌ Auto image threads disabled.' });
    }

    // status
    return interaction.reply({ embeds: [buildThreadStatusEmbed(interaction.guild, guildDoc)] });
  },

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('🚫 Manage Channels permission required.');
    }

    const action = args[0]?.toLowerCase();
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });

    if (action === 'setup') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ Usage: `+threads setup #channel`');

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

    if (action === 'disable') {
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
      { name: 'Monitored Channel', value: channel, inline: true },
      { name: 'Naming Format', value: `\`${conf?.threadNameFormat || '💬 Discussion - {author}'}\``, inline: true }
    )
    .setFooter({ text: 'Configure with /threads setup or web dashboard' })
    .setTimestamp();
}
