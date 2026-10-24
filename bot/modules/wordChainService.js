const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');

const wordChainService = {
  async handleMessage(message, settings) {
    if (!message || !message.content || message.author.bot) return false;

    const raw = message.content.trim().toLowerCase();
    // Must be a single word without numbers, spaces, or symbols
    if (!/^[a-z]{2,30}$/.test(raw)) {
      await message.react('❌').catch(() => {});
      return false;
    }

    const game = settings.wordChainGame || { lastWord: '', lastUserId: null, usedWords: [], currentStreak: 0, highScore: 0 };

    // 1. Check same user consecutive
    if (game.lastUserId === message.author.id && game.currentStreak > 0) {
      await message.react('❌').catch(() => {});
      await message.channel.send(`⚠️ <@${message.author.id}>, you cannot submit two words in a row! Streak reset to **0**.`);
      await this.resetGame(message.guild.id);
      if (settings.wordChainGame) {
        settings.wordChainGame.lastWord = '';
        settings.wordChainGame.lastUserId = null;
        settings.wordChainGame.usedWords = [];
        settings.wordChainGame.currentStreak = 0;
      }
      return true;
    }

    // 2. Check starting letter if there was a previous word
    if (game.lastWord) {
      const requiredLetter = game.lastWord.slice(-1).toLowerCase();
      if (!raw.startsWith(requiredLetter)) {
        await message.react('❌').catch(() => {});
        await message.channel.send(`❌ <@${message.author.id}>, **"${raw}"** does not start with **"${requiredLetter.toUpperCase()}"**! The chain broke at streak **${game.currentStreak}**!`);
        await this.resetGame(message.guild.id);
        if (settings.wordChainGame) {
          settings.wordChainGame.lastWord = '';
          settings.wordChainGame.lastUserId = null;
          settings.wordChainGame.usedWords = [];
          settings.wordChainGame.currentStreak = 0;
        }
        return true;
      }
    }

    // 3. Check if word was already used
    if (game.usedWords && game.usedWords.includes(raw)) {
      await message.react('❌').catch(() => {});
      await message.channel.send(`⚠️ **"${raw}"** has already been used in this chain! Streak broke at **${game.currentStreak}**.`);
      await this.resetGame(message.guild.id);
      if (settings.wordChainGame) {
        settings.wordChainGame.lastWord = '';
        settings.wordChainGame.lastUserId = null;
        settings.wordChainGame.usedWords = [];
        settings.wordChainGame.currentStreak = 0;
      }
      return true;
    }

    // 4. Valid word! React with ✅ (Right)
    await message.react('✅').catch(() => {});
    const newStreak = (game.currentStreak || 0) + 1;
    const newHighScore = Math.max(game.highScore || 0, newStreak);
    const nextLetter = raw.slice(-1).toUpperCase();

    if (newStreak % 10 === 0) {
      await message.channel.send(`🔥 **Streak Milestone:** **${newStreak} words**! Next word must start with **${nextLetter}**.`);
    }

    await Guild.updateOne(
      { guildId: message.guild.id },
      {
        $set: {
          'wordChainGame.lastWord': raw,
          'wordChainGame.lastUserId': message.author.id,
          'wordChainGame.currentStreak': newStreak,
          'wordChainGame.highScore': newHighScore
        },
        $push: {
          'wordChainGame.usedWords': raw
        }
      }
    );

    if (settings.wordChainGame) {
      settings.wordChainGame.lastWord = raw;
      settings.wordChainGame.lastUserId = message.author.id;
      settings.wordChainGame.currentStreak = newStreak;
      settings.wordChainGame.highScore = newHighScore;
      if (!settings.wordChainGame.usedWords) settings.wordChainGame.usedWords = [];
      settings.wordChainGame.usedWords.push(raw);
    }

    return true;
  },

  async resetGame(guildId) {
    await Guild.updateOne(
      { guildId },
      {
        $set: {
          'wordChainGame.lastWord': '',
          'wordChainGame.lastUserId': null,
          'wordChainGame.usedWords': [],
          'wordChainGame.currentStreak': 0
        }
      }
    );
  }
};

module.exports = wordChainService;
