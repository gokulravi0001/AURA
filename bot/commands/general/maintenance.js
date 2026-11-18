const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const maintenanceService = require('../../../shared/maintenanceService');
const auditService = require('../../../shared/auditService');
const { isBotOwner } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: null,
  name: 'maintenance',
  description: 'Manage AURA system maintenance mode',
  aliases: ['maint'],
  module: null,

  async execute(interaction, client) {
    if (!isBotOwner(interaction.user.id, client)) {
      return interaction.reply({
        content: '🚫 Access denied. This command is restricted to **AURA Bot Developers**.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const operator = `${interaction.user.username} (${interaction.user.id})`;

    if (sub === 'status') {
      const status = maintenanceService.getStatus();
      const embed = new EmbedBuilder()
        .setColor(status.enabled ? COLORS.SECONDARY : COLORS.SUCCESS)
        .setTitle('🔧 Maintenance Mode Status')
        .addFields(
          { name: 'Status', value: status.enabled ? '🔴 **ACTIVE (Commands Paused)**' : '🟢 **INACTIVE (Normal Operations)**', inline: true },
          { name: 'Last Updated By', value: status.updatedBy ? `\`${status.updatedBy}\`` : 'None', inline: true },
          { name: 'Active Message', value: status.message || 'Default' }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'on') {
      const msg = interaction.options.getString('message');
      const result = await maintenanceService.enableMaintenance({ message: msg, updatedBy: operator });

      await auditService.recordAction({
        action: 'MAINTENANCE_ENABLED',
        executorId: interaction.user.id,
        executorName: interaction.user.username,
        details: { message: result.message }
      });

      return interaction.reply({
        content: `🔧 **Maintenance Mode has been ENABLED.** Regular member commands are paused.\nActive message: *${result.message}*`,
        ephemeral: true
      });
    }

    if (sub === 'off') {
      await maintenanceService.disableMaintenance({ updatedBy: operator });

      await auditService.recordAction({
        action: 'MAINTENANCE_DISABLED',
        executorId: interaction.user.id,
        executorName: interaction.user.username
      });

      return interaction.reply({
        content: '🟢 **Maintenance Mode has been DISABLED.** All bot commands and features are now fully restored.',
        ephemeral: true
      });
    }
  },

  async executePrefix(message, args, client) {
    if (!isBotOwner(message.author.id, client)) {
      return message.reply('🚫 Access denied. This command is restricted to **AURA Bot Developers**.');
    }

    const action = args[0]?.toLowerCase();
    const operator = `${message.author.username} (${message.author.id})`;

    if (action === 'on') {
      const customMsg = args.slice(1).join(' ');
      const result = await maintenanceService.enableMaintenance({ message: customMsg || null, updatedBy: operator });
      return message.reply(`🔧 **Maintenance mode ENABLED.**\n*${result.message}*`);
    }

    if (action === 'off') {
      await maintenanceService.disableMaintenance({ updatedBy: operator });
      return message.reply('🟢 **Maintenance mode DISABLED.** Normal operations resumed.');
    }

    const status = maintenanceService.getStatus();
    return message.reply(`🔧 Maintenance mode is currently **${status.enabled ? 'ACTIVE 🔴' : 'INACTIVE 🟢'}**.`);
  }
};
