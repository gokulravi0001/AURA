const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} = require('discord.js');
const Birthday = require('../../../models/Birthday');
const birthdayService = require('../../modules/birthdayService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Register, view, or manage birthdays')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set your birthday (e.g., DD/MM/YYYY or DD/MM)')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List upcoming birthdays on this server')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove your registered birthday')
    ),
  name: 'birthday',
  description: 'Register or view birthdays',
  aliases: ['bday'],
  module: 'birthdays',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
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
    } else if (sub === 'list') {
      const embed = await getUpcomingBirthdaysEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
      await Birthday.deleteOne({ guildId: interaction.guild.id, userId: interaction.user.id });
      return interaction.reply({ content: '🗑️ Your birthday has been removed from this server.', ephemeral: true });
    }
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();

    if (action === 'list') {
      const embed = await getUpcomingBirthdaysEmbed(message.guild);
      return message.reply({ embeds: [embed] });
    } else if (action === 'remove') {
      await Birthday.deleteOne({ guildId: message.guild.id, userId: message.author.id });
      return message.reply('🗑️ Your birthday has been removed.');
    }

    const dateStr = args.join(' ');
    const parsed = birthdayService.parseDate(dateStr);
    if (!parsed) {
      return message.reply('❌ Please enter a valid date. Usage: `+birthday <DD/MM/YYYY>` or `+birthday <DD/MM>`');
    }

    await Birthday.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      { day: parsed.day, month: parsed.month, year: parsed.year, lastWishedYear: 0 },
      { upsert: true }
    );

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return message.reply(`🎂 Your birthday has been set to **${parsed.day} ${months[parsed.month - 1]}**!`);
  }
};

async function getUpcomingBirthdaysEmbed(guild) {
  const birthdays = await Birthday.find({ guildId: guild.id })
    .sort({ month: 1, day: 1 })
    .limit(15);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (!birthdays.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎂 Birthdays for ${guild.name}`)
      .setDescription('No birthdays registered yet! Use `/birthday set` or `+birthday DD/MM` to add yours.');
  }

  let list = '';
  for (const b of birthdays) {
    list += `🎉 **${b.day} ${months[b.month - 1]}** — <@${b.userId}>\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🎂 Upcoming Birthdays in ${guild.name}`)
    .setDescription(list)
    .setFooter({ text: 'Register your birthday using /birthday set' });
}
