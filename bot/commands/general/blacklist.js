const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const blacklistService = require('../../../shared/blacklistService');
const auditService = require('../../../shared/auditService');
const { isBotOwner } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: null,
  name: 'blacklist',
  description: 'Manage user and server blacklists',
  aliases: ['bl'],
  module: null,

  async execute(interaction, client) {
    if (!isBotOwner(interaction.user.id, client)) {
      return interaction.reply({
        content: '🚫 Access denied. This command is restricted to **AURA Bot Developers**.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const type = interaction.options.getString('type');
      const targetId = interaction.options.getString('target_id').trim();
      const reason = interaction.options.getString('reason') || 'Violation of AURA Bot Usage Policy';

      const entry = await blacklistService.addBlacklist({
        targetId,
        type,
        reason,
        blacklistedBy: interaction.user.id,
        blacklistedByName: interaction.user.username
      });

      await auditService.recordAction({
        action: 'BLACKLIST_ADDED',
        executorId: interaction.user.id,
        executorName: interaction.user.username,
        targetId,
        details: { type, reason }
      });

      return interaction.reply({
        content: `🚫 Successfully blacklisted ${type} \`${targetId}\`.\nReason: *${reason}*`,
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const targetId = interaction.options.getString('target_id').trim();
      const removed = await blacklistService.removeBlacklist(targetId);

      if (removed) {
        await auditService.recordAction({
          action: 'BLACKLIST_REMOVED',
          executorId: interaction.user.id,
          executorName: interaction.user.username,
          targetId
        });
        return interaction.reply({ content: `✅ Removed \`${targetId}\` from the blacklist.`, ephemeral: true });
      } else {
        return interaction.reply({ content: `⚠️ ID \`${targetId}\` was not found in the blacklist.`, ephemeral: true });
      }
    }

    if (sub === 'list') {
      const list = await blacklistService.listBlacklist();
      if (!list.length) {
        return interaction.reply({ content: 'ℹ️ There are currently no users or servers blacklisted.', ephemeral: true });
      }

      const users = list.filter(i => i.type === 'user');
      const guilds = list.filter(i => i.type === 'guild');

      const embed = new EmbedBuilder()
        .setColor(COLORS.SECONDARY)
        .setTitle(`🚫 Blacklist Directory (${list.length} total)`)
        .addFields(
          {
            name: `👤 Blacklisted Users (${users.length})`,
            value: users.length ? users.map(u => `• \`${u.targetId}\` — *${u.reason}*`).slice(0, 10).join('\n') : '*None*'
          },
          {
            name: `🌐 Blacklisted Servers (${guilds.length})`,
            value: guilds.length ? guilds.map(g => `• \`${g.targetId}\` — *${g.reason}*`).slice(0, 10).join('\n') : '*None*'
          }
        )
        .setFooter({ text: 'AURA Security Suite • Instant O(1) Interception' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  async executePrefix(message, args, client) {
    if (!isBotOwner(message.author.id, client)) {
      return message.reply('🚫 Access denied. This command is restricted to **AURA Bot Developers**.');
    }

    const action = args[0]?.toLowerCase();

    if (action === 'add') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      const reason = args.slice(2).join(' ') || 'Policy Violation';
      if (!targetId) return message.reply('❌ Usage: `+blacklist add <ID|@user> [reason]`');

      await blacklistService.addBlacklist({
        targetId,
        type: 'user',
        reason,
        blacklistedBy: message.author.id,
        blacklistedByName: message.author.username
      });
      return message.reply(`🚫 Added \`${targetId}\` to blacklist.`);
    }

    if (action === 'remove') {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId) return message.reply('❌ Usage: `+blacklist remove <ID>`');
      const removed = await blacklistService.removeBlacklist(targetId);
      return message.reply(removed ? `✅ Removed \`${targetId}\` from blacklist.` : `⚠️ \`${targetId}\` not found in blacklist.`);
    }

    const list = await blacklistService.listBlacklist();
    return message.reply(`🚫 Blacklisted entries: **${list.length}** total. Use \`+blacklist add <ID>\` or \`+blacklist remove <ID>\`.`);
  }
};
