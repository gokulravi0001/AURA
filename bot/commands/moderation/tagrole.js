const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const tagRoleService = require('../../modules/tagRoleService');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tagrole')
    .setDescription('Automatically award a role to members who adopt the server tag in their name')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Configure the server tag and auto-role reward')
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('The server tag/text members adopt (e.g. therla, [therla], | therla)')
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role automatically awarded to members who adopt the tag')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Optional channel to announce when a member adopts the tag')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('dm')
            .setDescription('Send a thank-you DM when a member adopts the tag (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server tag auto-role configuration')
    )
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Scan all server members and grant/revoke the tag role based on who has the tag')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable the server tag auto-role system')
    ),

  name: 'tagrole',
  description: 'Automatically award a role to members who adopt the server tag in their name',
  aliases: ['tagautorole', 'servertag', 'nametag', 'vanitytag'],
  permissions: [PermissionFlagsBits.ManageRoles],
  module: 'moderation',

  async execute(interaction, client, settings) {
    const guild = interaction.guild;
    const caller = interaction.member || interaction.user;

    // Permissions check: Server Owner, Bot Developer, or Administrators
    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return interaction.reply({
        content: '🚫 The `/tagrole` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    // 1. SET TAG ROLE
    if (sub === 'set') {
      const tag = interaction.options.getString('tag').trim();
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const dm = interaction.options.getBoolean('dm') || false;

      // Verify bot permissions
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({
          content: '⚠️ **Missing Permission**: I need the **Manage Roles** permission in server settings to assign roles! Please grant **Manage Roles** to the AURA bot role.',
          ephemeral: true
        });
      }

      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `⚠️ **Role Hierarchy Error**: The role <@&${role.id}> is higher than or equal to my highest role (**${botMember.roles.highest.name}**).\n` +
                   `Please go to **Server Settings > Roles** and drag the **AURA** bot role above <@&${role.id}> so I can automatically award it!`,
          ephemeral: true
        });
      }

      if (role.managed) {
        return interaction.reply({
          content: '❌ That role is automatically managed by an integration or bot and cannot be assigned manually.',
          ephemeral: true
        });
      }

      await tagRoleService.setTagRole(guild.id, {
        tag,
        roleId: role.id,
        channelId: channel?.id || null,
        dmNotification: dm
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏷️ Server Tag Auto-Role Configured!')
        .setDescription(
          `Members who adopt **\`${tag}\`** anywhere in their nickname or username will automatically receive <@&${role.id}>!\n\n` +
          `• **Server Tag:** \`${tag}\` *(Case-insensitive)*\n` +
          `• **Awarded Role:** <@&${role.id}>\n` +
          `• **Announcement Channel:** ${channel ? `<#${channel.id}>` : '*None*'}\n` +
          `• **Thank-you DM:** ${dm ? '✅ Enabled' : '❌ Disabled'}\n\n` +
          `💡 *Tip: Run \`/tagrole sync\` to immediately scan and award the role to all members who already have \`${tag}\` in their name!*`
        )
        .setFooter({ text: `Configured by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. VIEW / STATUS
    if (sub === 'view') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.tag || !config.roleId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.WARNING)
              .setTitle('🏷️ Server Tag Auto-Role — Disabled')
              .setDescription(
                `Tag auto-role is not configured or currently disabled on **${guild.name}**.\n\n` +
                `**To enable it:**\n` +
                `\`/tagrole set tag:<tag> role:@role\`\n` +
                `*Example: \`/tagrole set tag:therla role:@Supporter\`*`
              )
              .setTimestamp()
          ]
        });
      }

      const role = guild.roles.cache.get(config.roleId);
      const membersWithRole = role ? role.members.size : 0;

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🏷️ Server Tag Auto-Role Directory — ${guild.name}`)
        .setDescription(
          `Members who adopt **\`${config.tag}\`** in their nickname or username automatically receive the reward role.\n\n` +
          `• **Status:** 🟢 **Active**\n` +
          `• **Server Tag:** \`${config.tag}\` *(Case-insensitive)*\n` +
          `• **Awarded Role:** ${role ? `<@&${role.id}> (\`${role.name}\`)` : `⚠️ *Role deleted (\`${config.roleId}\`)*`}\n` +
          `• **Members with Tag Role:** **${membersWithRole}** members\n` +
          `• **Celebration Channel:** ${config.channelId ? `<#${config.channelId}>` : '*None*'}\n` +
          `• **Thank-you DM:** ${config.dmNotification ? '✅ Enabled' : '❌ Disabled'}`
        )
        .setFooter({ text: 'AURA Tag Auto-Role System • Run /tagrole sync to update all members' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. SYNC MEMBERS
    if (sub === 'sync') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.tag || !config.roleId) {
        return interaction.reply({
          content: '❌ Tag auto-role is not configured. Please run `/tagrole set` first!',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      const result = await tagRoleService.syncGuild(guild, settings, client);
      if (!result.success) {
        return interaction.followUp({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const { scanned, added, removed, unchanged, errors } = result.stats;

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🔄 Server Tag Auto-Role Sync Complete!')
        .setDescription(
          `Finished scanning **${scanned}** members for server tag **\`${config.tag}\`**:\n\n` +
          `• ➕ **Roles Granted:** **${added}** members *(adopted tag)*\n` +
          `• ➖ **Roles Revoked:** **${removed}** members *(removed tag)*\n` +
          `• ⚖️ **Unchanged:** **${unchanged}** members\n` +
          (errors > 0 ? `• ⚠️ **Errors:** **${errors}** *(role hierarchy or missing permissions)*\n` : '') +
          `\n*Target Role: <@&${config.roleId}>*`
        )
        .setFooter({ text: `Synced by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 4. DISABLE
    if (sub === 'disable') {
      await tagRoleService.disableTagRole(guild.id);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('🔓 Tag Auto-Role Disabled')
            .setDescription(`Tag auto-role has been disabled on **${guild.name}**. Members adopting or removing the tag will no longer be given or stripped of roles.`)
            .setTimestamp()
        ]
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const caller = message.member || message.author;

    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return message.reply('🚫 The `+tagrole` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
    }

    const action = args[0]?.toLowerCase();

    // +tagrole view / status
    if (!action || action === 'view' || action === 'status' || action === 'list') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.tag || !config.roleId) {
        return message.reply(
          `🏷️ **Server Tag Auto-Role is currently disabled.**\n` +
          `• **To configure:** \`+tagrole set <tag> @role [#channel]\`\n` +
          `• **Example:** \`+tagrole set therla @Supporter\``
        );
      }

      const role = guild.roles.cache.get(config.roleId);
      const membersWithRole = role ? role.members.size : 0;

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🏷️ Server Tag Auto-Role — ${guild.name}`)
        .setDescription(
          `Members who adopt **\`${config.tag}\`** in their nickname or username automatically receive the reward role.\n\n` +
          `• **Status:** 🟢 **Active**\n` +
          `• **Server Tag:** \`${config.tag}\`\n` +
          `• **Awarded Role:** ${role ? `<@&${role.id}>` : `⚠️ *Missing role (\`${config.roleId}\`)*`}\n` +
          `• **Members with Role:** **${membersWithRole}**\n` +
          `• **Channel:** ${config.channelId ? `<#${config.channelId}>` : '*None*'}\n\n` +
          `*To sync all members now: \`+tagrole sync\`*`
        )
        .setFooter({ text: 'AURA Tag Auto-Role System' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +tagrole set <tag> @role [#channel]
    if (action === 'set' || action === 'enable' || action === 'on') {
      const tag = args[1];
      const role = message.mentions.roles.first() || (args[2] ? guild.roles.cache.get(args[2].replace(/[<@&>]/g, '')) : null);
      const channel = message.mentions.channels.first();

      if (!tag || !role) {
        return message.reply(
          '❌ **Usage:** `+tagrole set <tag> @role [#channel]`\n' +
          '• **Example:** `+tagrole set therla @Supporter`\n' +
          '• **Example with channel:** `+tagrole set therla @Supporter #announcements`'
        );
      }

      // Check bot permissions
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply('⚠️ **Missing Permission**: I need the **Manage Roles** permission to award roles! Please enable **Manage Roles** for the AURA bot role in Server Settings.');
      }

      if (role.position >= botMember.roles.highest.position) {
        return message.reply(`⚠️ **Role Hierarchy Error**: <@&${role.id}> is higher than or equal to my highest role. Please drag the **AURA** bot role above <@&${role.id}> in Server Settings > Roles!`);
      }

      await tagRoleService.setTagRole(guild.id, {
        tag,
        roleId: role.id,
        channelId: channel?.id || null,
        dmNotification: false
      });

      return message.reply(
        `🏷️ **Server Tag Auto-Role Configured!**\n` +
        `• **Server Tag:** \`${tag}\`\n` +
        `• **Role:** <@&${role.id}>\n` +
        (channel ? `• **Announcement:** <#${channel.id}>\n` : '') +
        `\nAnyone who adds **\`${tag}\`** to their nickname or username will automatically receive <@&${role.id}>!\n` +
        `*Type \`+tagrole sync\` to award it to all current members who already have \`${tag}\`.*`
      );
    }

    // +tagrole sync
    if (action === 'sync') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.tag || !config.roleId) {
        return message.reply('❌ Tag auto-role is not configured. Run `+tagrole set <tag> @role` first.');
      }

      const syncMsg = await message.reply('🔄 Scanning server members and checking tags...');

      const result = await tagRoleService.syncGuild(guild, settings, client);
      if (!result.success) {
        return syncMsg.edit(`❌ ${result.error}`);
      }

      const { scanned, added, removed, unchanged, errors } = result.stats;

      return syncMsg.edit(
        `✅ **Sync Complete!** Scanned **${scanned}** members for tag **\`${config.tag}\`**:\n` +
        `• ➕ **Granted:** **${added}** members\n` +
        `• ➖ **Revoked:** **${removed}** members\n` +
        `• ⚖️ **Unchanged:** **${unchanged}** members` +
        (errors > 0 ? `\n• ⚠️ **Errors:** ${errors}` : '')
      );
    }

    // +tagrole disable / off
    if (action === 'disable' || action === 'off' || action === 'remove') {
      await tagRoleService.disableTagRole(guild.id);
      return message.reply('🔓 Server Tag Auto-Role has been disabled.');
    }

    return message.reply(
      '❓ **Tag Auto-Role Commands:**\n' +
      '• `+tagrole set <tag> @role [#channel]` — Set tag & reward role (e.g. `+tagrole set therla @Supporter`)\n' +
      '• `+tagrole sync` — Scan all members & grant/revoke roles\n' +
      '• `+tagrole view` — View current tag settings\n' +
      '• `+tagrole disable` — Turn off tag auto-role'
    );
  }
};
