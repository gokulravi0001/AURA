const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const immunityService = require('../../../shared/immunityService');
const { isBotOwner, canManageWhitelist, DEFAULT_BOT_OWNERS } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('immunity')
    .setDescription('Manage member and role immunity against bot voice commands (bounce, mute, disconnect)')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Grant a member Immunity against bounce, mute, and disconnect commands')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member to grant immunity to')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a member from the server Immunity list')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member to remove immunity from')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Grant or remove Immunity for an entire role')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role to grant/remove immunity for')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Whether to add or remove this role from immunity')
            .addChoices(
              { name: 'Add (Grant Immunity)', value: 'add' },
              { name: 'Remove (Revoke Immunity)', value: 'remove' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Display all immune members and roles for this server')
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all server-configured immunities')
    ),

  name: 'immunity',
  description: 'Manage immunity against voice commands (bounce, mute, disconnect)',
  aliases: ['imunity', 'immune', 'godmode'],
  module: 'statistics',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const authorId = interaction.user.id;

    // View/List is accessible to administrators, owners, and developers
    if (sub !== 'list') {
      if (!canManageWhitelist(interaction.member || interaction.user, guild, client)) {
        return interaction.reply({
          content: '🚫 Only the **Server Owner** or **Bot Developer** can configure Immunity.',
          ephemeral: true
        });
      }
    }

    // 1. ADD USER
    if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID || isBotOwner(targetUser.id, client)) {
        return interaction.reply({
          content: `🛡️ <@${targetUser.id}> already has **Permanent Absolute Global Immunity** across all servers!`,
          ephemeral: true
        });
      }

      await immunityService.addImmuneUser(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Immunity Granted')
        .setDescription(
          `Successfully granted **Immunity** to <@${targetUser.id}> (\`${targetUser.tag}\`)!\n\n` +
          `• **Protected from:** \`/bounce\`, \`/vc bounce\`, \`/vc disconnect\`, \`+massdc\`, \`/vc mute\`, \`+massmute\`.\n` +
          `• This user cannot be bounced, disconnected, or muted by bot commands.`
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. REMOVE USER
    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID) {
        return interaction.reply({
          content: '🚫 Cannot remove immunity from the primary Bot Owner.',
          ephemeral: true
        });
      }

      await immunityService.removeImmuneUser(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🔓 Immunity Revoked')
        .setDescription(`Removed <@${targetUser.id}> from the server's Immunity list.`)
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. ROLE
    if (sub === 'role') {
      const targetRole = interaction.options.getRole('role');
      const action = interaction.options.getString('action') || 'add';

      if (action === 'add') {
        await immunityService.addImmuneRole(guild.id, targetRole.id);

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🛡️ Role Immunity Granted')
          .setDescription(
            `Successfully granted **Immunity** to all members with the <@&${targetRole.id}> role!\n\n` +
            `• Anyone possessing this role is protected from bounce, disconnect, and mute commands.`
          )
          .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } else {
        await immunityService.removeImmuneRole(guild.id, targetRole.id);

        const embed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle('🔓 Role Immunity Revoked')
          .setDescription(`Removed <@&${targetRole.id}> from the server's Immunity roles.`)
          .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    }

    // 4. LIST
    if (sub === 'list') {
      const immunityData = immunityService.getImmunity(guild.id, settings);

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🛡️ Server Immunity Directory — ${guild.name}`)
        .setDescription(
          `Members with Immunity are completely protected against disruptive voice commands (\`/bounce\`, \`/vc disconnect\`, \`/vc mute\`, etc.).\n\n` +
          `**👑 Permanent Absolute Global Immunity:**\n` +
          `• <@${immunityService.ABSOLUTE_IMMUNE_USER_ID}> \`[Owner / Developer]\`\n` +
          (DEFAULT_BOT_OWNERS.filter(id => id !== immunityService.ABSOLUTE_IMMUNE_USER_ID).map(id => `• <@${id}> \`[Developer]\``).join('\n') || '') +
          `\n\n**👑 Server Owner Immunity:**\n` +
          `• <@${guild.ownerId}> \`[Guild Owner]\`\n\n` +
          `**👥 Server Immune Members:**\n` +
          (immunityData.users.length > 0
            ? immunityData.users.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
            : '*None configured yet.*') +
          `\n\n**🏷️ Server Immune Roles:**\n` +
          (immunityData.roles.length > 0
            ? immunityData.roles.map(id => `• <@&${id}>`).join('\n')
            : '*None configured yet.*')
        )
        .setFooter({ text: 'AURA Immunity Shield' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 5. CLEAR
    if (sub === 'clear') {
      await immunityService.clearImmunity(guild.id);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('🧹 Server Immunity Reset')
            .setDescription('Cleared all server-configured immune users and roles. (Server Owner & Bot Developers retain permanent immunity).')
        ]
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const action = args[0]?.toLowerCase();

    if (!action || action === 'list') {
      const immunityData = immunityService.getImmunity(guild.id, settings);

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🛡️ Server Immunity Directory — ${guild.name}`)
        .setDescription(
          `Members with Immunity are completely protected against disruptive voice commands (\`+bounce\`, \`+massdc\`, \`+massmute\`, etc.).\n\n` +
          `**👑 Permanent Absolute Global Immunity:**\n` +
          `• <@${immunityService.ABSOLUTE_IMMUNE_USER_ID}> \`[Owner / Developer]\`\n` +
          (DEFAULT_BOT_OWNERS.filter(id => id !== immunityService.ABSOLUTE_IMMUNE_USER_ID).map(id => `• <@${id}> \`[Developer]\``).join('\n') || '') +
          `\n\n**👑 Server Owner Immunity:**\n` +
          `• <@${guild.ownerId}> \`[Guild Owner]\`\n\n` +
          `**👥 Server Immune Members:**\n` +
          (immunityData.users.length > 0
            ? immunityData.users.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
            : '*None configured yet.*') +
          `\n\n**🏷️ Server Immune Roles:**\n` +
          (immunityData.roles.length > 0
            ? immunityData.roles.map(id => `• <@&${id}>`).join('\n')
            : '*None configured yet.*')
        )
        .setFooter({ text: 'AURA Immunity Shield' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (!canManageWhitelist(message.member || message.author, guild, client)) {
      return message.reply('🚫 Only the **Server Owner** or **Bot Developer** can configure Immunity.');
    }

    // +immunity add @user
    if (action === 'add') {
      let targetUser = message.mentions.users.first();
      if (!targetUser && args[1]) {
        const rawId = args[1].replace(/[<@!>]/g, '');
        targetUser = await client.users.fetch(rawId).catch(() => null);
      }

      if (!targetUser) {
        return message.reply('❌ Please mention or provide the ID of the user to grant immunity:\nUsage: `+immunity add @user`');
      }

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID || isBotOwner(targetUser.id, client)) {
        return message.reply(`🛡️ <@${targetUser.id}> already has **Permanent Absolute Global Immunity** across all servers!`);
      }

      await immunityService.addImmuneUser(guild.id, targetUser.id);
      return message.reply(`🛡️ Successfully granted **Immunity** to <@${targetUser.id}>! They cannot be bounced, disconnected, or muted.`);
    }

    // +immunity remove @user
    if (action === 'remove' || action === 'del' || action === 'delete') {
      let targetUser = message.mentions.users.first();
      if (!targetUser && args[1]) {
        const rawId = args[1].replace(/[<@!>]/g, '');
        targetUser = await client.users.fetch(rawId).catch(() => null);
      }

      if (!targetUser) {
        return message.reply('❌ Please mention or provide the ID of the user to remove from immunity:\nUsage: `+immunity remove @user`');
      }

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID) {
        return message.reply('🚫 Cannot remove immunity from the primary Bot Owner.');
      }

      await immunityService.removeImmuneUser(guild.id, targetUser.id);
      return message.reply(`🔓 Removed <@${targetUser.id}> from the server Immunity list.`);
    }

    // +immunity role @role [add/remove]
    if (action === 'role') {
      const targetRole = message.mentions.roles.first() || (args[1] ? guild.roles.cache.get(args[1]) : null);
      if (!targetRole) {
        return message.reply('❌ Please mention or provide the ID of the role to configure immunity for:\nUsage: `+immunity role @Role [add|remove]`');
      }

      const subAction = args[2]?.toLowerCase() || 'add';
      if (subAction === 'remove' || subAction === 'del') {
        await immunityService.removeImmuneRole(guild.id, targetRole.id);
        return message.reply(`🔓 Removed role <@&${targetRole.id}> from Immunity roles.`);
      } else {
        await immunityService.addImmuneRole(guild.id, targetRole.id);
        return message.reply(`🛡️ Successfully granted **Immunity** to role <@&${targetRole.id}>! All members with this role are now protected.`);
      }
    }

    // +immunity clear
    if (action === 'clear' || action === 'reset') {
      await immunityService.clearImmunity(guild.id);
      return message.reply('🧹 Server Immunity list has been reset.');
    }

    return message.reply('❓ Unknown subcommand. Available: `+immunity add @user`, `+immunity remove @user`, `+immunity role @Role`, `+immunity list`, `+immunity clear`');
  }
};
