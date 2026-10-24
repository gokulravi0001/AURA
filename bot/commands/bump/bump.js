const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const bumpService = require('../../modules/bumpService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bump')
    .setDescription('View bump timer status or register a completed bump')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check when the next bump is due')
    )
    .addSubcommand(sub =>
      sub.setName('done')
        .setDescription('Mark the server as bumped right now and start the reminder countdown')
    ),
  name: 'bump',
  description: 'View bump reminder status',
  aliases: ['bumpstatus'],
  module: 'bump_reminder',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });

    if (sub === 'done') {
      const next = await bumpService.registerBump(interaction.guild.id, interaction.channel.id);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🚀 Bump Registered!')
            .setDescription(`Next reminder scheduled at <t:${Math.floor(next.getTime() / 1000)}:R>.`)
        ]
      });
    }

    // status
    return interaction.reply({ embeds: [buildBumpStatusEmbed(guildDoc)] });
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();

    if (action === 'done' || action === 'bypassed') {
      const next = await bumpService.registerBump(message.guild.id, message.channel.id);
      return message.reply(`🚀 Bump registered! Next reminder in **${guildDoc?.bumpReminder?.intervalMinutes || 120} minutes**.`);
    }

    const guildDoc = await Guild.findOne({ guildId: message.guild.id });
    return message.reply({ embeds: [buildBumpStatusEmbed(guildDoc)] });
  }
};

function buildBumpStatusEmbed(guildDoc) {
  const bump = guildDoc?.bumpReminder;
  const isEnabled = bump?.enabled;
  const nextTime = bump?.nextBumpTime;

  let statusText = 'Not configured or disabled.';
  if (isEnabled) {
    if (nextTime && nextTime > new Date()) {
      statusText = `Next bump due <t:${Math.floor(new Date(nextTime).getTime() / 1000)}:R>`;
    } else {
      statusText = '🔥 **Ready to bump now!** Run `/bump` on Disboard!';
    }
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🚀 Bump Reminder Status')
    .addFields(
      { name: 'Status', value: isEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Interval', value: `\`${bump?.intervalMinutes || 120} minutes\``, inline: true },
      { name: 'Next Reminder', value: statusText }
    )
    .setFooter({ text: 'AURA Bump Automation' });
}
