const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const trustedService = require('../../../shared/trustedService');
const immunityService = require('../../../shared/immunityService');
const { isBotOwner, canManageTrusted, DEFAULT_BOT_OWNERS } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trusted')
    .setDescription('Manage trusted members who have full immunity and command access without admin')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Member to add or remove from trusted list (leave empty to view list)')
        .setRequired(false)
    ),

  name: 'trusted',
  description: 'Set trusted members who have full immunity and can run all commands without admin',
  aliases: ['trust', 'trustedmember', 'trustedmembers'],
  module: null,

  async execute(interaction, client, settings) {
    const guild = interaction.guild;
    const caller = interaction.member || interaction.user;

    // Security check: ONLY Server Owner or Bot Developer can configure trusted members
    if (!canManageTrusted(caller, guild, client)) {
      return interaction.reply({
        content: '🚫 Only the **Server Owner** or **Bot Developer** can configure Trusted Members.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand(false);
    const targetUser = interaction.options.getUser('user');

    if (targetUser) {
      if (targetUser.bot) {
        return interaction.reply({ content: '❌ Bots cannot be set as trusted members.', ephemeral: true });
      }
      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID || isBotOwner(targetUser.id, client)) {
        return interaction.reply({ content: `ℹ️ <@${targetUser.id}> is a **Bot Developer / Owner** and already has permanent global immunity and command bypass across all servers.`, ephemeral: true });
      }
      if (guild.ownerId === targetUser.id) {
        return interaction.reply({ content: `ℹ️ <@${targetUser.id}> is the **Server Owner** and already has full immunity and command access.`, ephemeral: true });
      }

      const isAlreadyTrusted = trustedService.isTrusted(guild.id, targetUser.id);
      if (isAlreadyTrusted) {
        await trustedService.removeTrusted(guild.id, targetUser.id);
        const embed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle('🗑️ Trusted Member Removed')
          .setDescription(`Removed <@${targetUser.id}> from the **Trusted Members** list on this server.`)
          .setFooter({ text: `Removed by ${interaction.user.tag}` })
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      } else {
        await trustedService.addTrusted(guild.id, targetUser.id);
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🛡️ Trusted Member Set')
          .setDescription(
            `Successfully added <@${targetUser.id}> as a **Trusted Member**.\n\n` +
            `✨ **Privileges Granted:**\n` +
            `• **Absolute Immunity:** Protected from all disruptive bot actions (/bounce, /autodlt, /vc mute, etc.)\n` +
            `• **Command Access:** Can use all bot commands on this server without needing Discord Administrator or specific permissions!`
          )
          .setFooter({ text: `Configured by ${interaction.user.tag}` })
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }
    }

    if (sub === 'set') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser.bot) {
        return interaction.reply({
          content: '❌ Bots cannot be set as trusted members.',
          ephemeral: true
        });
      }

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID || isBotOwner(targetUser.id, client)) {
        return interaction.reply({
          content: `ℹ️ <@${targetUser.id}> is a **Bot Developer / Owner** and already has permanent global immunity and command bypass across all servers.`,
          ephemeral: true
        });
      }

      if (guild.ownerId === targetUser.id) {
        return interaction.reply({
          content: `ℹ️ <@${targetUser.id}> is the **Server Owner** and already has full immunity and command access.`,
          ephemeral: true
        });
      }

      await trustedService.addTrusted(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Trusted Member Set')
        .setDescription(
          `Successfully added <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`) as a **Trusted Member**.\n\n` +
          `✨ **Privileges Granted:**\n` +
          `• **Absolute Immunity:** Protected from all disruptive bot actions (\`/bounce\`, \`/autodlt\`, \`/vc mute\`, \`/vc disconnect\`, etc.)\n` +
          `• **Command Access:** Can use all bot commands on this server without needing Discord Administrator or specific permissions!`
        )
        .setFooter({ text: `Configured by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID) {
        return interaction.reply({
          content: '🚫 The Primary Bot Developer cannot have their immunity or permissions removed.',
          ephemeral: true
        });
      }

      await trustedService.removeTrusted(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🗑️ Trusted Member Removed')
        .setDescription(`Removed <@${targetUser.id}> from the **Trusted Members** list on this server.`)
        .setFooter({ text: `Removed by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'clear') {
      await trustedService.clearTrusted(guild.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🧹 Trusted Members Cleared')
        .setDescription('All trusted members on this server have been removed.')
        .setFooter({ text: `Cleared by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const trustedList = trustedService.getTrusted(guild.id, settings);

      const trustedFormatted = trustedList.length > 0
        ? trustedList.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
        : '*No custom trusted members set on this server.*';

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🛡️ Trusted Members & Immunity — ${guild.name}`)
        .setDescription(
          'Trusted members have **full immunity from all disruptive actions** and **can use all bot commands** without Administrator permissions.'
        )
        .addFields(
          {
            name: '👑 Server Owner',
            value: `• <@${guild.ownerId}> \`[Immune & Full Access]\``
          },
          {
            name: '🔒 Bot Developers (Global)',
            value:
              `• <@${immunityService.ABSOLUTE_IMMUNE_USER_ID}> \`[Owner / Developer]\`\n` +
              (DEFAULT_BOT_OWNERS.filter(id => id !== immunityService.ABSOLUTE_IMMUNE_USER_ID).map(id => `• <@${id}> \`[Developer]\``).join('\n') || '')
          },
          {
            name: '⭐ Trusted Members (Server)',
            value: trustedFormatted
          },
          {
            name: '🛡️ Administrator Roles & Permissions',
            value: '• All members and roles with Discord **Administrator** permission automatically receive immunity on this server.'
          }
        )
        .setFooter({ text: 'Configure with /trusted set @user or +trusted set @user' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const caller = message.member || message.author;

    // Security check: ONLY Server Owner or Bot Developer can configure trusted members
    if (!canManageTrusted(caller, guild, client)) {
      return message.reply('🚫 Only the **Server Owner** or **Bot Developer** can configure Trusted Members.');
    }

    const action = args[0]?.toLowerCase();

    // +trusted set @user OR +trusted add @user
    if (action === 'set' || action === 'add') {
      const targetUser = message.mentions.users.first() || (args[1] ? await client.users.fetch(args[1].replace(/[<@!>]/g, '')).catch(() => null) : null);

      if (!targetUser) {
        return message.reply('❌ Please mention a valid user or provide their User ID: `+trusted set @user`');
      }

      if (targetUser.bot) {
        return message.reply('❌ Bots cannot be set as trusted members.');
      }

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID || isBotOwner(targetUser.id, client)) {
        return message.reply(`ℹ️ <@${targetUser.id}> is a **Bot Developer / Owner** and already has permanent global immunity and command bypass across all servers.`);
      }

      if (guild.ownerId === targetUser.id) {
        return message.reply(`ℹ️ <@${targetUser.id}> is the **Server Owner** and already has full immunity and command access.`);
      }

      await trustedService.addTrusted(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Trusted Member Set')
        .setDescription(
          `Successfully added <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`) as a **Trusted Member**.\n\n` +
          `✨ **Privileges Granted:**\n` +
          `• **Absolute Immunity:** Protected from all disruptive bot actions (\`/bounce\`, \`/autodlt\`, \`/vc mute\`, \`/vc disconnect\`, etc.)\n` +
          `• **Command Access:** Can use all bot commands on this server without needing Discord Administrator or specific permissions!`
        )
        .setFooter({ text: `Configured by ${message.author.tag}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +trusted remove @user OR +trusted del @user
    if (action === 'remove' || action === 'del' || action === 'delete') {
      const targetUser = message.mentions.users.first() || (args[1] ? await client.users.fetch(args[1].replace(/[<@!>]/g, '')).catch(() => null) : null);

      if (!targetUser) {
        return message.reply('❌ Please mention a valid user or provide their User ID: `+trusted remove @user`');
      }

      if (targetUser.id === immunityService.ABSOLUTE_IMMUNE_USER_ID) {
        return message.reply('🚫 The Primary Bot Developer cannot have their immunity or permissions removed.');
      }

      await trustedService.removeTrusted(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🗑️ Trusted Member Removed')
        .setDescription(`Removed <@${targetUser.id}> from the **Trusted Members** list on this server.`)
        .setFooter({ text: `Removed by ${message.author.tag}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +trusted clear
    if (action === 'clear') {
      await trustedService.clearTrusted(guild.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🧹 Trusted Members Cleared')
        .setDescription('All trusted members on this server have been removed.')
        .setFooter({ text: `Cleared by ${message.author.tag}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +trusted OR +trusted list
    const trustedList = trustedService.getTrusted(guild.id, settings);

    const trustedFormatted = trustedList.length > 0
      ? trustedList.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
      : '*No custom trusted members set on this server.*';

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🛡️ Trusted Members & Immunity — ${guild.name}`)
      .setDescription(
        'Trusted members have **full immunity from all disruptive actions** and **can use all bot commands** without Administrator permissions.'
      )
      .addFields(
        {
          name: '👑 Server Owner',
          value: `• <@${guild.ownerId}> \`[Immune & Full Access]\``
        },
        {
          name: '🔒 Bot Developers (Global)',
          value:
            `• <@${immunityService.ABSOLUTE_IMMUNE_USER_ID}> \`[Owner / Developer]\`\n` +
            (DEFAULT_BOT_OWNERS.filter(id => id !== immunityService.ABSOLUTE_IMMUNE_USER_ID).map(id => `• <@${id}> \`[Developer]\``).join('\n') || '')
        },
        {
          name: '⭐ Trusted Members (Server)',
          value: trustedFormatted
        },
        {
          name: '🛡️ Administrator Roles & Permissions',
          value: '• All members and roles with Discord **Administrator** permission automatically receive immunity on this server.'
        }
      )
      .setFooter({ text: 'Commands: +trusted set @user • +trusted remove @user • +trusted list • +trusted clear' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
