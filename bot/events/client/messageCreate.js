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
          const subAction = args[0]?.toLowerCase();
          const isSetupSubcommand = ['setup', 'set', 'panel', 'enable', 'config', 'status', 'view', 'list', 'help'].includes(subAction);
          const isAdmin = message.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

          if (command.module && settings && settings.modules && settings.modules[command.module] === false) {
            if (isAdmin || isSetupSubcommand) {
              settings.modules[command.module] = true;
              const Guild = require('../../../models/Guild');
              await Guild.updateOne(
                { guildId: message.guild.id },
                { $set: { [`modules.${command.module}`]: true } },
                { upsert: true }
              ).catch(() => {});
            } else {
              return message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('⚠️ Module Disabled')
                    .setDescription(`The **${command.module}** module is disabled on this server. An administrator can enable it with \`+${resolvedName} setup\`.`)
                ]
              }).catch(() => {});
            }
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
    const chName = message.channel.name?.toLowerCase() || '';
    const isNamedSetChannel = (
      chName === 'bday-set' ||
      chName === 'birthday-set' ||
      chName === 'set-bday' ||
      chName === 'set-birthday' ||
      chName === 'birthdays' ||
      chName === 'birthday' ||
      chName === 'bday'
    );
    const isExplicitBdaySetChannel = settings?.birthdays?.setChannelId && settings.birthdays.setChannelId === message.channel.id;
    const isBdayLegacyChannel = !settings?.birthdays?.setChannelId && settings?.birthdays?.channelId === message.channel.id;
    const isBdaySetChannel = isExplicitBdaySetChannel || (isNamedSetChannel && !settings?.birthdays?.setChannelId);

    if (settings?.modules?.birthdays !== false && (isBdaySetChannel || isBdayLegacyChannel)) {
      // Auto-bind setChannelId if discovered by channel name
      if (isNamedSetChannel && !settings?.birthdays?.setChannelId) {
        const Guild = require('../../../models/Guild');
        await Guild.updateOne(
          { guildId: message.guild.id },
          { $set: { 'birthdays.setChannelId': message.channel.id, 'modules.birthdays': true, 'birthdays.enabled': true } },
          { upsert: true }
        ).catch(() => {});
        if (settings?.birthdays) settings.birthdays.setChannelId = message.channel.id;
      }

      const birthdayService = require('../../modules/birthdayService');
      const Birthday = require('../../../models/Birthday');
      const parsed = birthdayService.parseDate(message.content);

      // Always delete message from birthday set channel immediately to protect user privacy
      await message.delete().catch(() => {});

      if (parsed) {
        await Birthday.findOneAndUpdate(
          { guildId: message.guild.id, userId: message.author.id },
          { day: parsed.day, month: parsed.month, year: parsed.year, lastWishedYear: 0 },
          { upsert: true }
        );

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;
        const wishChannelNotice = settings.birthdays?.wishChannelId
          ? `<#${settings.birthdays.wishChannelId}>`
          : 'the server announcements channel';

        const dmEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🎂 Birthday Successfully Saved!')
          .setDescription(
            `Hello **${message.author.username}**, your birthday has been saved for **${message.guild.name}**!\n\n` +
            `📅 **Date:** \`${formatted}\`\n\n` +
            `🔒 **Privacy:** *We automatically deleted your message in <#${message.channel.id}> so your birthdate stays completely private.*\n\n` +
            `🎉 *When your special day arrives, we will celebrate with you in ${wishChannelNotice}!*`
          )
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        try {
          await message.author.send({ embeds: [dmEmbed] });
        } catch (err) {
          const tempMsg = await message.channel.send(
            `🎂 <@${message.author.id}>, your birthday was saved as **${formatted}**!\n*(Deleted your message for privacy. Enable DMs from server members to receive private confirmations!)*`
          );
          setTimeout(() => tempMsg.delete().catch(() => {}), 6000);
        }
        return;
      } else if (isBdaySetChannel) {
        // User typed invalid format in dedicated set channel
        const errEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('❌ Invalid Birthday Format')
          .setDescription(
            `Hello **${message.author.username}**! In **${message.guild.name}**, please provide your birthday in **DD/MM/YYYY** format (e.g. \`24/10/2005\` or \`24/10\`).\n\n` +
            `🔒 *Your message was automatically deleted to protect your privacy and keep the channel clean.*`
          )
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

        try {
          await message.author.send({ embeds: [errEmbed] });
        } catch (err) {
          const tempMsg = await message.channel.send(
            `⚠️ <@${message.author.id}>, please send your birthday in **DD/MM/YYYY** format (e.g. \`24/10/2005\`). *(Deleted for privacy)*`
          );
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
    if (settings?.modules?.sticky_messages !== false) {
      await stickyService.handleMessage(message, settings);
    }
  }
};
