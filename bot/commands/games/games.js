const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const gamesManager = require('../../modules/gamesManager');
const Guild = require('../../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('games')
    .setDescription('Play minigames or configure game channels')
    .addSubcommand(sub =>
      sub.setName('rps')
        .setDescription('Play Rock Paper Scissors with another user or the bot')
        .addUserOption(opt => opt.setName('opponent').setDescription('Choose an opponent (leave empty to play bot)'))
    )
    .addSubcommand(sub =>
      sub.setName('setup-counting')
        .setDescription('Set the designated counting game channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Counting channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('setup-wordchain')
        .setDescription('Set the designated word-chain channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Word chain channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),
  name: 'rps',
  description: 'Play Rock Paper Scissors',
  aliases: ['rockpaperscissors'],
  module: 'minigames',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'rps') {
      const opponent = interaction.options.getUser('opponent');
      const gamePayload = await gamesManager.startRPS(interaction, opponent);
      return interaction.reply(gamePayload);
    } else if (sub === 'setup-counting') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'countingGame.enabled': true,
            'countingGame.channelId': channel.id,
            'countingGame.currentNumber': 0
          }
        },
        { upsert: true }
      );
      return interaction.reply(`🔢 Counting game enabled in <#${channel.id}>! Start by typing \`1\`.`);
    } else if (sub === 'setup-wordchain') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'wordChainGame.enabled': true,
            'wordChainGame.channelId': channel.id,
            'wordChainGame.lastWord': '',
            'wordChainGame.usedWords': []
          }
        },
        { upsert: true }
      );
      return interaction.reply(`🔗 Word Chain enabled in <#${channel.id}>! Type any word to start.`);
    }
  },

  async executePrefix(message, args, client) {
    const opponent = message.mentions.users.first();
    const gamePayload = await gamesManager.startRPS(message, opponent);
    return message.reply(gamePayload);
  }
};
