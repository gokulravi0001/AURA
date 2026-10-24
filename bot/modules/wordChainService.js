const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');

const wordChainService = {
  async handleMessage(message, settings) {
    const raw = message.content.trim().toLowerCase();
    // Must be a single word without numbers or spaces
    if (!/^[a-z]{2,30}$/.test(raw)) return false;

    const game = settings.wordChainGame || { lastWord: '', lastUserId: null, usedWords: [], currentStreak: 0, highScore: 0 };

    // Check same user consecutive
    if (game.lastUserId === message.author.id && game.currentStreak > 0) {
      await message.react('❌').catch(() => {});
      await message.channel.send(`⚠️ <@${message.author.id}>, you cannot submit two words in a row! Streak reset.`);
      await this.resetGame(message.guild.id);
      return true;
    }

    // Check starting letter if there was a previous word
    if (game.lastWord) {
      const requiredLetter = game.lastWord.slice(-1).toLowerCase();
      if (!raw.startsWith(requiredLetter)) {
        await message.react('❌').catch(() => {});
        await message.channel.send(`❌ <@${message.author.id}>, **"${raw}"** does not start with **"${requiredLetter.toUpperCase()}"**! The chain broke at streak **${game.currentStreak}**!`);
        await this.resetGame(message.guild.id);
        return true;
      }
    }

    // Check if word was already used
    if (game.usedWords && game.usedWords.includes(raw)) {
      await message.react('❌').catch(() => {});
      await message.channel.send(`⚠️ **"${raw}"** has already been used in this chain! Word chain reset.`);
      await this.resetGame(message.guild.id);
      return true;
    }

    // Valid word!
    await message.react('🔗').catch(() => {});
    const newStreak = (game.currentStreak || 0) + 1;
    const newHighScore = Math.max(game.highScore || 0, newStreak);
    const nextLetter = raw.slice(-1).toUpperCase();

    if (newStreak % 10 === 0) {
      await message.channel.send(`🔥 **Streak Milestone:** **${newStreak} words**! Next letter is **${nextLetter}**.`);
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
