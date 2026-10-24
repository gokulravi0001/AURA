const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../../../shared/logger');
const guildService = require('../../../shared/guildService');
const { COLORS } = require('../../../shared/constants');

// Module handlers
const levelingService = require('../../modules/levelingService');
const stickyService = require('../../modules/stickyService');
const threadService = require('../../modules/threadService');
const countingService = require('../../modules/countingService');
const wordChainService = require('../../modules/wordChainService');
const bumpService = require('../../modules/bumpService');
const statsService = require('../../modules/statsService');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message || !message.guild) return;

    // Track activity stats
    statsService.recordMessage(message.guild.id);

    // Fetch Guild Settings
    const settings = await guildService.getSettings(message.guild.id);
    const prefix = settings?.prefix || '+';

    // Disboard or Bump Bot Message Detection (Auto Bump Tracker)
    if (message.author.bot) {
      if (settings?.modules?.bump_reminder) {
        await bumpService.checkBotBumpMessage(message, settings);
      }
      return; // Bots do not earn XP, execute user commands, or play games
    }

    // 1. PREFIX COMMAND HANDLING (+)
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();

      if (commandName) {
        // Resolve alias or command name
        const resolvedName = client.aliases.get(commandName) || commandName;
        const command = client.prefixCommands.get(resolvedName);

        if (command) {
          // Check module enabled
          if (command.module && settings && settings.modules[command.module] === false) {
            return message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLORS.ERROR)
                  .setTitle('⚠️ Module Disabled')
                  .setDescription(`The **${command.module}** module is disabled on this server.`)
              ]
            }).catch(() => {});
          }

          // Permission check
          if (command.permissions && message.member) {
            const missing = [];
            for (const perm of command.permissions) {
              if (!message.member.permissions.has(perm)) {
                missing.push(perm);
              }
            }
            if (missing.length > 0 && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
              return message.reply({
                content: `🚫 You lack the required permissions to use this command: \`${missing.join(', ')}\``
              }).catch(() => {});
            }
          }

          try {
            await command.executePrefix(message, args, client, settings);
            return;
          } catch (err) {
            logger.error(`Error running prefix command ${resolvedName}:`, err);
            return message.reply({
              content: '❌ An error occurred while executing this command.'
            }).catch(() => {});
          }
        }
      }
    }

    // 2. MINIGAMES (Counting & Word Chain)
    if (settings?.modules?.minigames) {
      // Counting Channel Check
      if (settings.countingGame?.enabled && settings.countingGame.channelId === message.channel.id) {
        const handled = await countingService.handleMessage(message, settings);
        if (handled) return;
      }

      // Word Chain Channel Check
      if (settings.wordChainGame?.enabled && settings.wordChainGame.channelId === message.channel.id) {
        const handled = await wordChainService.handleMessage(message, settings);
        if (handled) return;
      }
    }

    // 3. AUTOMATIC IMAGE THREADS
    if (settings?.modules?.image_threads && settings.imageThreads?.enabled) {
      if (settings.imageThreads.channelId === message.channel.id) {
        await threadService.handleImageMessage(message, settings);
      }
    }

    // 3.5. AUTOMATIC BIRTHDAY CHANNEL DETECTION (Delete message & DM user)
    if (settings?.modules?.birthdays && settings.birthdays?.channelId === message.channel.id) {
      const birthdayService = require('../../modules/birthdayService');
      const Birthday = require('../../../models/Birthday');
      const parsed = birthdayService.parseDate(message.content);

      if (parsed) {
        await message.delete().catch(() => {});
        await Birthday.findOneAndUpdate(
          { guildId: message.guild.id, userId: message.author.id },
          { day: parsed.day, month: parsed.month, year: parsed.year, lastWishedYear: 0 },
          { upsert: true }
        );

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;

        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🎂 Birthday Successfully Saved!')
          .setDescription(`Hello **${message.author.username}**, your birthday has been saved for **${message.guild.name}**!\n\n📅 **Date:** \`${formatted}\`\n\n🔒 *We automatically deleted your message in the channel to keep your date private. When your birthday arrives, we will celebrate in the server!* 🎉`)
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        try {
          await message.author.send({ embeds: [dmEmbed] });
        } catch (err) {
          const tempMsg = await message.channel.send(`🎂 <@${message.author.id}>, your birthday was saved! *(Deleted your message to keep your privacy)*`);
          setTimeout(() => tempMsg.delete().catch(() => {}), 6000);
        }
        return;
      }
    }

    // 4. LEVELING XP AWARD
    if (settings?.modules?.leveling && settings.leveling?.enabled) {
      await levelingService.handleMessageXP(message, settings, client);
    }

    // 5. STICKY MESSAGES (Repost / update sticky near bottom)
    if (settings?.modules?.sticky_messages) {
      await stickyService.handleMessage(message, settings);
    }
  }
};
