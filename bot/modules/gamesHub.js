const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const Guild = require('../../models/Guild');
const gamesManager = require('./gamesManager');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const gamesHub = {
  /**
   * Build the complete minimal interactive Minigames Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const c = guildDoc?.countingGame;
    const countingText = c?.channelId
      ? `• **Channel:** <#${c.channelId}>\n• **Current Count:** \`${c.currentNumber || 0}\` • **Server Record:** 🏆 \`${c.highScore || 0}\``
      : '*Counting game channel is not configured.*';

    const w = guildDoc?.wordChainGame;
    const nextLetter = w?.lastWord ? w.lastWord.slice(-1).toUpperCase() : 'Any letter';
    const wordChainText = w?.channelId
      ? `• **Channel:** <#${w.channelId}>\n• **Last Word:** \`${w.lastWord || 'None yet'}\` (Next letter: **${nextLetter}**)\n• **Current Streak:** \`${w.currentStreak || 0}\` • **Record Streak:** 🏆 \`${w.highScore || 0}\``
      : '*Word chain channel is not configured.*';

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎮 Community Minigames & Activity — ${guild.name}`)
      .setDescription(
        'Interactive community games for your server members.\n' +
        'Click any game button below or select an option from the menu to play or setup!'
      )
      .addFields(
        {
          name: '🔢 Counting Game',
          value: countingText
        },
        {
          name: '🔗 Word Chain Challenge',
          value: wordChainText
        },
        {
          name: '🥊 Instant Minigames',
          value: '• **Rock Paper Scissors:** Play against AURA or challenge a friend\n• **Trivia:** Test your general knowledge with timed questions'
        }
      )
      .setFooter({ text: 'AURA Minigames Suite • Play with friends in chat' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You can configure dedicated Counting and Word Chain channels using the buttons below.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components
   */
  buildHubComponents(isAdmin, guildDoc = null) {
    const components = [];

    // Row 1: Interactive Dropdown Select Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_game_rps')
        .setLabel('Play Rock-Paper-Scissors')
        .setDescription('Challenge the bot or a friend')
        .setEmoji('✂️'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_game_trivia')
        .setLabel('Play Trivia')
        .setDescription('Answer a 30-second timed knowledge question')
        .setEmoji('🧠'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_game_counting_info')
        .setLabel('Counting Channel Info')
        .setDescription('View current count and high score')
        .setEmoji('🔢'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_game_wordchain_info')
        .setLabel('Word Chain Info')
        .setDescription('View last word and current streak')
        .setEmoji('🔗')
    ];

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_game_setup_counting')
          .setLabel('Set Counting Channel')
          .setDescription('Choose where members count 1, 2, 3...')
          .setEmoji('🔢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_game_setup_wordchain')
          .setLabel('Set Word Chain Channel')
          .setDescription('Choose where members play word chain')
          .setEmoji('🔗')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_games_action')
      .setPlaceholder('⚡ Choose a minigame to play or configure...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Member Quick Action Buttons
    const memberRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_games_rps')
        .setLabel('Rock Paper Scissors')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✂️'),
      new ButtonBuilder()
        .setCustomId('btn_games_trivia')
        .setLabel('Trivia')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🧠'),
      new ButtonBuilder()
        .setCustomId('btn_games_refresh')
        .setLabel('Refresh Scores')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );
    components.push(memberRow);

    // Row 3: Admin Quick Action Buttons (STRICTLY ADMIN ONLY)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_games_setup_counting')
          .setLabel('Set Counting Channel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔢'),
        new ButtonBuilder()
          .setCustomId('btn_games_setup_wordchain')
          .setLabel('Set Word Chain Channel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔗')
      );
      components.push(adminRow);
    }

    return components;
  },

  /**
   * Handle button interactions
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (customId === 'btn_games_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'btn_games_rps') {
      const gamePayload = await gamesManager.startRPS(interaction, null);
      return interaction.reply(gamePayload);
    }

    if (customId === 'btn_games_trivia') {
      return await this.sendTrivia(interaction);
    }

    if (customId === 'btn_games_setup_counting') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_games_channel_counting')
        .setPlaceholder('🔢 Select designated Counting channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({ content: '🔢 **Select the text channel for the counting game:**', components: [row], ephemeral: true });
    }

    if (customId === 'btn_games_setup_wordchain') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_games_channel_wordchain')
        .setPlaceholder('🔗 Select designated Word Chain channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({ content: '🔗 **Select the text channel for the word chain game:**', components: [row], ephemeral: true });
    }
  },

  /**
   * Handle select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (selected === 'act_game_rps') {
      const gamePayload = await gamesManager.startRPS(interaction, null);
      return interaction.reply(gamePayload);
    }

    if (selected === 'act_game_trivia') {
      return await this.sendTrivia(interaction);
    }

    if (selected === 'act_game_counting_info') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const c = guildDoc?.countingGame;
      return interaction.reply({
        content: `🔢 **Counting Game Status:**\n• Channel: ${c?.channelId ? `<#${c.channelId}>` : 'Not set'}\n• Current Count: **${c?.currentNumber || 0}**\n• High Score: 🏆 **${c?.highScore || 0}**`,
        ephemeral: true
      });
    }

    if (selected === 'act_game_wordchain_info') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const w = guildDoc?.wordChainGame;
      const nextLetter = w?.lastWord ? w.lastWord.slice(-1).toUpperCase() : 'Any letter';
      return interaction.reply({
        content: `🔗 **Word Chain Status:**\n• Channel: ${w?.channelId ? `<#${w.channelId}>` : 'Not set'}\n• Last Word: **${w?.lastWord || 'None'}**\n• Next Required Letter: **${nextLetter}**\n• Current Streak: **${w?.currentStreak || 0}**\n• Record Streak: 🏆 **${w?.highScore || 0}**`,
        ephemeral: true
      });
    }

    if (selected === 'act_game_setup_counting') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_games_channel_counting')
        .setPlaceholder('🔢 Select designated Counting channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({ content: '🔢 **Select the text channel for the counting game:**', components: [row], ephemeral: true });
    }

    if (selected === 'act_game_setup_wordchain') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_games_channel_wordchain')
        .setPlaceholder('🔗 Select designated Word Chain channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({ content: '🔗 **Select the text channel for the word chain game:**', components: [row], ephemeral: true });
    }
  },

  /**
   * Handle channel select menus
   */
  async handleChannelSelect(interaction, client) {
    if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const channelId = interaction.values[0];

    if (interaction.customId === 'select_games_channel_counting') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.minigames': true,
            'countingGame.enabled': true,
            'countingGame.channelId': channelId,
            'countingGame.currentNumber': 0
          }
        },
        { upsert: true }
      );
      return interaction.reply({ content: `🔢 Counting game channel set to <#${channelId}>! Members can start counting with \`1\`.`, ephemeral: true });
    }

    if (interaction.customId === 'select_games_channel_wordchain') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.minigames': true,
            'wordChainGame.enabled': true,
            'wordChainGame.channelId': channelId,
            'wordChainGame.lastWord': '',
            'wordChainGame.usedWords': []
          }
        },
        { upsert: true }
      );
      return interaction.reply({ content: `🔗 Word Chain channel set to <#${channelId}>! Members can start with any word.`, ephemeral: true });
    }
  },

  /**
   * Helper to send interactive trivia question
   */
  async sendTrivia(interaction) {
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
};

module.exports = gamesHub;
