const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const Birthday = require('../../../models/Birthday');
const Guild = require('../../../models/Guild');
const birthdayService = require('../../modules/birthdayService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bday')
    .setDescription('Register, view, list, or configure birthdays')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Save your birthday or another member\'s birthday with country/timezone')
        .addStringOption(opt => opt.setName('date').setDescription('Birthday date (e.g. 24/10 or 15/05/2000)').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Target member to save birthday for (leave empty for yourself)'))
        .addStringOption(opt => opt.setName('timezone').setDescription('Country or Timezone (e.g. India, USA, UK, IST, EST, UTC+5:30)'))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your or another member\'s registered birthday and countdown')
        .addUserOption(opt => opt.setName('user').setDescription('Target member (leave empty to view your own)'))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List upcoming birthdays on this server')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove your registered birthday')
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure birthday wish channel and registration channel (Admin only)')
        .addChannelOption(opt =>
          opt.setName('wish_channel')
            .setDescription('Channel where birthday wishes and celebrant pings are posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('set_channel')
            .setDescription('Channel where members type their birthday in DD/MM/YYYY (auto-deleted & saved)')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(opt => opt.setName('role').setDescription('Special role to give on member birthdays'))
    ),
  name: 'bday',
  description: 'Register, view, or configure birthdays',
  aliases: ['birthday', 'bd'],
  module: 'birthdays',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();

    // 1. SET
    if (sub === 'set') {
      const dateOption = interaction.options.getString('date');
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const isForOther = targetUser.id !== interaction.user.id;
      const tzOption = interaction.options.getString('timezone');
      const timezone = birthdayService.resolveTimezone(tzOption);

      if (dateOption) {
        const parsed = birthdayService.parseDate(dateOption);
        if (!parsed) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use `DD/MM/YYYY`, `DD-MM-YYYY`, or `DD/MM` (e.g. `24/10` or `15/05/2000`).',
            ephemeral: true
          });
        }

        await Birthday.findOneAndUpdate(
          { guildId: interaction.guild.id, userId: targetUser.id },
          {
            day: parsed.day,
            month: parsed.month,
            year: parsed.year,
            timezone,
            setBy: interaction.user.id,
            lastWishedYear: 0
          },
          { upsert: true }
        );

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;
        const tzDisplay = birthdayService.formatTimezoneDisplay(timezone);

        // Also attempt to send DM confirmation
        sendBirthdayConfirmationDM(targetUser, interaction.guild, formatted, timezone, interaction.user);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle(isForOther ? `🎂 Birthday Saved for ${targetUser.username}!` : '🎂 Birthday Saved!')
              .setDescription(
                `${isForOther ? `Saved <@${targetUser.id}>'s birthday` : 'Your birthday is set'} to **${formatted}**!\n` +
                `🌍 **Timezone:** ${tzDisplay}\n` +
                `⏰ AURA will celebrate their birthday at **12:00 AM midnight** in their country!\n` +
                `🔒 *Saved privately.*`
              )
          ],
          ephemeral: true
        });
      }

      // Open interactive modal
      const modal = new ModalBuilder()
        .setCustomId('modal_birthday_register')
        .setTitle('Register Birthday');

      const dateInput = new TextInputBuilder()
        .setCustomId('birthday_input')
        .setLabel('Birthday Date (DD/MM/YYYY or DD/MM)')
        .setPlaceholder('e.g. 24/10 or 15/05/2000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      const tzInput = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel('Country or Timezone (Optional)')
        .setPlaceholder('e.g. India, USA, UK, IST, EST')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(30);

      modal.addComponents(
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(tzInput)
      );
      return await interaction.showModal(modal);
    }

    // 2. VIEW
    if (sub === 'view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const bday = await Birthday.findOne({ guildId: interaction.guild.id, userId: targetUser.id });

      if (!bday) {
        return interaction.reply({
          content: targetUser.id === interaction.user.id
            ? '❌ You have not registered your birthday yet. Use `/bday set` to register!'
            : `❌ <@${targetUser.id}> has not registered their birthday yet.`,
          ephemeral: true
        });
      }

      const embed = buildBirthdayCard(targetUser, bday);
      return interaction.reply({ embeds: [embed] });
    }

    // 3. LIST
    if (sub === 'list') {
      const embed = await getUpcomingBirthdaysEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed] });
    }

    // 4. REMOVE
    if (sub === 'remove') {
      await Birthday.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      return interaction.reply({ content: '🗑️ Your birthday has been removed from this server.', ephemeral: true });
    }

    // 5. SETUP (Admin only)
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const wishChannel = interaction.options.getChannel('wish_channel') || interaction.options.getChannel('channel');
      const setChannel = interaction.options.getChannel('set_channel');
      const role = interaction.options.getRole('role');

      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.wishChannelId': wishChannel.id,
            'birthdays.setChannelId': setChannel ? setChannel.id : null,
            'birthdays.channelId': wishChannel.id, // fallback
            'birthdays.roleId': role ? role.id : null
          }
        },
        { upsert: true }
      );

      // Post instructional banner in setChannel if designated
      if (setChannel) {
        const guideEmbed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle('🎂 Birthday Registration Channel')
          .setDescription(
            'Type your birthday in this channel using **DD/MM/YYYY** format (e.g. `24/10/2005` or `24/10`)!\n\n' +
            '🔒 **Privacy Protection:** *Your message will be automatically deleted immediately so nobody sees your date.*\n' +
            '📩 You will receive a direct message confirmation from AURA.\n' +
            `🎉 When your birthday arrives, we will celebrate with you in <#${wishChannel.id}>!`
          )
          .setFooter({ text: 'AURA Birthday System' });
        await setChannel.send({ embeds: [guideEmbed] }).catch(() => {});
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('⚙️ Birthday System Configured')
            .setDescription(
              `🎉 **Wish Channel:** <#${wishChannel.id}>\n` +
              `📝 **Member Input Channel:** ${setChannel ? `<#${setChannel.id}> *(auto-deletes messages & DMs confirmation)*` : '*Not set (use `/bday set` or configure input channel)*'}\n` +
              `${role ? `⭐ **Birthday Role:** <@&${role.id}>\n` : ''}`
            )
        ]
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();

    // +bday view [@user]
    if (action === 'view') {
      const targetUser = message.mentions.users.first() || message.author;
      const bday = await Birthday.findOne({ guildId: message.guild.id, userId: targetUser.id });

      if (!bday) {
        return message.reply(targetUser.id === message.author.id
          ? '❌ You have not registered your birthday. Type `+bday DD/MM` to set it!'
          : `❌ <@${targetUser.id}> has not registered their birthday.`);
      }

      const embed = buildBirthdayCard(targetUser, bday);
      return message.reply({ embeds: [embed] });
    }

    // +bday list
    if (action === 'list') {
      const embed = await getUpcomingBirthdaysEmbed(message.guild);
      return message.reply({ embeds: [embed] });
    }

    // +bday remove
    if (action === 'remove') {
      await Birthday.deleteOne({ guildId: message.guild.id, userId: message.author.id });
      return message.reply('🗑️ Your birthday has been removed.');
    }

    // +bday setchannel <#channel>
    if (action === 'setchannel') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }
      const setCh = message.mentions.channels.first();
      if (!setCh) return message.reply('❌ Usage: `+bday setchannel #channel`');

      await Guild.updateOne(
        { guildId: message.guild.id },
        { $set: { 'modules.birthdays': true, 'birthdays.enabled': true, 'birthdays.setChannelId': setCh.id } },
        { upsert: true }
      );

      const guideEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎂 Birthday Registration Channel')
        .setDescription(
          'Type your birthday in this channel using **DD/MM/YYYY** format (e.g. `24/10/2005` or `24/10`)!\n\n' +
          '🔒 **Privacy Protection:** *Your message will be automatically deleted immediately so nobody sees your date.*\n' +
          '📩 You will receive a direct message confirmation from AURA.'
        )
        .setFooter({ text: 'AURA Birthday System' });
      await setCh.send({ embeds: [guideEmbed] }).catch(() => {});

      return message.reply(`📝 Birthday input channel set to <#${setCh.id}>! Members can type their birthday in \`DD/MM/YYYY\` format and messages will be auto-deleted & saved.`);
    }

    // +bday wishchannel <#channel>
    if (action === 'wishchannel') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }
      const wishCh = message.mentions.channels.first();
      if (!wishCh) return message.reply('❌ Usage: `+bday wishchannel #channel`');

      await Guild.updateOne(
        { guildId: message.guild.id },
        { $set: { 'modules.birthdays': true, 'birthdays.enabled': true, 'birthdays.wishChannelId': wishCh.id, 'birthdays.channelId': wishCh.id } },
        { upsert: true }
      );
      return message.reply(`🎉 Birthday wish announcement channel set to <#${wishCh.id}>!`);
    }

    // +bday setup <#wish-channel> [#set-channel] [@role]
    if (action === 'setup') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const channels = message.mentions.channels;
      const wishChannel = channels.first();
      const setChannel = channels.size > 1 ? [...channels.values()][1] : null;
      const role = message.mentions.roles.first();

      if (!wishChannel) {
        return message.reply('❌ Usage: `+bday setup #wish-channel [#set-channel] [@role]`');
      }

      await Guild.updateOne(
        { guildId: message.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.wishChannelId': wishChannel.id,
            'birthdays.channelId': wishChannel.id,
            'birthdays.setChannelId': setChannel ? setChannel.id : null,
            'birthdays.roleId': role ? role.id : null
          }
        },
        { upsert: true }
      );

      if (setChannel) {
        const guideEmbed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle('🎂 Birthday Registration Channel')
          .setDescription(
            'Type your birthday in this channel using **DD/MM/YYYY** format (e.g. `24/10/2005` or `24/10`)!\n\n' +
            '🔒 **Privacy Protection:** *Your message will be automatically deleted immediately so nobody sees your date.*\n' +
            '📩 You will receive a direct message confirmation from AURA.\n' +
            `🎉 When your birthday arrives, we will celebrate with you in <#${wishChannel.id}>!`
          )
          .setFooter({ text: 'AURA Birthday System' });
        await setChannel.send({ embeds: [guideEmbed] }).catch(() => {});
      }

      return message.reply(
        `⚙️ Birthday system configured!\n` +
        `🎉 Wish Channel: <#${wishChannel.id}>\n` +
        `${setChannel ? `📝 Input Channel: <#${setChannel.id}>\n` : ''}` +
        `${role ? `⭐ Role: <@&${role.id}>` : ''}`
      );
    }

    // User provides birthday date directly or with set: e.g. +bday 24/10 or +bday set 24/10/2005 @friend India
    let effectiveArgs = action === 'set' ? args.slice(1) : args;
    const targetUser = message.mentions.users.first() || message.author;
    const isForOther = targetUser.id !== message.author.id;

    // Filter out user mention tokens to extract date and timezone
    const textWithoutMentions = effectiveArgs.filter(a => !a.startsWith('<@') && !a.startsWith('@')).join(' ').trim();
    const parsed = birthdayService.parseDate(textWithoutMentions);

    if (!parsed) {
      return message.reply('ℹ️ Usage:\n• `+bday <DD/MM/YYYY> [@user] [Country/Timezone]`\n• `+bday set <DD/MM/YYYY> [@user] [Country/Timezone]`\n• `+bday view [@user]`, `+bday list`, `+bday remove`\n*Example:* `+bday 24/10/2005 @friend India` or `+bday 15/05 USA`');
    }

    // Extract timezone from remaining text after removing date
    const dateSubstringMatch = textWithoutMentions.match(/(\d{1,2}\s*[-/.]\s*\d{1,2}(?:\s*[-/.]\s*\d{2,4})?)/);
    let remainingTzText = textWithoutMentions;
    if (dateSubstringMatch) {
      remainingTzText = textWithoutMentions.replace(dateSubstringMatch[0], '').trim();
    }
    const timezone = birthdayService.resolveTimezone(remainingTzText);

    // 1. DELETE USER'S MESSAGE IMMEDIATELY (Privacy Protection)
    await message.delete().catch(() => {});

    // 2. SAVE IN MONGODB
    await Birthday.findOneAndUpdate(
      { guildId: message.guild.id, userId: targetUser.id },
      {
        day: parsed.day,
        month: parsed.month,
        year: parsed.year,
        timezone,
        setBy: message.author.id,
        lastWishedYear: 0
      },
      { upsert: true }
    );

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;
    const tzDisplay = birthdayService.formatTimezoneDisplay(timezone);

    // 3. SEND DIRECT MESSAGE TO TARGET AND AUTHOR
    await sendBirthdayConfirmationDM(targetUser, message.guild, formatted, timezone, message.author, message.channel);

    // Optional temporary notice in channel
    const notice = await message.channel.send(
      `🎂 ${isForOther ? `Saved birthday for <@${targetUser.id}>` : `<@${message.author.id}>, your birthday was saved`} as **${formatted}**!\n🌍 **Timezone:** ${tzDisplay}\n⏰ *AURA will celebrate them right at 12:00 AM midnight in their country!* *(Message auto-deleted for privacy)*`
    ).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);
  }
};

