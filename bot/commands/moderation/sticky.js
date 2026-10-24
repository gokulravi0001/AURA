const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const StickyMessage = require('../../../models/StickyMessage');
const stickyService = require('../../modules/stickyService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages for channels (Admin / Mod only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set or update a sticky message in this or a designated channel')
        .addStringOption(opt => opt.setName('text').setDescription('The message content').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Optional embed title'))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to attach sticky (defaults to current)').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the sticky message from this or a designated channel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to remove sticky from').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all channels with active sticky messages on this server')
    ),
  name: 'sticky',
  description: 'Manage sticky messages',
  permissions: [PermissionFlagsBits.ManageMessages],
  module: 'sticky_messages',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const text = interaction.options.getString('text');
      const title = interaction.options.getString('title');

      const Guild = require('../../../models/Guild');
      await Guild.updateOne(
        { guildId },
        { $set: { 'modules.sticky_messages': true } },
        { upsert: true }
      );

      const sticky = await StickyMessage.findOneAndUpdate(
        { channelId: channel.id },
        {
          guildId,
          content: title ? '' : text,
          embedData: title ? { title, description: text, color: '#9333ea' } : {},
          enabled: true,
          messagesSinceLastPost: 99
        },
        { upsert: true, new: true }
      );

      stickyService.updateCache(channel.id, true);
      await stickyService.repostSticky(channel, sticky);
      return interaction.reply({ content: `📌 Sticky message configured and posted in <#${channel.id}>!`, ephemeral: true });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      stickyService.updateCache(channel.id, false);
      const removed = await StickyMessage.findOneAndDelete({ channelId: channel.id });
      if (removed && removed.lastMessageId) {
        const oldMsg = await channel.messages.fetch(removed.lastMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
      return interaction.reply({ content: `🗑️ Sticky message removed from <#${channel.id}>.`, ephemeral: true });
    }

    if (sub === 'list') {
      const embed = await buildStickyListEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed] });
    }
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();
    const channel = message.mentions.channels.first() || message.channel;
    const guildId = message.guild.id;

    if (action === 'list') {
      const embed = await buildStickyListEmbed(message.guild);
      return message.reply({ embeds: [embed] });
    }

    if (action === 'remove') {
      stickyService.updateCache(channel.id, false);
      const removed = await StickyMessage.findOneAndDelete({ channelId: channel.id });
      if (removed && removed.lastMessageId) {
        const old = await channel.messages.fetch(removed.lastMessageId).catch(() => null);
        if (old) await old.delete().catch(() => {});
      }
      return message.reply(`🗑️ Sticky message removed from <#${channel.id}>.`);
    }

    const text = args.join(' ');
    if (!text) {
      return message.reply('❌ Usage: `+sticky <message text>` or `+sticky remove` or `+sticky list`');
    }

    const Guild = require('../../../models/Guild');
    await Guild.updateOne(
      { guildId },
      { $set: { 'modules.sticky_messages': true } },
      { upsert: true }
    );

    const sticky = await StickyMessage.findOneAndUpdate(
      { channelId: channel.id },
      {
        guildId,
        content: text,
        enabled: true,
        messagesSinceLastPost: 99
      },
      { upsert: true, new: true }
    );

    stickyService.updateCache(channel.id, true);
    await stickyService.repostSticky(channel, sticky);
    return message.reply(`📌 Sticky message set and posted in <#${channel.id}>!`);
  }
};

async function buildStickyListEmbed(guild) {
  const stickies = await StickyMessage.find({ guildId: guild.id, enabled: true });

  if (!stickies.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`📌 Active Sticky Messages — ${guild.name}`)
      .setDescription('No active sticky messages configured on this server.\nUse `/sticky set <text>` or `+sticky <text>` to create one!')
      .setFooter({ text: 'AURA Sticky Messages' });
  }

  let desc = '';
  for (const s of stickies) {
    const preview = s.content || s.embedData?.title || s.embedData?.description || 'Embed Notice';
    desc += `📌 <#${s.channelId}> ➔ *"${preview.substring(0, 60)}${preview.length > 60 ? '...' : ''}"*\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📌 Active Sticky Messages — ${guild.name}`)
    .setDescription(desc)
    .setFooter({ text: `Total: ${stickies.length} active channels` })
    .setTimestamp();
}
