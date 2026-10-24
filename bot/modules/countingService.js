const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');

const countingService = {
  async handleMessage(message, settings) {
    const content = message.content.trim();
    // Check if the message is purely a number
    if (!/^\d+$/.test(content)) return false;

    const submittedNumber = parseInt(content, 10);
    const counting = settings.countingGame || { currentNumber: 0, lastUserId: null, allowConsecutive: false, highScore: 0 };
    const expectedNumber = (counting.currentNumber || 0) + 1;

    // Check consecutive user
    if (!counting.allowConsecutive && counting.lastUserId === message.author.id && counting.currentNumber > 0) {
      await message.react('❌').catch(() => {});
      const brokenCount = counting.currentNumber;
      await message.channel.send(`⚠️ <@${message.author.id}> ruined the streak! You cannot count two numbers in a row. Count resets to **0**! (Highest Streak: **${counting.highScore}**)`);

      await Guild.updateOne(
        { guildId: message.guild.id },
        {
          $set: {
            'countingGame.currentNumber': 0,
            'countingGame.lastUserId': null
          }
        }
      );
      return true;
    }

    // Check correct number
    if (submittedNumber !== expectedNumber) {
      await message.react('❌').catch(() => {});
      const brokenCount = counting.currentNumber;
      await message.channel.send(`❌ <@${message.author.id}> said **${submittedNumber}**, but the next number was **${expectedNumber}**! The streak ended at **${brokenCount}**. Starting over at **1**!`);

      await Guild.updateOne(
        { guildId: message.guild.id },
        {
          $set: {
            'countingGame.currentNumber': 0,
            'countingGame.lastUserId': null
          }
        }
      );
      return true;
    }

    // Correct Number!
    await message.react('✅').catch(() => {});
    const newHighScore = Math.max(counting.highScore || 0, submittedNumber);

    if (submittedNumber > (counting.highScore || 0) && submittedNumber % 10 === 0) {
      await message.channel.send(`🔥 **New High Score:** **${submittedNumber}**! Keep going!`).catch(() => {});
    }

    await Guild.updateOne(
      { guildId: message.guild.id },
      {
        $set: {
          'countingGame.currentNumber': submittedNumber,
          'countingGame.lastUserId': message.author.id,
          'countingGame.highScore': newHighScore
        }
      }
    );

    return true;
  }
};

module.exports = countingService;
