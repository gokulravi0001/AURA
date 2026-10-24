const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const UserXP = require('../../../models/UserXP');
const levelingService = require('../../modules/levelingService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Add XP to a server member (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('user').setDescription('The target user').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of XP to add').setRequired(true)),
  name: 'addxp',
  description: 'Add XP to a member',
  permissions: [PermissionFlagsBits.Administrator],
  module: 'leveling',

  async execute(interaction, client) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (amount <= 0) {
      return interaction.reply({ content: '❌ Amount must be greater than 0.', ephemeral: true });
    }

    const result = await giveXp(interaction.guild.id, target.id, amount);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✨ XP Granted')
          .setDescription(`Awarded **${amount.toLocaleString()} XP** to <@${target.id}>.\nNew Level: **${result.level}** (XP: **${result.xp}**)`)
      ]
    });
  },

  async executePrefix(message, args, client) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1], 10);

    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply('❌ Usage: `+addxp @user <amount>`');
    }

    const result = await giveXp(message.guild.id, target.id, amount);
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✨ XP Granted')
          .setDescription(`Awarded **${amount.toLocaleString()} XP** to <@${target.id}>.\nNew Level: **${result.level}** (XP: **${result.xp}**)`)
      ]
    });
  }
};

async function giveXp(guildId, userId, amount) {
  let doc = await UserXP.findOne({ guildId, userId });
  if (!doc) {
    doc = new UserXP({ guildId, userId, xp: 0, level: 0 });
  }

  doc.xp += amount;
  let nextXp = levelingService.getXpForLevel(doc.level);
  while (doc.xp >= nextXp) {
    doc.xp -= nextXp;
    doc.level += 1;
    nextXp = levelingService.getXpForLevel(doc.level);
  }

  await doc.save();
  return doc;
}
