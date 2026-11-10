const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const inviteService = require('../../modules/inviteService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviterole')
    .setDescription('Configure exclusive invite creation and sharing permissions for an Inviter role')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the role required to create and share invite links')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role members must have to create invites')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('sync_permissions')
            .setDescription('Automatically deny Create Invite on @everyone and grant to this role (Recommended)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('clean_old_invites')
            .setDescription('Automatically delete existing invites created by members without this role')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('block_chat')
            .setDescription('Automatically delete Discord invite links sent in chat by unauthorized members')
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('log_channel')
            .setDescription('Channel to log unauthorized invite generation attempts')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current Inviter Role guard status and settings')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable the Inviter Role guard and restore default invite permissions')
    )
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Re-sync Discord permissions: lock @everyone from inviting and grant to Inviter role')
    )
    .addSubcommand(sub =>
      sub.setName('clean')
        .setDescription('Scan and delete all current invites created by members without the Inviter role')
    ),

  name: 'inviterole',
  description: 'Manage exclusive inviter role restrictions',
  aliases: ['invguard', 'inviteguard', 'invrole'],
  module: 'invite_guard',

  async execute(interaction, client, settings) {
    // Permission check: Owner, Admin, Bot Developer, or Whitelisted member
    if (!isOwnerOrAdmin(interaction.member, interaction.guild, client, settings)) {
      return interaction.reply({
        content: '🚫 Administrator, Server Owner, or Whitelisted permissions required to configure Inviter Role.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // 1. SET
    if (sub === 'set') {
      await interaction.deferReply();
      const role = interaction.options.getRole('role');
      const syncPerms = interaction.options.getBoolean('sync_permissions') ?? true;
      const cleanOld = interaction.options.getBoolean('clean_old_invites') ?? true;
      const blockChat = interaction.options.getBoolean('block_chat') ?? true;
      const logChannel = interaction.options.getChannel('log_channel') || null;

      const updateData = {
        'modules.invite_guard': true,
        'inviteGuard.enabled': true,
        'inviteGuard.roleId': role.id,
        'inviteGuard.blockChatInvites': blockChat
      };

      if (logChannel) {
        updateData['inviteGuard.logChannelId'] = logChannel.id;
      }

      const updatedSettings = await Guild.findOneAndUpdate(
        { guildId: guild.id },
        { $set: updateData },
        { upsert: true, new: true }
      );

      let syncResult = null;
      if (syncPerms) {
        syncResult = await inviteService.syncInvitePermissions(guild, role.id);
      }

      let purgedCount = 0;
      if (cleanOld) {
        purgedCount = await inviteService.purgeUnauthorizedInvites(guild, updatedSettings, client);
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Inviter Role Configured & Locked')
        .setDescription(
          `Only members with the <@&${role.id}> role can now create server invite links or invite people.\n\n` +
          `**Configuration Summary:**\n` +
          `• **Designated Role:** <@&${role.id}> (\`${role.name}\`)\n` +
          `• **Chat Invite Blocker:** ${blockChat ? '✅ Enabled (Deletes unauthorized invite links in chat)' : '❌ Disabled'}\n` +
          `• **Log Channel:** ${logChannel ? `<#${logChannel.id}>` : (updatedSettings.inviteTracker?.channelId ? `<#${updatedSettings.inviteTracker.channelId}>` : 'None')}\n` +
          `• **Permissions Synced:** ${syncPerms ? (syncResult?.success ? '✅ Denied @everyone & granted to Inviter role' : `⚠️ Warning: ${syncResult?.error || 'Partial'}`) : '⚪ Skipped'}\n` +
          `• **Old Invites Purged:** ${cleanOld ? `🧹 Deleted **${purgedCount}** unauthorized existing invites` : '⚪ Skipped'}\n\n` +
          `🔒 *If any member without <@&${role.id}> generates an invite, AURA will delete it instantly and alert them.*`
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // 2. VIEW / STATUS
    if (sub === 'view') {
      const guard = settings?.inviteGuard;
      const isEnabled = guard?.enabled && guard?.roleId;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? COLORS.PRIMARY : COLORS.WARNING)
        .setTitle('🛡️ Inviter Role Guard Status')
        .setDescription(
          isEnabled
            ? `**Status:** 🟢 **Active & Enforcing**\n\n` +
              `• **Required Role:** <@&${guard.roleId}>\n` +
              `• **Chat Link Blocker:** ${guard.blockChatInvites !== false ? '✅ Enabled' : '❌ Disabled'}\n` +
              `• **Log Channel:** ${guard.logChannelId ? `<#${guard.logChannelId}>` : (settings.inviteTracker?.channelId ? `<#${settings.inviteTracker.channelId}>` : 'Not configured')}\n\n` +
              `*Members without this role cannot generate invite links. Any attempts are deleted in real-time.*`
            : `**Status:** 🔴 **Disabled / Not Configured**\n\n` +
              `To restrict invite creation to a specific role, use:\n` +
              `\`/inviterole set role:@YourRole\` or \`+inviterole set @YourRole\``
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. DISABLE
    if (sub === 'disable') {
      await Guild.updateOne(
        { guildId: guild.id },
        { $set: { 'inviteGuard.enabled': false } }
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('🔓 Inviter Role Guard Disabled')
            .setDescription('Invite restriction has been disabled. Members can now create invites according to their Discord channel permissions.')
        ]
      });
    }

    // 4. SYNC
    if (sub === 'sync') {
      const roleId = settings?.inviteGuard?.roleId;
      if (!roleId) {
        return interaction.reply({
          content: '❌ No Inviter Role is currently set. Run `/inviterole set role:@Role` first.',
          ephemeral: true
        });
      }

      await interaction.deferReply();
      const res = await inviteService.syncInvitePermissions(guild, roleId);
      const purged = await inviteService.purgeUnauthorizedInvites(guild, settings, client);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(res.success ? COLORS.SUCCESS : COLORS.ERROR)
            .setTitle('🔄 Inviter Permissions Re-Synced')
            .setDescription(
              res.success
                ? `✅ Successfully synced Discord permissions for <@&${roleId}>!\n\n` +
                  `• Denied \`Create Instant Invite\` on \`@everyone\`.\n` +
                  `• Granted \`Create Instant Invite\` to <@&${roleId}>.\n` +
                  `• Purged **${purged}** unauthorized lingering invites.`
                : `❌ Failed to sync permissions: \`${res.error}\``
            )
        ]
      });
    }

    // 5. CLEAN
    if (sub === 'clean') {
      const roleId = settings?.inviteGuard?.roleId;
      if (!roleId) {
        return interaction.reply({
          content: '❌ No Inviter Role is currently set. Run `/inviterole set role:@Role` first.',
          ephemeral: true
        });
      }

      await interaction.deferReply();
      const purged = await inviteService.purgeUnauthorizedInvites(guild, settings, client);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🧹 Unauthorized Invites Cleaned')
            .setDescription(`Successfully scanned and deleted **${purged}** existing invites created by members without the <@&${roleId}> role.`)
        ]
      });
    }
  },

  // Prefix Command (+inviterole set @role / +inviterole view / +inviterole disable)
  async executePrefix(message, args, client, settings) {
    if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
      return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required to configure Inviter Role.');
    }

    const action = args[0]?.toLowerCase();
    const guild = message.guild;

    // View / Status default
    if (!action || action === 'view' || action === 'status') {
      const guard = settings?.inviteGuard;
      const isEnabled = guard?.enabled && guard?.roleId;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? COLORS.PRIMARY : COLORS.WARNING)
        .setTitle('🛡️ Inviter Role Guard Status')
        .setDescription(
          isEnabled
            ? `**Status:** 🟢 **Active & Enforcing**\n\n` +
              `• **Required Role:** <@&${guard.roleId}>\n` +
              `• **Chat Link Blocker:** ${guard.blockChatInvites !== false ? '✅ Enabled' : '❌ Disabled'}\n` +
              `• **Log Channel:** ${guard.logChannelId ? `<#${guard.logChannelId}>` : (settings.inviteTracker?.channelId ? `<#${settings.inviteTracker.channelId}>` : 'Not configured')}\n\n` +
              `*Members without this role cannot generate invite links. Any attempts are deleted in real-time.*`
            : `**Status:** 🔴 **Disabled / Not Configured**\n\n` +
              `To set the inviter role, run:\n` +
              `\`+inviterole set @Role\``
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Set: +inviterole set @role [#log-channel]
    if (action === 'set') {
      const role = message.mentions.roles.first() || (args[1] ? guild.roles.cache.get(args[1]) : null);
      if (!role) {
        return message.reply('❌ Please mention or provide the ID of the role to designate as the Inviter role:\nExample: `+inviterole set @Inviter`');
      }

      const logChannel = message.mentions.channels.first() || null;
      const updateData = {
        'modules.invite_guard': true,
        'inviteGuard.enabled': true,
        'inviteGuard.roleId': role.id,
        'inviteGuard.blockChatInvites': true
      };

      if (logChannel) {
        updateData['inviteGuard.logChannelId'] = logChannel.id;
      }

      const updatedSettings = await Guild.findOneAndUpdate(
        { guildId: guild.id },
        { $set: updateData },
        { upsert: true, new: true }
      );

      const syncResult = await inviteService.syncInvitePermissions(guild, role.id);
      const purgedCount = await inviteService.purgeUnauthorizedInvites(guild, updatedSettings, client);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Inviter Role Configured & Locked')
        .setDescription(
          `Only members with the <@&${role.id}> role can now create server invite links or invite people.\n\n` +
          `**Configuration Summary:**\n` +
          `• **Designated Role:** <@&${role.id}> (\`${role.name}\`)\n` +
          `• **Permissions Synced:** ${syncResult?.success ? '✅ Denied @everyone & granted to Inviter role' : '⚠️ Warning on permissions'}\n` +
          `• **Old Invites Purged:** 🧹 Deleted **${purgedCount}** unauthorized existing invites\n\n` +
          `🔒 *If any member without <@&${role.id}> generates an invite, AURA will delete it instantly and alert them.*`
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Disable: +inviterole disable / off
    if (action === 'disable' || action === 'off') {
      await Guild.updateOne(
        { guildId: guild.id },
        { $set: { 'inviteGuard.enabled': false } }
      );

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('🔓 Inviter Role Guard Disabled')
            .setDescription('Invite restriction has been disabled. Members can now create invites according to their Discord channel permissions.')
        ]
      });
    }

    // Sync: +inviterole sync
    if (action === 'sync') {
      const roleId = settings?.inviteGuard?.roleId;
      if (!roleId) {
        return message.reply('❌ No Inviter Role is currently set. Run `+inviterole set @Role` first.');
      }

      const res = await inviteService.syncInvitePermissions(guild, roleId);
      const purged = await inviteService.purgeUnauthorizedInvites(guild, settings, client);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(res.success ? COLORS.SUCCESS : COLORS.ERROR)
            .setTitle('🔄 Inviter Permissions Re-Synced')
            .setDescription(
              res.success
                ? `✅ Successfully synced Discord permissions for <@&${roleId}>!\n\n` +
                  `• Denied \`Create Instant Invite\` on \`@everyone\`.\n` +
                  `• Granted \`Create Instant Invite\` to <@&${roleId}>.\n` +
                  `• Purged **${purged}** unauthorized lingering invites.`
                : `❌ Failed to sync permissions: \`${res.error}\``
            )
        ]
      });
    }

    // Clean: +inviterole clean
    if (action === 'clean') {
      const roleId = settings?.inviteGuard?.roleId;
      if (!roleId) {
        return message.reply('❌ No Inviter Role is currently set. Run `+inviterole set @Role` first.');
      }

      const purged = await inviteService.purgeUnauthorizedInvites(guild, settings, client);
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🧹 Unauthorized Invites Cleaned')
            .setDescription(`Successfully scanned and deleted **${purged}** existing invites created by members without the <@&${roleId}> role.`)
        ]
      });
    }

    return message.reply('❓ Unknown subcommand. Available: `+inviterole set @Role`, `+inviterole view`, `+inviterole sync`, `+inviterole clean`, `+inviterole disable`');
  }
};
