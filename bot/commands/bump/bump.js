const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const bumpService = require('../../modules/bumpService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bump')
    .setDescription('View bump timer, register a bump, or configure bump reminders')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Check when the next bump is due')
    )
    .addSubcommand(sub =>
      sub.setName('done')
        .setDescription('Mark the server as bumped right now and start the reminder countdown')
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure bump reminder channel, role, and interval (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where bump reminders are sent')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption(opt => opt.setName('role').setDescription('Role to ping when a bump is due'))
        .addIntegerOption(opt => opt.setName('interval').setDescription('Reminder interval in minutes (default 120 for Disboard)'))
    ),
  name: 'bump',
  description: 'View or configure bump reminders',
  aliases: ['bumpstatus', 'bump-status'],
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

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const interval = interaction.options.getInteger('interval') || 120;

      guildDoc.modules.bump_reminder = true;
      guildDoc.bumpReminder.enabled = true;
      guildDoc.bumpReminder.channelId = channel.id;
      guildDoc.bumpReminder.reminderRoleId = role ? role.id : null;
      guildDoc.bumpReminder.intervalMinutes = interval;
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🚀 Bump Reminder Configured')
            .setDescription(`Reminders will be sent in <#${channel.id}> every **${interval} minutes**.\n${role ? `Ping Role: <@&${role.id}>` : 'Ping Role: @here'}`)
        ]
      });
    }

    // status
    return interaction.reply({ embeds: [buildBumpStatusEmbed(guildDoc)] });
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });

    if (action === 'done' || action === 'bypassed') {
      const next = await bumpService.registerBump(message.guild.id, message.channel.id);
      return message.reply(`🚀 Bump registered! Next reminder in **${guildDoc?.bumpReminder?.intervalMinutes || 120} minutes**.`);
    }

    if (action === 'setup') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      const interval = parseInt(args[2], 10) || 120;

      if (!channel) return message.reply('❌ Usage: `+bump setup #channel [@role] [interval]`');

      guildDoc.modules.bump_reminder = true;
      guildDoc.bumpReminder.enabled = true;
      guildDoc.bumpReminder.channelId = channel.id;
      guildDoc.bumpReminder.reminderRoleId = role ? role.id : null;
      guildDoc.bumpReminder.intervalMinutes = interval;
      await guildDoc.save();

      return message.reply(`🚀 Bump reminder configured for <#${channel.id}>!`);
    }

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
      { name: 'Channel', value: bump?.channelId ? `<#${bump.channelId}>` : 'Not set', inline: true },
      { name: 'Interval', value: `\`${bump?.intervalMinutes || 120} minutes\``, inline: true },
      { name: 'Next Reminder', value: statusText }
    )
    .setFooter({ text: 'AURA Bump Automation' });
}
