const cron = require('node-cron');
const Birthday = require('../../models/Birthday');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const { EmbedBuilder } = require('discord.js');

const COMMON_TIMEZONES = {
  india: 'Asia/Kolkata', ind: 'Asia/Kolkata', ist: 'Asia/Kolkata',
  usa: 'America/New_York', us: 'America/New_York', est: 'America/New_York', edt: 'America/New_York',
  cst: 'America/Chicago', cdt: 'America/Chicago', mst: 'America/Denver', mdt: 'America/Denver',
  pst: 'America/Los_Angeles', pdt: 'America/Los_Angeles',
  uk: 'Europe/London', england: 'Europe/London', london: 'Europe/London', gmt: 'UTC', utc: 'UTC', bst: 'Europe/London',
  canada: 'America/Toronto', toronto: 'America/Toronto', vancouver: 'America/Vancouver',
  dubai: 'Asia/Dubai', uae: 'Asia/Dubai',
  singapore: 'Asia/Singapore', sgt: 'Asia/Singapore',
  malaysia: 'Asia/Kuala_Lumpur', myt: 'Asia/Kuala_Lumpur',
  japan: 'Asia/Tokyo', tokyo: 'Asia/Tokyo', jst: 'Asia/Tokyo',
  korea: 'Asia/Seoul', seoul: 'Asia/Seoul', kst: 'Asia/Seoul',
  australia: 'Australia/Sydney', sydney: 'Australia/Sydney', aest: 'Australia/Sydney',
  germany: 'Europe/Berlin', berlin: 'Europe/Berlin', cet: 'Europe/Berlin',
  france: 'Europe/Paris', paris: 'Europe/Paris',
  italy: 'Europe/Rome', rome: 'Europe/Rome',
  spain: 'Europe/Madrid', madrid: 'Europe/Madrid',
  pakistan: 'Asia/Karachi', karachi: 'Asia/Karachi', pkt: 'Asia/Karachi',
  srilanka: 'Asia/Colombo', colombo: 'Asia/Colombo',
  bangladesh: 'Asia/Dhaka', dhaka: 'Asia/Dhaka', bdt: 'Asia/Dhaka',
  nepal: 'Asia/Kathmandu', kathmandu: 'Asia/Kathmandu', npt: 'Asia/Kathmandu',
  philippines: 'Asia/Manila', manila: 'Asia/Manila', pht: 'Asia/Manila',
  russia: 'Europe/Moscow', moscow: 'Europe/Moscow',
  brazil: 'America/Sao_Paulo', 'saopaulo': 'America/Sao_Paulo',
  mexico: 'America/Mexico_City',
  nz: 'Pacific/Auckland', newzealand: 'Pacific/Auckland', auckland: 'Pacific/Auckland',
  saudi: 'Asia/Riyadh', riyadh: 'Asia/Riyadh'
};

