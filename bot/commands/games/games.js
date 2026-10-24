const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const gamesManager = require('../../modules/gamesManager');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

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
      sub.setName('trivia')
        .setDescription('Answer an interactive trivia question')
    )
    .addSubcommand(sub =>
      sub.setName('counting-setup')
        .setDescription('Set the designated counting game channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Counting channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('counting-status')
        .setDescription('View current counting game progress and high score')
    )
    .addSubcommand(sub =>
      sub.setName('wordchain-setup')
        .setDescription('Set the designated word-chain channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Word chain channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('wordchain-status')
        .setDescription('View current word chain streak and last word')
    ),
  name: 'games',
  description: 'Play minigames or configure game channels',
  aliases: ['rps', 'trivia', 'counting', 'wordchain'],
  module: 'minigames',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });

    // 1. RPS
    if (sub === 'rps') {
      const opponent = interaction.options.getUser('opponent');
      const gamePayload = await gamesManager.startRPS(interaction, opponent);
      return interaction.reply(gamePayload);
    }

    // 2. TRIVIA
    if (sub === 'trivia') {
      const triviaQuestions = [
        { q: 'What is the fastest land animal?', options: ['Cheetah', 'Lion', 'Falcon', 'Horse'], correct: 0 },
        { q: 'What planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correct: 1 },
        { q: 'How many continents are on Earth?', options: ['5', '6', '7', '8'], correct: 2 },
        { q: 'What element has the chemical symbol "O"?', options: ['Gold', 'Iron', 'Oxygen', 'Osmium'], correct: 2 },
        { q: 'Which programming language powers Discord.js?', options: ['Python', 'JavaScript', 'C++', 'Rust'], correct: 1 }
      ];

      const item = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
      const row = new ActionRowBuilder();

      item.options.forEach((opt, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_${idx === item.correct ? 'win' : 'lose'}_${interaction.id}`)
            .setLabel(opt)
            .setStyle(ButtonStyle.Primary)
        );
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🧠 Trivia Time!')
        .setDescription(`**${item.q}**\n\nClick the correct answer below within 30 seconds!`);

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 3. COUNTING SETUP
    if (sub === 'counting-setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.minigames': true,
            'countingGame.enabled': true,
            'countingGame.channelId': channel.id,
            'countingGame.currentNumber': 0
          }
        },
        { upsert: true }
      );
      return interaction.reply(`🔢 Counting game enabled in <#${channel.id}>! Start counting by typing \`1\`.`);
    }

    // 4. COUNTING STATUS
    if (sub === 'counting-status') {
      const c = guildDoc?.countingGame;
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🔢 Counting Game Status')
        .addFields(
          { name: 'Channel', value: c?.channelId ? `<#${c.channelId}>` : 'Not set', inline: true },
          { name: 'Current Count', value: `**${c?.currentNumber || 0}**`, inline: true },
          { name: 'High Score', value: `🏆 **${c?.highScore || 0}**`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }

    // 5. WORD CHAIN SETUP
    if (sub === 'wordchain-setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.minigames': true,
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

    // 6. WORD CHAIN STATUS
    if (sub === 'wordchain-status') {
      const w = guildDoc?.wordChainGame;
      const nextLetter = w?.lastWord ? w.lastWord.slice(-1).toUpperCase() : 'Any letter';
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🔗 Word Chain Status')
        .addFields(
          { name: 'Channel', value: w?.channelId ? `<#${w.channelId}>` : 'Not set', inline: true },
          { name: 'Last Word', value: w?.lastWord ? `**${w.lastWord}**` : 'None yet', inline: true },
          { name: 'Next Letter', value: `**${nextLetter}**`, inline: true },
          { name: 'Current Streak', value: `**${w?.currentStreak || 0}**`, inline: true },
          { name: 'Record High Streak', value: `🏆 **${w?.highScore || 0}**`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  },

  async executePrefix(message, args, client) {
    const commandUsed = message.content.slice(1).trim().split(/ +/)[0]?.toLowerCase();
    const action = args[0]?.toLowerCase();

    if (commandUsed === 'rps') {
      const opponent = message.mentions.users.first();
      const gamePayload = await gamesManager.startRPS(message, opponent);
      return message.reply(gamePayload);
    }

    if (commandUsed === 'counting' || action === 'counting') {
      const guildDoc = await Guild.findOne({ guildId: message.guild.id });
      if (args[1]?.toLowerCase() === 'setup') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Usage: `+counting setup #channel`');
        await Guild.updateOne(
          { guildId: message.guild.id },
          { $set: { 'countingGame.enabled': true, 'countingGame.channelId': channel.id, 'countingGame.currentNumber': 0 } },
          { upsert: true }
        );
        return message.reply(`🔢 Counting game enabled in <#${channel.id}>!`);
      }

      const c = guildDoc?.countingGame;
      return message.reply(`🔢 Current Count: **${c?.currentNumber || 0}** | High Score: **${c?.highScore || 0}** | Channel: ${c?.channelId ? `<#${c.channelId}>` : 'None'}`);
    }

    if (commandUsed === 'wordchain' || action === 'wordchain') {
      const guildDoc = await Guild.findOne({ guildId: message.guild.id });
      if (args[1]?.toLowerCase() === 'setup') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Usage: `+wordchain setup #channel`');
        await Guild.updateOne(
          { guildId: message.guild.id },
          { $set: { 'wordChainGame.enabled': true, 'wordChainGame.channelId': channel.id, 'wordChainGame.lastWord': '' } },
          { upsert: true }
        );
        return message.reply(`🔗 Word Chain enabled in <#${channel.id}>!`);
      }

      const w = guildDoc?.wordChainGame;
      return message.reply(`🔗 Last Word: **${w?.lastWord || 'None'}** | Streak: **${w?.currentStreak || 0}** | High Streak: **${w?.highScore || 0}**`);
    }

    return message.reply('ℹ️ Available games: `+rps [@user]`, `+counting [setup #channel]`, `+wordchain [setup #channel]`.');
  }
};
