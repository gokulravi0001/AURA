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
        .setDescription('Set your birthday (e.g., DD/MM/YYYY or DD/MM)')
        .addStringOption(opt => opt.setName('date').setDescription('Your birthday date (e.g. 24/10 or 15/05/2000)'))
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
        .setDescription('Configure birthday announcement channel and role (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Announcement channel for birthday wishes')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
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
      if (dateOption) {
        const parsed = birthdayService.parseDate(dateOption);
        if (!parsed) {
          return interaction.reply({
            content: '❌ Invalid date format. Please use `DD/MM/YYYY`, `DD-MM-YYYY`, or `DD/MM` (e.g. `24/10` or `15/05/2000`).',
            ephemeral: true
          });
        }

        await Birthday.findOneAndUpdate(
          { guildId: interaction.guild.id, userId: interaction.user.id },
          { day: parsed.day, month: parsed.month, year: parsed.year, lastWishedYear: 0 },
          { upsert: true }
        );

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;

        // Also attempt to send DM confirmation
        sendBirthdayConfirmationDM(interaction.user, interaction.guild, formatted);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🎂 Birthday Saved!')
              .setDescription(`Your birthday is set to **${formatted}**!\n🔒 *Your date was saved privately.*`)
          ],
          ephemeral: true
        });
      }

      // Open interactive modal
      const modal = new ModalBuilder()
        .setCustomId('modal_birthday_register')
        .setTitle('Register Your Birthday');

      const dateInput = new TextInputBuilder()
        .setCustomId('birthday_input')
        .setLabel('Your Birthday (DD/MM/YYYY or DD/MM)')
        .setPlaceholder('e.g. 24/10 or 15/05/2000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(dateInput));
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

      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');

      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.channelId': channel.id,
            'birthdays.roleId': role ? role.id : null
          }
        },
        { upsert: true }
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('⚙️ Birthday System Configured')
            .setDescription(`Wishes will be posted in <#${channel.id}>.${role ? ` Birthday role: <@&${role.id}>.` : ''}`)
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

    // +bday setup <#channel> [@role]
    if (action === 'setup') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();

      if (!channel) {
        return message.reply('❌ Usage: `+bday setup #channel [@role]`');
      }

      await Guild.updateOne(
        { guildId: message.guild.id },
        {
          $set: {
            'modules.birthdays': true,
            'birthdays.enabled': true,
            'birthdays.channelId': channel.id,
            'birthdays.roleId': role ? role.id : null
          }
        },
        { upsert: true }
      );

      return message.reply(`⚙️ Birthday system configured! Channel: <#${channel.id}>${role ? `, Role: <@&${role.id}>` : ''}.`);
    }

    // User provides birthday date directly: e.g. +bday 24/10 or +bday 24/10/2005
    const dateStr = args.join(' ');
    const parsed = birthdayService.parseDate(dateStr);

    if (!parsed) {
      return message.reply('ℹ️ Usage: `+bday <DD/MM>` or `+bday <DD/MM/YYYY>`\n*Subcommands: `+bday view`, `+bday list`, `+bday remove`*');
    }

    // 1. DELETE USER'S MESSAGE IMMEDIATELY (Privacy Protection)
    await message.delete().catch(() => {});

    // 2. SAVE IN MONGODB
    await Birthday.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      { day: parsed.day, month: parsed.month, year: parsed.year, lastWishedYear: 0 },
      { upsert: true }
    );

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${parsed.day} ${months[parsed.month - 1]}${parsed.year ? ` ${parsed.year}` : ''}`;

    // 3. SEND DIRECT MESSAGE TO MEMBER
    await sendBirthdayConfirmationDM(message.author, message.guild, formatted, message.channel);
  }
};

async function sendBirthdayConfirmationDM(user, guild, formattedDate, channel = null) {
  const dmEmbed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🎂 Birthday Successfully Saved!')
    .setDescription(`Hello **${user.username}**, your birthday has been saved for **${guild.name}**!\n\n📅 **Date:** \`${formattedDate}\`\n\n🔒 **Privacy:** *We automatically deleted your message in the server to protect your personal information. When your special day arrives, we will celebrate with you!* 🎉`)
    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
    .setTimestamp();

  try {
    await user.send({ embeds: [dmEmbed] });
  } catch (err) {
    // If user's DMs are disabled, send a self-deleting message in the channel
    if (channel) {
      const notice = await channel.send(`🎂 <@${user.id}>, your birthday was saved! *(Deleted your message to protect your privacy)*`);
      setTimeout(() => notice.delete().catch(() => {}), 6000);
    }
  }
}

function buildBirthdayCard(user, bday) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  let nextBday = new Date(Date.UTC(currentYear, bday.month - 1, bday.day));
  if (nextBday < now && (now.getUTCDate() !== bday.day || now.getUTCMonth() !== (bday.month - 1))) {
    nextBday = new Date(Date.UTC(currentYear + 1, bday.month - 1, bday.day));
  }

  const diffMs = nextBday.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isToday = diffDays === 0 || (now.getUTCDate() === bday.day && now.getUTCMonth() === (bday.month - 1));

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({ name: `${user.username}'s Birthday`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '📅 Date', value: `**${bday.day} ${months[bday.month - 1]}**${bday.year ? ` (${bday.year})` : ''}`, inline: true },
      { name: '⏳ Countdown', value: isToday ? '🎉 **IT IS TODAY! HAPPY BIRTHDAY!**' : `**${diffDays} days left**`, inline: true }
    )
    .setFooter({ text: 'AURA Birthday System' })
    .setTimestamp();
}

async function getUpcomingBirthdaysEmbed(guild) {
  const birthdays = await Birthday.find({ guildId: guild.id })
    .sort({ month: 1, day: 1 })
    .limit(15);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (!birthdays.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎂 Birthdays for ${guild.name}`)
      .setDescription('No birthdays registered yet! Use `/bday set` or `+bday DD/MM` to add yours.');
  }

  let list = '';
  for (const b of birthdays) {
    list += `🎉 **${b.day} ${months[b.month - 1]}** — <@${b.userId}>\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🎂 Upcoming Birthdays in ${guild.name}`)
    .setDescription(list)
    .setFooter({ text: 'Register with /bday set or view with /bday view' });
}