const birthdayService = {
  /**
   * Resolve user country / city / abbreviation to valid IANA timezone
   */
  resolveTimezone(input) {
    if (!input || typeof input !== 'string') return 'Asia/Kolkata';
    const raw = input.trim().toLowerCase();
    if (COMMON_TIMEZONES[raw]) return COMMON_TIMEZONES[raw];
    const noSpace = raw.replace(/[\s_-]+/g, '');
    if (COMMON_TIMEZONES[noSpace]) return COMMON_TIMEZONES[noSpace];

    // Check UTC / GMT offset e.g. +5:30, -5, UTC+5:30
    const offsetMatch = raw.match(/^(?:utc|gmt)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);
    if (offsetMatch) {
      const sign = offsetMatch[1];
      const hrs = parseInt(offsetMatch[2], 10);
      const mins = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0;
      if (sign === '+' && hrs === 5 && mins === 30) return 'Asia/Kolkata';
      if (sign === '+' && hrs === 5 && mins === 45) return 'Asia/Kathmandu';
      if (sign === '+' && hrs === 3 && mins === 30) return 'Asia/Tehran';

      const offsetMap = {
        '-10': 'Pacific/Honolulu', '-9': 'America/Anchorage', '-8': 'America/Los_Angeles',
        '-7': 'America/Denver', '-6': 'America/Chicago', '-5': 'America/New_York',
        '-4': 'America/Halifax', '-3': 'America/Sao_Paulo', '-2': 'America/Noronha',
        '-1': 'Atlantic/Cape_Verde', '+0': 'UTC', '+1': 'Europe/Paris',
        '+2': 'Europe/Athens', '+3': 'Europe/Moscow', '+4': 'Asia/Dubai',
        '+5': 'Asia/Karachi', '+6': 'Asia/Dhaka', '+7': 'Asia/Bangkok',
        '+8': 'Asia/Singapore', '+9': 'Asia/Tokyo', '+10': 'Australia/Sydney',
        '+11': 'Pacific/Guadalcanal', '+12': 'Pacific/Auckland'
      };
      const key = sign + hrs;
      if (offsetMap[key]) return offsetMap[key];
    }

    // Try direct IANA name
    try {
      Intl.DateTimeFormat(undefined, { timeZone: input.trim() });
      return input.trim();
    } catch (e) {}

    return 'Asia/Kolkata';
  },

  /**
   * Get user local date and time according to their country/timezone
   */
  getUserLocalTime(timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const res = {};
      for (const p of parts) res[p.type] = p.value;
      return {
        year: parseInt(res.year, 10),
        month: parseInt(res.month, 10),
        day: parseInt(res.day, 10),
        hour: parseInt(res.hour === '24' ? '0' : res.hour, 10),
        minute: parseInt(res.minute, 10)
      };
    } catch (e) {
      const d = new Date();
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes()
      };
    }
  },

  /**
   * Format timezone for user display
   */
  formatTimezoneDisplay(timeZone) {
    const tz = timeZone || 'Asia/Kolkata';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
      const formattedTime = formatter.format(new Date());
      return `\`${tz}\` (Local: ${formattedTime})`;
    } catch (e) {
      return `\`${tz}\``;
    }
  },
  /**
   * Parse user entered date string
   * Supported: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, DD/MM, Month Day
   */
  parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();

    // 1. Check YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      if (this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    // 2. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (supports 2-digit or 4-digit years & spaces)
    const dmyMatch = clean.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})(?:\s*[-/.]\s*(\d{2,4}))?$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      let year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : null;
      if (year && year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      if (this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    // 3. Check natural language dates like "24 Oct 2005" or "24 October" or "Oct 24 2005"
    const monthsMap = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    // Format: "24 Oct 2005" or "24 October"
    const naturalMatch1 = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?$/);
    if (naturalMatch1) {
      const day = parseInt(naturalMatch1[1], 10);
      const mStr = naturalMatch1[2].toLowerCase();
      const month = monthsMap[mStr];
      let year = naturalMatch1[3] ? parseInt(naturalMatch1[3], 10) : null;
      if (year && year < 100) year += year < 50 ? 2000 : 1900;
      if (month && this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    // Format: "Oct 24 2005" or "October 24"
    const naturalMatch2 = clean.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?$/);
    if (naturalMatch2) {
      const mStr = naturalMatch2[1].toLowerCase();
      const month = monthsMap[mStr];
      const day = parseInt(naturalMatch2[2], 10);
      let year = naturalMatch2[3] ? parseInt(naturalMatch2[3], 10) : null;
      if (year && year < 100) year += year < 50 ? 2000 : 1900;
      if (month && this.isValidDate(day, month, year)) {
        return { day, month, year };
      }
    }

    // 4. Relaxed regex fallback to extract date substring if embedded (e.g. "bday 24/10/2005")
    const embeddedMatch = clean.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})(?:\s*[-/.]\s*(\d{2,4}))?/);
    if (embeddedMatch) {
      const day = parseInt(embeddedMatch[1], 10);
      const month = parseInt(embeddedMatch[2], 10);
      let year = embeddedMatch[3] ? parseInt(embeddedMatch[3], 10) : null;
      if (year && year < 100) year += year < 50 ? 2000 : 1900;
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
   * Initialize cron job to check birthdays every 10 minutes
   */
  init(client) {
    // Run every 10 minutes to accurately catch 12:00 AM midnight across all world timezones
    cron.schedule('*/10 * * * *', async () => {
      await this.checkBirthdays(client);
    });
    // Initial check on bot ready
    setTimeout(() => {
      this.checkBirthdays(client).catch(() => {});
    }, 5000);
  },

  /**
   * Check birthdays for all active guilds respecting each user's local timezone
   */
  async checkBirthdays(client) {
    try {
      // Find guilds with birthdays module enabled
      const guilds = await Guild.find({
        'modules.birthdays': { $ne: false },
        'birthdays.enabled': { $ne: false }
      });

      for (const guildConfig of guilds) {
        const guild = client.guilds.cache.get(guildConfig.guildId);
        if (!guild) continue;

        const announcementChannelId = guildConfig.birthdays.wishChannelId || guildConfig.birthdays.channelId;
        const channel = announcementChannelId ? guild.channels.cache.get(announcementChannelId) : null;
        if (!channel || !channel.isTextBased()) continue;

        // Fetch all registered birthdays for this guild
        const allGuildBirthdays = await Birthday.find({ guildId: guild.id });

        for (const bday of allGuildBirthdays) {
          try {
            const tz = bday.timezone || 'Asia/Kolkata';
            const local = this.getUserLocalTime(tz);

            // Check if today is the user's birthday in their local country/timezone and not wished yet this year
            if (local.month === bday.month && local.day === bday.day && bday.lastWishedYear !== local.year) {
              const member = await guild.members.fetch(bday.userId).catch(() => null);
              if (!member) continue;

              // Optional age calculation
              let ageStr = '';
              if (bday.year) {
                const age = local.year - bday.year;
                ageStr = ` on turning **${age}**`;
              }

              const rawMsg = guildConfig.birthdays.message || '🎂 Happy Birthday {user}! Wishing you an awesome day! 🎉';
              const formattedMsg = rawMsg
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{username}/g, member.user.username);

              const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('🎉 Happy Birthday! 🎂')
                .setDescription(`${formattedMsg}${ageStr}\n\n🌍 *Celebrated right at 12:00 AM (${tz})*`)
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

              bday.lastWishedYear = local.year;
              await bday.save();
              logger.info(`Celebrated birthday for ${member.user.tag} in ${guild.name} at 12:00 AM (${tz})`);
            }
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
