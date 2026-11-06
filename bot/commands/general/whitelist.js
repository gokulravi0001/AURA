const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const whitelistService = require('../../../shared/whitelistService');
const { isBotOwner, canManageWhitelist } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Whitelist members to allow using all commands without administrator permissions')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Whitelist a member to let them use all commands without administrator perms')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member to whitelist')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('scope')
            .setDescription('Scope of whitelist (Server: this server, Global: all servers - Dev only)')
            .addChoices(
              { name: 'Server (This Server)', value: 'server' },
              { name: 'Global (All Servers - Bot Dev Only)', value: 'global' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a member from the whitelist')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member to remove from whitelist')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('scope')
            .setDescription('Scope to remove from (Server or Global)')
            .addChoices(
              { name: 'Server', value: 'server' },
              { name: 'Global', value: 'global' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Display all whitelisted members in this server and globally')
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all whitelisted members in this server')
    ),

  name: 'whitelist',
  description: 'Whitelist members to allow using all commands without administrator permissions',
  aliases: ['wl', 'whitelists'],

  async execute(interaction, client, settings) {
    const isDev = isBotOwner(interaction.user.id, client);
    const canManage = canManageWhitelist(interaction.member || interaction.user, interaction.guild, client);

    if (!canManage) {
      return interaction.reply({
        content: '🚫 The `/whitelist` command can only be used by the **Server Owner** or **Bot Developer**.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // 1. ADD
    if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');
      const scope = interaction.options.getString('scope') || 'server';

      if (scope === 'global' && !isDev) {
        return interaction.reply({
          content: '🚫 Only the **Bot Developer** can manage the Global Whitelist. You can whitelist members for this server by leaving scope as `Server`.',
          ephemeral: true
        });
      }

      if (scope === 'global') {
        await whitelistService.addGlobalWhitelist(targetUser.id, interaction.user.id, targetUser.tag);
      } else {
        await whitelistService.addServerWhitelist(guild.id, targetUser.id);
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Member Whitelisted')
        .setDescription(
          `Successfully added <@${targetUser.id}> (\`${targetUser.tag}\`) to the **${scope === 'global' ? 'Global' : 'Server'} Whitelist**!\n\n` +
          `✨ **Permissions Granted:**\n` +
          `• Can use **all commands** without requiring Administrator or Moderator permissions.\n` +
          `• Full access to voice controls (\`/bounce\`, \`/vc move\`, \`/vc disconnect\`, \`/vc mute\`, etc.), purge, and server management tools.\n` +
          `• **Scope:** ${scope === 'global' ? '🌐 **Global** (All Servers)' : `🏠 **Server** (${guild.name})`}`
        )
        .setFooter({ text: `Authorized by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. REMOVE
    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const scope = interaction.options.getString('scope') || 'server';

      if (scope === 'global' && !isDev) {
        return interaction.reply({
          content: '🚫 Only the **Bot Developer** can manage the Global Whitelist.',
          ephemeral: true
        });
      }

      if (scope === 'global') {
        await whitelistService.removeGlobalWhitelist(targetUser.id);
      } else {
        await whitelistService.removeServerWhitelist(guild.id, targetUser.id);
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🛡️ Member Removed from Whitelist')
        .setDescription(`Removed <@${targetUser.id}> (\`${targetUser.tag}\`) from the **${scope === 'global' ? 'Global' : 'Server'} Whitelist**.`)
        .setFooter({ text: `Action by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. CLEAR
    if (sub === 'clear') {
      await whitelistService.clearServerWhitelist(guild.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🛡️ Server Whitelist Cleared')
        .setDescription(`Cleared all whitelisted members for **${guild.name}**.`)
        .setFooter({ text: `Action by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 4. LIST
    if (sub === 'list') {
      const serverWhitelist = await whitelistService.getServerWhitelist(guild.id);
      const globalWhitelist = await whitelistService.getGlobalWhitelist();

      const serverFormatted = serverWhitelist.length > 0
        ? serverWhitelist.map((id, idx) => `**${idx + 1}.** <@${id}> (\`${id}\`)`).join('\n')
        : '*No members currently whitelisted in this server.*';

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🛡️ AURA Whitelist — ${guild.name}`)
        .setDescription('Whitelisted members are granted permission to run **all bot commands** without requiring Discord Administrator permissions.')
        .addFields({
          name: `🏠 Server Whitelist (${serverWhitelist.length})`,
          value: serverFormatted,
          inline: false
        });

      if (globalWhitelist.length > 0) {
        const globalFormatted = globalWhitelist
          .map((item, idx) => `**${idx + 1}.** <@${item.userId}> (\`${item.userId}\`)`)
          .join('\n');
        embed.addFields({
          name: `🌐 Global Whitelist (${globalWhitelist.length})`,
          value: globalFormatted,
          inline: false
        });
      }

      embed.setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
      embed.setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },

  async executePrefix(message, args, client, settings) {
    const isDev = isBotOwner(message.author.id, client);
    const canManage = canManageWhitelist(message.member || message.author, message.guild, client);

    if (!canManage) {
      return message.reply('🚫 The `+whitelist` command can only be used by the **Server Owner** or **Bot Developer**.');
    }

    const action = args[0]?.toLowerCase();
    const guild = message.guild;

    // +whitelist add @user [global]
    if (action === 'add') {
      const targetUser = message.mentions.users.first();
      const rawId = args[1]?.replace(/[<@!>]/g, '');
      const user = targetUser || (rawId ? await client.users.fetch(rawId).catch(() => null) : null);

      if (!user) {
        return message.reply(
          '❌ Please mention the user or provide their ID to whitelist!\n' +
          '• **Usage:** `+whitelist add @user`\n' +
          '• **Global (Dev only):** `+whitelist add @user global`'
        );
      }

      const isGlobal = args.slice(2).some(a => ['global', 'all', '-g'].includes(a.toLowerCase()));

      if (isGlobal && !isDev) {
        return message.reply('🚫 Only the **Bot Developer** can manage the Global Whitelist. Use `+whitelist add @user` to whitelist for this server.');
      }

      if (isGlobal) {
        await whitelistService.addGlobalWhitelist(user.id, message.author.id, user.tag);
      } else {
        await whitelistService.addServerWhitelist(guild.id, user.id);
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Member Whitelisted')
        .setDescription(
          `Successfully added <@${user.id}> (\`${user.tag}\`) to the **${isGlobal ? 'Global' : 'Server'} Whitelist**!\n\n` +
          `✨ **Permissions Granted:**\n` +
          `• Can use **all commands** without requiring Administrator or Moderator permissions.\n` +
          `• Full access to voice controls (\`+bounce\`, \`+vc move\`, \`+massdc\`, \`+massmute\`, etc.), purge, and server management tools.\n` +
          `• **Scope:** ${isGlobal ? '🌐 **Global** (All Servers)' : `🏠 **Server** (${guild.name})`}`
        )
        .setFooter({ text: `Authorized by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +whitelist remove @user [global]
    if (action === 'remove' || action === 'del' || action === 'delete') {
      const targetUser = message.mentions.users.first();
      const rawId = args[1]?.replace(/[<@!>]/g, '');
      const user = targetUser || (rawId ? await client.users.fetch(rawId).catch(() => null) : null);

      if (!user) {
        return message.reply('❌ Please mention the user or provide their ID to remove from whitelist: `+whitelist remove @user`');
      }

      const isGlobal = args.slice(2).some(a => ['global', 'all', '-g'].includes(a.toLowerCase()));

      if (isGlobal && !isDev) {
        return message.reply('🚫 Only the **Bot Developer** can manage the Global Whitelist.');
      }

      if (isGlobal) {
        await whitelistService.removeGlobalWhitelist(user.id);
      } else {
        await whitelistService.removeServerWhitelist(guild.id, user.id);
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🛡️ Member Removed from Whitelist')
        .setDescription(`Removed <@${user.id}> (\`${user.tag}\`) from the **${isGlobal ? 'Global' : 'Server'} Whitelist**.`)
        .setFooter({ text: `Action by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +whitelist clear
    if (action === 'clear' || action === 'reset') {
      await whitelistService.clearServerWhitelist(guild.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🛡️ Server Whitelist Cleared')
        .setDescription(`Cleared all whitelisted members for **${guild.name}**.`)
        .setFooter({ text: `Action by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Default: List (+whitelist or +whitelist list or +wl)
    const serverWhitelist = await whitelistService.getServerWhitelist(guild.id);
    const globalWhitelist = await whitelistService.getGlobalWhitelist();

    const serverFormatted = serverWhitelist.length > 0
      ? serverWhitelist.map((id, idx) => `**${idx + 1}.** <@${id}> (\`${id}\`)`).join('\n')
      : '*No members currently whitelisted in this server.*';

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🛡️ AURA Whitelist — ${guild.name}`)
      .setDescription('Whitelisted members are granted permission to run **all bot commands** without requiring Discord Administrator permissions.')
      .addFields({
        name: `🏠 Server Whitelist (${serverWhitelist.length})`,
        value: serverFormatted,
        inline: false
      });

    if (globalWhitelist.length > 0) {
      const globalFormatted = globalWhitelist
        .map((item, idx) => `**${idx + 1}.** <@${item.userId}> (\`${item.userId}\`)`)
        .join('\n');
      embed.addFields({
        name: `🌐 Global Whitelist (${globalWhitelist.length})`,
        value: globalFormatted,
        inline: false
      });
    }

    embed.setFooter({ text: `Use +whitelist add @user to whitelist a member` });
    embed.setTimestamp();

    return message.reply({ embeds: [embed] });
  }
};
