const cron = require('node-cron');
const Birthday = require('../../models/Birthday');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const { EmbedBuilder } = require('discord.js');

const birthdayService = {
  /**
   * Parse user entered date string
   * Supported: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, DD/MM, MM/DD
   */
  parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();

    // Check YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{4}))?$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : null;
      if (this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    return null;
  },

  isValidDate(day, month, year) {
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if ([4, 6, 9, 11].includes(month) && day > 30) return false;
    if (month === 2) {
      const isLeap = year ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) : true;
      if (day > (isLeap ? 29 : 28)) return false;
    }
    return true;
  },

  /**
   * Handle modal submission from /birthday command
   */
  async handleModalSubmit(interaction, client) {
    const dateInput = interaction.fields.getTextInputValue('birthday_input');
    const parsed = this.parseDate(dateInput);

    if (!parsed) {
      return interaction.reply({
        content: '❌ Invalid date format. Please use `DD/MM/YYYY`, `DD-MM-YYYY`, or `DD/MM` (e.g. `24/10` or `15/05/2000`).',
        ephemeral: true
      });
    }

    try {
      await Birthday.findOneAndUpdate(
        { guildId: interaction.guildId, userId: interaction.user.id },
        {
          day: parsed.day,
          month: parsed.month,
          year: parsed.year,
          lastWishedYear: 0
        },
        { upsert: true, new: true }
      );

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🎂 Birthday Registered!')
            .setDescription(`Your birthday has been successfully set to **${formatted}**.\nThe server will automatically celebrate your birthday!`)
        ],
        ephemeral: true
      });
    } catch (err) {
      logger.error('Error saving birthday:', err);
      return interaction.reply({
        content: '❌ Failed to save your birthday. Please try again.',
        ephemeral: true
      });
    }
  },

  /**
   * Initialize cron job to check birthdays every hour
   */
  init(client) {
    // Run at minute 0 of every hour
    cron.schedule('0 * * * *', async () => {
      await this.checkBirthdays(client);
    });
  },

  /**
   * Check birthdays for all active guilds
   */
  async checkBirthdays(client) {
    try {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;
      const currentDay = now.getUTCDate();

      // Find guilds with birthdays module enabled
      const guilds = await Guild.find({ 'modules.birthdays': true, 'birthdays.enabled': true });

      for (const guildConfig of guilds) {
        const guild = client.guilds.cache.get(guildConfig.guildId);
        if (!guild) continue;

        const announcementChannelId = guildConfig.birthdays.channelId;
        const channel = announcementChannelId ? guild.channels.cache.get(announcementChannelId) : null;
        if (!channel || !channel.isTextBased()) continue;

        // Query birthdays for today
        const birthdaysToday = await Birthday.find({
          guildId: guild.id,
          month: currentMonth,
          day: currentDay,
          lastWishedYear: { $ne: currentYear }
        });

        for (const bday of birthdaysToday) {
          try {
            const member = await guild.members.fetch(bday.userId).catch(() => null);
            if (!member) continue;

            // Optional age calculation
            let ageStr = '';
            if (bday.year) {
              const age = currentYear - bday.year;
              ageStr = ` on turning **${age}**`;
            }

            const rawMsg = guildConfig.birthdays.message || '🎂 Happy Birthday {user}! Wishing you an awesome day! 🎉';
            const formattedMsg = rawMsg
              .replace(/{user}/g, `<@${member.id}>`)
              .replace(/{username}/g, member.user.username);

            const embed = new EmbedBuilder()
              .setColor(COLORS.PRIMARY)
              .setTitle('🎉 Happy Birthday! 🎂')
              .setDescription(`${formattedMsg}${ageStr}`)
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
              .setFooter({ text: 'Celebrate with them today!' })
              .setTimestamp();

            await channel.send({ content: `<@${member.id}>`, embeds: [embed] });

            // Assign birthday role if configured
            if (guildConfig.birthdays.roleId) {
              const role = guild.roles.cache.get(guildConfig.birthdays.roleId);
              if (role && guild.members.me?.permissions.has('ManageRoles')) {
                await member.roles.add(role).catch(() => {});
              }
            }

            bday.lastWishedYear = currentYear;
            await bday.save();
          } catch (err) {
            logger.error(`Error wishing birthday to ${bday.userId}:`, err.message);
          }
        }
      }
    } catch (err) {
      logger.error('Error running birthday check cron:', err);
    }
  }
};

module.exports = birthdayService;
