const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const TempVoice = require('../../../models/TempVoice');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Manage your temporary voice channel')
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('Lock your voice channel from new members')
    )
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Unlock your voice channel')
    )
    .addSubcommand(sub =>
      sub.setName('limit')
        .setDescription('Set user limit for your channel')
        .addIntegerOption(opt => opt.setName('count').setDescription('Max users (0 for unlimited)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('rename')
        .setDescription('Rename your voice channel')
        .addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true))
    ),
  name: 'voice',
  description: 'Manage your temporary voice channel',
  aliases: ['vc'],
  module: 'join_to_create',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be inside a temporary voice channel to use this command.', ephemeral: true });
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return interaction.reply({ content: '❌ This channel is not a bot-managed temporary channel.', ephemeral: true });
    }

    if (tempDoc.ownerId !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '🚫 You are not the owner of this voice channel.', ephemeral: true });
    }

    if (sub === 'lock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      return interaction.reply({ content: '🔒 Voice channel locked! Nobody else can connect.', ephemeral: true });
    } else if (sub === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      return interaction.reply({ content: '🔓 Voice channel unlocked! Members can connect.', ephemeral: true });
    } else if (sub === 'limit') {
      const count = interaction.options.getInteger('count');
      await voiceChannel.setUserLimit(count);
      return interaction.reply({ content: `👥 User limit set to **${count === 0 ? 'unlimited' : count}**.`, ephemeral: true });
    } else if (sub === 'rename') {
      const newName = interaction.options.getString('name');
      await voiceChannel.setName(newName);
      return interaction.reply({ content: `✏️ Voice channel renamed to **"${newName}"**.`, ephemeral: true });
    }
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();
    const voiceChannel = message.member?.voice?.channel;

    if (!voiceChannel) {
      return message.reply('❌ You must be connected to your temporary voice channel.');
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return message.reply('❌ This voice channel is not a temporary channel created by AURA.');
    }

    if (tempDoc.ownerId !== message.author.id && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 Only the channel creator or an administrator can manage this channel.');
    }

    if (action === 'lock') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
      return message.reply('🔒 Voice channel locked.');
    } else if (action === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: true });
      return message.reply('🔓 Voice channel unlocked.');
    } else if (action === 'limit') {
      const count = parseInt(args[1], 10);
      if (isNaN(count)) return message.reply('❌ Usage: `+voice limit <number>`');
      await voiceChannel.setUserLimit(count);
      return message.reply(`👥 User limit updated to **${count}**.`);
    } else if (action === 'rename') {
      const newName = args.slice(1).join(' ');
      if (!newName) return message.reply('❌ Usage: `+voice rename <new name>`');
      await voiceChannel.setName(newName);
      return message.reply(`✏️ Voice channel renamed to **"${newName}"**.`);
    } else {
      return message.reply('ℹ️ Available subcommands: `lock`, `unlock`, `limit <num>`, `rename <name>`.');
    }
  }
};
