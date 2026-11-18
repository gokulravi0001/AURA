const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDatabaseHealth } = require('../../../shared/database');
const maintenanceService = require('../../../shared/maintenanceService');
const blacklistService = require('../../../shared/blacklistService');
const auditService = require('../../../shared/auditService');
const { isBotOwner } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('system')
    .setDescription('View live bot status, WebSocket ping, uptime, and database health'),
  name: 'system',
  description: 'View live bot status, WebSocket ping, uptime, and database health',
  aliases: ['sys', 'status', 'diag', 'ping', 'stats'],
  module: null,

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand(false);

    // 1. STATUS / PING (Default)
    if (!sub || sub === 'status') {
      const dbHealth = await getDatabaseHealth();
      const mem = process.memoryUsage();
      const uptime = process.uptime();
      const isMaint = maintenanceService.isMaintenanceActive();

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('⚡ AURA System Status & Diagnostics')
        .addFields(
          { name: 'Bot Latency', value: `WebSocket: \`${client.ws.ping}ms\``, inline: true },
          { name: 'Database Latency', value: `MongoDB: \`${dbHealth.latencyMs || 0}ms\` (${dbHealth.status})`, inline: true },
          { name: 'Maintenance Mode', value: isMaint ? '🔴 **Active**' : '🟢 **Inactive**', inline: true },
          { name: 'Connected Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
          { name: 'Cached Users', value: `\`${client.users.cache.size}\``, inline: true },
          { name: 'Memory Heap', value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\``, inline: true },
          { name: 'Uptime', value: `\`${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s\``, inline: false }
        )
        .setFooter({ text: 'AURA Core Diagnostics' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. MAINTENANCE
    if (sub === 'maintenance') {
      if (!isBotOwner(interaction.user.id, client)) {
        return interaction.reply({ content: '🚫 Developer permission required.', ephemeral: true });
      }

      const action = interaction.options.getString('action');
      const operator = `${interaction.user.username} (${interaction.user.id})`;

      if (action === 'status') {
        const status = maintenanceService.getStatus();
        return interaction.reply({
          content: `🔧 Maintenance mode is currently **${status.enabled ? 'ACTIVE 🔴' : 'INACTIVE 🟢'}**.\nMessage: *${status.message}*`,
          ephemeral: true
        });
      }

      if (action === 'on') {
        const msg = interaction.options.getString('message');
        const res = await maintenanceService.enableMaintenance({ message: msg, updatedBy: operator });
        await auditService.recordAction({ action: 'MAINTENANCE_ENABLED', executorId: interaction.user.id, executorName: interaction.user.username });
        return interaction.reply({ content: `🔧 **Maintenance Mode ENABLED.** Regular commands paused.\n*${res.message}*`, ephemeral: true });
      }

      if (action === 'off') {
        await maintenanceService.disableMaintenance({ updatedBy: operator });
        await auditService.recordAction({ action: 'MAINTENANCE_DISABLED', executorId: interaction.user.id, executorName: interaction.user.username });
        return interaction.reply({ content: '🟢 **Maintenance Mode DISABLED.** Normal operations resumed.', ephemeral: true });
      }
    }

    // 3. BLACKLIST
    if (sub === 'blacklist') {
      if (!isBotOwner(interaction.user.id, client)) {
        return interaction.reply({ content: '🚫 Developer permission required.', ephemeral: true });
      }

      const action = interaction.options.getString('action');

      if (action === 'list') {
        const list = await blacklistService.listBlacklist();
        if (!list.length) return interaction.reply({ content: 'ℹ️ No users or servers are currently blacklisted.', ephemeral: true });
        const text = list.slice(0, 15).map(e => `• \`[${e.type.toUpperCase()}]\` \`${e.targetId}\` — *${e.reason}*`).join('\n');
        return interaction.reply({ content: `🚫 **Blacklisted Entities (${list.length}):**\n${text}`, ephemeral: true });
      }

      const targetId = interaction.options.getString('target_id')?.trim();
      if (!targetId) return interaction.reply({ content: '❌ target_id is required for add/remove actions.', ephemeral: true });

      if (action === 'add_user' || action === 'add_guild') {
        const type = action === 'add_user' ? 'user' : 'guild';
        const reason = interaction.options.getString('reason') || 'Violation of Bot Policy';
        await blacklistService.addBlacklist({
          targetId,
          type,
          reason,
          blacklistedBy: interaction.user.id,
          blacklistedByName: interaction.user.username
        });
        await auditService.recordAction({ action: 'BLACKLIST_ADDED', executorId: interaction.user.id, executorName: interaction.user.username, targetId });
        return interaction.reply({ content: `🚫 Successfully blacklisted ${type} \`${targetId}\`.`, ephemeral: true });
      }

      if (action === 'remove') {
        const removed = await blacklistService.removeBlacklist(targetId);
        if (removed) {
          await auditService.recordAction({ action: 'BLACKLIST_REMOVED', executorId: interaction.user.id, executorName: interaction.user.username, targetId });
          return interaction.reply({ content: `✅ Removed \`${targetId}\` from blacklist.`, ephemeral: true });
        }
        return interaction.reply({ content: `⚠️ ID \`${targetId}\` not found in blacklist.`, ephemeral: true });
      }
    }
  },

  async executePrefix(message, args, client) {
    const dbHealth = await getDatabaseHealth();
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('⚡ AURA System Status & Diagnostics')
      .addFields(
        { name: 'WebSocket Ping', value: `\`${client.ws.ping}ms\``, inline: true },
        { name: 'Database Latency', value: `\`${dbHealth.latencyMs || 0}ms\` (${dbHealth.status})`, inline: true },
        { name: 'Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: 'Memory Heap', value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\``, inline: true },
        { name: 'Uptime', value: `\`${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\``, inline: true }
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