async function sendBirthdayConfirmationDM(user, guild, formattedDate, timezone = 'Asia/Kolkata', author = null, channel = null) {
  const isForOther = author && author.id !== user.id;

  const dmEmbed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🎂 Birthday Successfully Saved!')
    .setDescription(
      isForOther
        ? `Hello **${user.username}**! <@${author.id}> has registered your birthday in **${guild.name}**!\n\n📅 **Date:** \`${formattedDate}\`\n🌍 **Country/Timezone:** \`${timezone}\`\n\n🎉 *When your special day arrives, AURA will celebrate with you at 12:00 AM midnight in your timezone!*`
        : `Hello **${user.username}**, your birthday has been saved for **${guild.name}**!\n\n📅 **Date:** \`${formattedDate}\`\n🌍 **Country/Timezone:** \`${timezone}\`\n\n🔒 **Privacy:** *We automatically deleted your message in the server to protect your personal information. When your special day arrives, we will celebrate with you right at 12:00 AM midnight!* 🎉`
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  try {
    await user.send({ embeds: [dmEmbed] });
  } catch (err) {
    // Non-critical if user's DMs are closed
  }

  // If saved for another member, also DM the author confirming it
  if (isForOther && author) {
    const authorEmbed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('🎂 Friend\'s Birthday Saved!')
      .setDescription(`You successfully saved **${user.username}**'s birthday in **${guild.name}**!\n\n📅 **Date:** \`${formattedDate}\`\n🌍 **Timezone:** \`${timezone}\`\n⏰ *AURA will wish them right at 12:00 AM midnight in their local time!*`)
      .setFooter({ text: guild.name })
      .setTimestamp();
    try {
      await author.send({ embeds: [authorEmbed] });
    } catch (_) {}
  }
}

function buildBirthdayCard(user, bday) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const tz = bday.timezone || 'Asia/Kolkata';
  const local = birthdayService.getUserLocalTime(tz);

  let nextYear = local.year;
  if (local.month > bday.month || (local.month === bday.month && local.day > bday.day)) {
    nextYear += 1;
  }

  // Calculate days left using user's local timezone
  const now = new Date();
  const nextBdayUtc = new Date(Date.UTC(nextYear, bday.month - 1, bday.day));
  const diffMs = nextBdayUtc.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isToday = local.month === bday.month && local.day === bday.day;

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({ name: `${user.username}'s Birthday`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '📅 Date', value: `**${bday.day} ${months[bday.month - 1]}**${bday.year ? ` (${bday.year})` : ''}`, inline: true },
      { name: '⏳ Countdown', value: isToday ? '🎉 **IT IS TODAY! HAPPY BIRTHDAY!**' : `**${diffDays} days left**`, inline: true },
      { name: '🌍 Timezone / Country', value: birthdayService.formatTimezoneDisplay(tz), inline: false }
    )
    .setFooter({ text: 'AURA Birthday System • Wishes at 12:00 AM local time' })
    .setTimestamp();

  if (bday.setBy && bday.setBy !== user.id) {
    embed.addFields({ name: '👤 Registered By', value: `<@${bday.setBy}>`, inline: true });
  }

  return embed;
}

async function getUpcomingBirthdaysEmbed(guild) {
  const birthdays = await Birthday.find({ guildId: guild.id })
    .sort({ month: 1, day: 1 })
    .limit(20);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (!birthdays.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎂 Birthdays for ${guild.name}`)
      .setDescription('No birthdays registered yet! Use `/bday set` or `+bday DD/MM` to add yours.');
  }

  let list = '';
  for (const b of birthdays) {
    const tz = b.timezone || 'Asia/Kolkata';
    list += `🎉 **${b.day} ${months[b.month - 1]}** — <@${b.userId}> • \`${tz}\`\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🎂 Upcoming Birthdays in ${guild.name}`)
    .setDescription(list)
    .setFooter({ text: 'Register with /bday set [user] [timezone] • Wishes at 12:00 AM' });
}
