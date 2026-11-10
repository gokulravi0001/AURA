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
        .setDescription('Set the role to automatically award to members who adopt this server\'s tag')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role automatically granted when a member adopts the server tag')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('Optional custom tag (leave empty to auto-detect from server name)')
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Optional channel to announce when a member adopts the tag')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current server tag auto-role configuration & detected tags')
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
      const role = interaction.options.getRole('role');
      const customTag = interaction.options.getString('tag')?.trim() || null;
      const channel = interaction.options.getChannel('channel');

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

      await interaction.deferReply();

      // Save to database
      await tagRoleService.setTagRole(guild.id, {
        tag: customTag,
        roleId: role.id,
        channelId: channel?.id || null
      });

      // Fetch auto-detected tags for this server
      const detectedTags = tagRoleService.getServerTags(guild, customTag);
      const tagDisplay = detectedTags.map(t => `\`${t}\``).join(', ');

      // Run immediate initial sync so existing members holding the tag receive the role right now!
      const syncResult = await tagRoleService.syncGuild(guild, {
        tagRole: { enabled: true, tag: customTag, roleId: role.id, channelId: channel?.id }
      }, client);

      const stats = syncResult.stats || { scanned: 0, added: 0, unchanged: 0 };

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏷️ Server Tag Auto-Role Activated!')
        .setDescription(
          `AURA will now automatically grant <@&${role.id}> to anyone who adopts this server's tag in their nickname or username, and **automatically revoke it if they remove the tag**!\n\n` +
          `• **Server:** **${guild.name}**\n` +
          `• **Detected Server Tag(s):** ${tagDisplay || `\`${guild.name}\``}\n` +
          `• **Target Role:** <@&${role.id}>\n` +
          `• **Announcement Channel:** ${channel ? `<#${channel.id}>` : '*None*'}\n\n` +
          `📊 **Initial Server Scan Completed:**\n` +
          `• Scanned: **${stats.scanned}** members\n` +
          `• ➕ Granted role to **${stats.added}** members holding the tag\n` +
          `• ⚖️ **${stats.unchanged}** members up to date`
        )
        .setFooter({ text: `Activated by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 2. VIEW / STATUS
    if (sub === 'view') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.roleId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.WARNING)
              .setTitle('🏷️ Server Tag Auto-Role — Disabled')
              .setDescription(
                `Tag auto-role is not configured or currently disabled on **${guild.name}**.\n\n` +
                `**To enable it simply run:**\n` +
                `\`/tagrole set role:@role\`\n` +
                `*AURA will automatically read the server's tag and award the role!*`
              )
              .setTimestamp()
          ]
        });
      }

      const role = guild.roles.cache.get(config.roleId);
      const membersWithRole = role ? role.members.size : 0;
      const detectedTags = tagRoleService.getServerTags(guild, config.tag);

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🏷️ Server Tag Auto-Role — ${guild.name}`)
        .setDescription(
          `Members with this server's tag automatically receive the reward role, and lose it when the tag is removed.\n\n` +
          `• **Status:** 🟢 **Active**\n` +
          `• **Detected Server Tag(s):** ${detectedTags.map(t => `\`${t}\``).join(', ')}\n` +
          `• **Awarded Role:** ${role ? `<@&${role.id}> (\`${role.name}\`)` : `⚠️ *Role deleted (\`${config.roleId}\`)*`}\n` +
          `• **Members with Tag Role:** **${membersWithRole}** members\n` +
          `• **Announcement Channel:** ${config.channelId ? `<#${config.channelId}>` : '*None*'}`
        )
        .setFooter({ text: 'AURA Tag Auto-Role System • Run /tagrole sync anytime to re-scan' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. SYNC MEMBERS
    if (sub === 'sync') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.roleId) {
        return interaction.reply({
          content: '❌ Tag auto-role is not configured. Run `/tagrole set role:@role` first!',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      const result = await tagRoleService.syncGuild(guild, settings, client);
      if (!result.success) {
        return interaction.followUp({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const { scanned, added, removed, unchanged, errors } = result.stats;
      const detectedTags = tagRoleService.getServerTags(guild, config.tag);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🔄 Server Tag Auto-Role Sync Complete!')
        .setDescription(
          `Finished scanning **${scanned}** members for server tag (${detectedTags.map(t => `\`${t}\``).join(', ')}):\n\n` +
          `• ➕ **Roles Granted:** **${added}** members *(holding tag)*\n` +
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
    if (action === 'view' || action === 'status' || action === 'list') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.roleId) {
        return message.reply(
          `🏷️ **Server Tag Auto-Role is currently disabled.**\n` +
          `• **To configure:** \`+tagrole set @role\` *(auto-detects server tag)*\n` +
          `• **Example:** \`+tagrole set @Supporter\``
        );
      }

      const role = guild.roles.cache.get(config.roleId);
      const membersWithRole = role ? role.members.size : 0;
      const detectedTags = tagRoleService.getServerTags(guild, config.tag);

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🏷️ Server Tag Auto-Role — ${guild.name}`)
        .setDescription(
          `• **Status:** 🟢 **Active**\n` +
          `• **Detected Server Tag(s):** ${detectedTags.map(t => `\`${t}\``).join(', ')}\n` +
          `• **Awarded Role:** ${role ? `<@&${role.id}>` : `⚠️ *Missing role (\`${config.roleId}\`)*`}\n` +
          `• **Members with Role:** **${membersWithRole}**\n` +
          `• **Channel:** ${config.channelId ? `<#${config.channelId}>` : '*None*'}\n\n` +
          `*To sync all members now: \`+tagrole sync\`*`
        )
        .setFooter({ text: 'AURA Tag Auto-Role System' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +tagrole sync
    if (action === 'sync') {
      const config = settings?.tagRole;
      if (!config?.enabled || !config.roleId) {
        return message.reply('❌ Tag auto-role is not configured. Run `+tagrole set @role` first.');
      }

      const syncMsg = await message.reply('🔄 Scanning server members and checking server tags...');

      const result = await tagRoleService.syncGuild(guild, settings, client);
      if (!result.success) {
        return syncMsg.edit(`❌ ${result.error}`);
      }

      const { scanned, added, removed, unchanged, errors } = result.stats;

      return syncMsg.edit(
        `✅ **Sync Complete!** Scanned **${scanned}** members:\n` +
        `• ➕ **Granted:** **${added}** members *(holding tag)*\n` +
        `• ➖ **Revoked:** **${removed}** members *(removed tag)*\n` +
        `• ⚖️ **Unchanged:** **${unchanged}** members` +
        (errors > 0 ? `\n• ⚠️ **Errors:** ${errors}` : '')
      );
    }

    // +tagrole disable / off
    if (action === 'disable' || action === 'off' || action === 'remove') {
      await tagRoleService.disableTagRole(guild.id);
      return message.reply('🔓 Server Tag Auto-Role has been disabled.');
    }

    // +tagrole set @role [#channel] OR +tagrole @role
    let role = message.mentions.roles.first();
    let channel = message.mentions.channels.first();

    if (!role) {
      const roleIdCandidate = args.find(a => /^\d{17,20}$/.test(a.replace(/[<@&>]/g, '')));
      if (roleIdCandidate) {
        role = guild.roles.cache.get(roleIdCandidate.replace(/[<@&>]/g, ''));
      }
    }

    if (!role) {
      return message.reply(
        '🏷️ **Server Tag Auto-Role Setup:**\n' +
        '• **Usage:** `+tagrole set @role [#channel]`\n' +
        '• **Example:** `+tagrole set @Supporter`\n' +
        '*(AURA automatically reads this server\'s tag and awards the role to anyone holding it!)*'
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
      tag: null, // Auto-detect from server name
      roleId: role.id,
      channelId: channel?.id || null
    });

    const detectedTags = tagRoleService.getServerTags(guild);
    const syncMsg = await message.reply(
      `🏷️ **Server Tag Auto-Role Activated!**\n` +
      `• **Target Role:** <@&${role.id}>\n` +
      `• **Detected Server Tag(s):** ${detectedTags.map(t => `\`${t}\``).join(', ')}\n` +
      `\n🔄 Scanning current members now...`
    );

    const syncResult = await tagRoleService.syncGuild(guild, {
      tagRole: { enabled: true, tag: null, roleId: role.id, channelId: channel?.id }
    }, client);

    const stats = syncResult.stats || { scanned: 0, added: 0, unchanged: 0 };
    return syncMsg.edit(
      `🏷️ **Server Tag Auto-Role Activated & Synced!**\n` +
      `• **Role:** <@&${role.id}>\n` +
      `• **Detected Tag(s):** ${detectedTags.map(t => `\`${t}\``).join(', ')}\n` +
      (channel ? `• **Announcements:** <#${channel.id}>\n` : '') +
      `\n📊 **Scan Results:** Granted role to **${stats.added}** members holding the tag out of **${stats.scanned}** members scanned!`
    );
  }
};
