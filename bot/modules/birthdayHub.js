const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const Birthday = require('../../models/Birthday');
const Guild = require('../../models/Guild');
const birthdayService = require('./birthdayService');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const birthdayHub = {
  /**
   * Build the complete, minimal interactive Birthday Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const bdayConfig = guildDoc?.birthdays || {};
    const isEnabled = bdayConfig.enabled !== false;
    const wishChannel = bdayConfig.wishChannelId || bdayConfig.channelId;
    const wishText = wishChannel ? `<#${wishChannel}>` : '`Not configured` *(Admin setup)*';
    const setChannel = bdayConfig.setChannelId;
    const setChannelText = setChannel ? `<#${setChannel}> *(Auto-deleted for privacy)*` : '`Not configured`';
    const roleText = bdayConfig.roleId ? `<@&${bdayConfig.roleId}>` : '`No role assigned`';

    // Birthday statistics
    const totalCount = await Birthday.countDocuments({ guildId: guild.id }).catch(() => 0);

    // Caller's registered birthday
    const userBday = await Birthday.findOne({ guildId: guild.id, userId: user.id }).catch(() => null);
    let userSection = '';

    if (userBday) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const tz = userBday.timezone || 'Asia/Kolkata';
      const local = birthdayService.getUserLocalTime(tz);

      let nextYear = local.year;
      if (local.month > userBday.month || (local.month === userBday.month && local.day > userBday.day)) {
        nextYear += 1;
      }

      const now = new Date();
      const nextBdayUtc = new Date(Date.UTC(nextYear, userBday.month - 1, userBday.day));
      const diffMs = nextBdayUtc.getTime() - now.getTime();
      const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const isToday = local.month === userBday.month && local.day === userBday.day;

      const dateStr = `${userBday.day} ${months[userBday.month - 1]}${userBday.year ? ` ${userBday.year}` : ''}`;
      const countdownStr = isToday ? '🎉 **IT IS TODAY! HAPPY BIRTHDAY!**' : `⏳ **${diffDays} days left**`;

      userSection =
        `• **Registered Date:** \`${dateStr}\`\n` +
        `• **Status:** ${countdownStr}\n` +
        `• **Timezone:** \`${birthdayService.formatTimezoneDisplay(tz)}\``;
    } else {
      userSection = '*You have not registered your birthday yet!*\n*Click **[🎂 Register Birthday]** below to get celebrated at 12:00 AM!*';
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎂 Birthday System & Celebrations — ${guild.name}`)
      .setDescription(
        'Automatically celebrates member birthdays at **12:00 AM midnight** in their local timezone.\n' +
        'Use the interactive dropdown or quick action buttons below to manage your birthday!'
      )
      .addFields(
        {
          name: '⚙️ Server Birthday Setup',
          value:
            `• **System Status:** ${isEnabled ? '🟢 **Active** `[Celebrations ON]`' : '🔴 **Disabled** `[Celebrations Paused]`'}\n` +
            `• **Wish Channel:** ${wishText}\n` +
            `• **Input Channel:** ${setChannelText}\n` +
            `• **Celebrant Role:** ${roleText}\n` +
            `• **Community:** \`${totalCount} members registered\``
        },
        {
          name: `👤 Your Birthday (<@${user.id}>)`,
          value: userSection
        }
      )
      .setFooter({ text: 'AURA Birthday Suite • Wishes automatically at midnight' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You have permission to toggle celebrations, configure channels, assign birthday roles, or set member dates.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components.
   * Admin actions are strictly omitted if the caller is not an administrator.
   */
  buildHubComponents(isAdmin, guildDoc = null) {
    const isEnabled = guildDoc?.birthdays?.enabled !== false;
    const components = [];

    // Row 1: Interactive Dropdown Select Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_bday_register')
        .setLabel('Register Birthday')
        .setDescription('Save your birthday date and timezone privately')
        .setEmoji('🎂'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_bday_view')
        .setLabel('My Birthday Card')
        .setDescription('View your registered birthday and countdown')
        .setEmoji('👤'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_bday_upcoming')
        .setLabel('Upcoming Birthdays')
        .setDescription('View the next birthdays on this server')
        .setEmoji('📅'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_bday_remove')
        .setLabel('Remove Birthday')
        .setDescription('Delete your registered birthday from AURA')
        .setEmoji('🗑️')
    ];

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_bday_toggle')
          .setLabel(isEnabled ? 'Disable Birthday System' : 'Enable Birthday System')
          .setDescription(isEnabled ? 'Pause midnight celebrations' : 'Resume midnight celebrations')
          .setEmoji(isEnabled ? '🔴' : '🟢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_bday_wish_picker')
          .setLabel('Set Wish Announcement Channel')
          .setDescription('Channel where midnight celebrations are posted')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_bday_input_picker')
          .setLabel('Set Auto-Delete Input Channel')
          .setDescription('Channel where DD/MM/YYYY dates are auto-deleted')
          .setEmoji('📝')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_bday_action')
      .setPlaceholder('⚡ Select an action (Register, Upcoming, Setup)...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Member Quick Action Buttons
    const memberRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_bday_register')
        .setLabel('Register Birthday')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎂'),
      new ButtonBuilder()
        .setCustomId('btn_bday_upcoming')
        .setLabel('Upcoming')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📅'),
      new ButtonBuilder()
        .setCustomId('btn_bday_view')
        .setLabel('My Card')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('btn_bday_remove')
        .setLabel('Remove')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );
    components.push(memberRow);

    // Row 3: Admin Quick Action Buttons (STRICTLY ADMIN ONLY)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_bday_setup_wish')
          .setLabel('Wish Channel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('btn_bday_setup_input')
          .setLabel('Input Channel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('btn_bday_toggle')
          .setLabel(isEnabled ? 'Disable' : 'Enable')
          .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(isEnabled ? '🔴' : '🟢')
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

    if (customId === 'btn_bday_register') {
      return await this.showRegisterModal(interaction);
    }

    if (customId === 'btn_bday_upcoming') {
      const embed = await this.getUpcomingEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'btn_bday_view') {
      const bday = await Birthday.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      if (!bday) {
        return interaction.reply({
          content: '❌ You have not registered your birthday. Click **[🎂 Register Birthday]** to add it!',
          ephemeral: true
        });
      }
      const embed = this.buildBirthdayCard(interaction.user, bday);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'btn_bday_remove') {
      await Birthday.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      return interaction.reply({ content: '🗑️ Your registered birthday has been removed.', ephemeral: true });
    }

    // Admin-only buttons
    if (customId === 'btn_bday_toggle') {
      if (!isAdmin) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const doc = await Guild.findOne({ guildId: interaction.guild.id });
      const current = doc?.birthdays?.enabled !== false;
      const next = !current;
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        { $set: { 'birthdays.enabled': next, 'modules.birthdays': next } },
        { upsert: true }
      );
      const updatedDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, updatedDoc, interaction.user, true);
      const components = this.buildHubComponents(true, updatedDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'btn_bday_setup_wish') {
      if (!isAdmin) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_bday_channel_wish')
        .setPlaceholder('📢 Select the Birthday Wish Announcement Channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📢 **Select the channel where celebratory birthday wishes should post:**',
        components: [row],
        ephemeral: true
      });
    }

    if (customId === 'btn_bday_setup_input') {
      if (!isAdmin) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_bday_channel_input')
        .setPlaceholder('📝 Select the Auto-Delete Input Channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📝 **Select the channel where members type their birthday in `DD/MM/YYYY` (messages auto-delete for privacy):**',
        components: [row],
        ephemeral: true
      });
    }
  },

  /**
   * Handle dropdown select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (selected === 'act_bday_register') {
      return await this.showRegisterModal(interaction);
    }

    if (selected === 'act_bday_view') {
      const bday = await Birthday.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      if (!bday) {
        return interaction.reply({
          content: '❌ You have not registered your birthday. Click **[🎂 Register Birthday]** to add it!',
          ephemeral: true
        });
      }
      const embed = this.buildBirthdayCard(interaction.user, bday);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (selected === 'act_bday_upcoming') {
      const embed = await this.getUpcomingEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (selected === 'act_bday_remove') {
      await Birthday.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      return interaction.reply({ content: '🗑️ Your registered birthday has been removed.', ephemeral: true });
    }

    // Admin options
    if (selected === 'act_bday_toggle') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const doc = await Guild.findOne({ guildId: interaction.guild.id });
      const current = doc?.birthdays?.enabled !== false;
      const next = !current;
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        { $set: { 'birthdays.enabled': next, 'modules.birthdays': next } },
        { upsert: true }
      );
      const updatedDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, updatedDoc, interaction.user, true);
      const components = this.buildHubComponents(true, updatedDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (selected === 'act_bday_wish_picker') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_bday_channel_wish')
        .setPlaceholder('📢 Select the Birthday Wish Announcement Channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📢 **Select the channel where celebratory birthday wishes should post:**',
        components: [row],
        ephemeral: true
      });
    }

    if (selected === 'act_bday_input_picker') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_bday_channel_input')
        .setPlaceholder('📝 Select the Auto-Delete Input Channel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📝 **Select the channel where members type their birthday in `DD/MM/YYYY` (messages auto-delete for privacy):**',
        components: [row],
        ephemeral: true
      });
    }
  },

  /**
   * Handle channel select menus for birthday configuration
   */
  async handleChannelSelect(interaction, client) {
    if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const channelId = interaction.values[0];

    if (interaction.customId === 'select_bday_channel_wish') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.wishChannelId': channelId,
            'birthdays.channelId': channelId
          }
        },
        { upsert: true }
      );
      return interaction.reply({
        content: `🎉 Birthday celebration wishes will now be posted in <#${channelId}>!`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'select_bday_channel_input') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.setChannelId': channelId
          }
        },
        { upsert: true }
      );

      const targetChannel = interaction.guild.channels.cache.get(channelId);
      if (targetChannel && typeof targetChannel.send === 'function') {
        const guideEmbed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle('🎂 Birthday Registration Channel')
          .setDescription(
            'Type your birthday in this channel using **DD/MM/YYYY** format (e.g. `24/10/2005` or `24/10`)!\n\n' +
            '🔒 **Privacy Protection:** *Your message will be automatically deleted immediately so nobody sees your date.*\n' +
            '📩 You will receive a direct message confirmation from AURA.'
          )
          .setFooter({ text: 'AURA Birthday System' });
        await targetChannel.send({ embeds: [guideEmbed] }).catch(() => {});
      }

      return interaction.reply({
        content: `📝 Birthday input channel set to <#${channelId}>! Members can type their birthday in \`DD/MM/YYYY\` and messages will be auto-deleted & saved privately.`,
        ephemeral: true
      });
    }
  },

  /**
   * Show birthday registration modal
   */
  async showRegisterModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_birthday_register')
      .setTitle('Register Your Birthday');

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
  },

  /**
   * Helper to build user birthday card
   */
  buildBirthdayCard(user, bday) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const tz = bday.timezone || 'Asia/Kolkata';
    const local = birthdayService.getUserLocalTime(tz);

    let nextYear = local.year;
    if (local.month > bday.month || (local.month === bday.month && local.day > bday.day)) {
      nextYear += 1;
    }

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
  },

  /**
   * Helper to get upcoming birthdays embed
   */
  async getUpcomingEmbed(guild) {
    const birthdays = await Birthday.find({ guildId: guild.id })
      .sort({ month: 1, day: 1 })
      .limit(20);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (!birthdays.length) {
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🎂 Birthdays for ${guild.name}`)
        .setDescription('No birthdays registered yet! Click **[🎂 Register Birthday]** to add yours.');
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
      .setFooter({ text: 'AURA Birthday Suite • Celebrates at 12:00 AM midnight' });
  }
};

module.exports = birthdayHub;
