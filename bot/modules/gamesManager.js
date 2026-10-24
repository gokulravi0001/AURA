const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../shared/constants');

// Active games store
const activeGames = new Map();

const gamesManager = {
  /**
   * Start Rock Paper Scissors game
   */
  async startRPS(interaction, opponent) {
    const gameId = `rps_${interaction.id}`;
    const challenger = interaction.user;

    activeGames.set(gameId, {
      type: 'rps',
      p1: challenger.id,
      p2: opponent ? opponent.id : 'bot',
      p1Name: challenger.username,
      p2Name: opponent ? opponent.username : 'AURA Bot',
      p1Choice: null,
      p2Choice: null
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`game_rps_rock_${gameId}`).setLabel('Rock').setEmoji('🪨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`game_rps_paper_${gameId}`).setLabel('Paper').setEmoji('📄').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`game_rps_scissors_${gameId}`).setLabel('Scissors').setEmoji('✂️').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🎮 Rock Paper Scissors')
      .setDescription(`${challenger} has challenged ${opponent ? opponent : 'AURA Bot'} to a match!\nMake your choice using the buttons below.`);

    return { embeds: [embed], components: [row] };
  },

  /**
   * Handle Button clicks for minigames
   */
  async handleButton(interaction, client) {
    const parts = interaction.customId.split('_');
    // game_rps_choice_gameId or game_ttt_pos_gameId
    const subType = parts[1]; // 'rps' or 'ttt'

    if (subType === 'rps') {
      const choice = parts[2];
      const gameId = parts.slice(3).join('_');
      const game = activeGames.get(gameId);

      if (!game) {
        return interaction.reply({ content: '⚠️ This game has expired or already ended.', ephemeral: true });
      }

      if (interaction.user.id !== game.p1 && (game.p2 !== 'bot' && interaction.user.id !== game.p2)) {
        return interaction.reply({ content: '🚫 You are not a player in this game!', ephemeral: true });
      }

      if (game.p2 === 'bot') {
        const botChoices = ['rock', 'paper', 'scissors'];
        const botPick = botChoices[Math.floor(Math.random() * botChoices.length)];

        let resultText = '';
        if (choice === botPick) {
          resultText = `🤝 It's a tie! Both chose **${choice}**!`;
        } else if (
          (choice === 'rock' && botPick === 'scissors') ||
          (choice === 'paper' && botPick === 'rock') ||
          (choice === 'scissors' && botPick === 'paper')
        ) {
          resultText = `🎉 **${interaction.user.username} wins!** You picked **${choice}** and Bot picked **${botPick}**!`;
        } else {
          resultText = `💀 **Bot wins!** You picked **${choice}** and Bot picked **${botPick}**!`;
        }

        activeGames.delete(gameId);
        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.PRIMARY)
              .setTitle('🎮 Rock Paper Scissors Result')
              .setDescription(resultText)
          ],
          components: []
        });
      }
    }
  }
};

module.exports = gamesManager;
