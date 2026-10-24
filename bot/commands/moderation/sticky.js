const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const StickyMessage = require('../../../models/StickyMessage');
const stickyService = require('../../modules/stickyService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages for channels (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set or update a sticky message in this channel')
        .addStringOption(opt => opt.setName('text').setDescription('The message content').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Optional embed title'))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the sticky message from this channel')
    ),
  name: 'sticky',
  description: 'Manage sticky messages',
  permissions: [PermissionFlagsBits.ManageMessages],
  module: 'sticky_messages',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const channelId = interaction.channel.id;
    const guildId = interaction.guild.id;

    if (sub === 'set') {
      const text = interaction.options.getString('text');
      const title = interaction.options.getString('title');

      const sticky = await StickyMessage.findOneAndUpdate(
        { channelId },
        {
          guildId,
          content: title ? '' : text,
          embedData: title ? { title, description: text, color: '#9333ea' } : {},
          enabled: true,
          messagesSinceLastPost: 99
        },
        { upsert: true, new: true }
      );

      await stickyService.repostSticky(interaction.channel, sticky);
      return interaction.reply({ content: '📌 Sticky message configured and posted!', ephemeral: true });
    } else if (sub === 'remove') {
      const removed = await StickyMessage.findOneAndDelete({ channelId });
      if (removed && removed.lastMessageId) {
        const oldMsg = await interaction.channel.messages.fetch(removed.lastMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
      return interaction.reply({ content: '🗑️ Sticky message removed from this channel.', ephemeral: true });
    }
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();
    const channelId = message.channel.id;
    const guildId = message.guild.id;

    if (action === 'remove') {
      const removed = await StickyMessage.findOneAndDelete({ channelId });
      if (removed && removed.lastMessageId) {
        const old = await message.channel.messages.fetch(removed.lastMessageId).catch(() => null);
        if (old) await old.delete().catch(() => {});
      }
      return message.reply('🗑️ Sticky message removed.');
    }

    const text = args.join(' ');
    if (!text) {
      return message.reply('❌ Usage: `+sticky <message text>` or `+sticky remove`');
    }

    const sticky = await StickyMessage.findOneAndUpdate(
      { channelId },
      {
        guildId,
        content: text,
        enabled: true,
        messagesSinceLastPost: 99
      },
      { upsert: true, new: true }
    );

    await stickyService.repostSticky(message.channel, sticky);
    return message.reply('📌 Sticky message set and posted!');
  }
};
