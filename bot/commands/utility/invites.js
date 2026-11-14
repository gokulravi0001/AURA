const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Invite = require('../../../models/Invite');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const inviteService = require('../../modules/inviteService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('View, track, or manage server invites')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your or another member\'s invite stats')
        .addUserOption(opt => opt.setName('user').setDescription('Target member (leave empty to view your own)'))
    )
    .addSubcommand(sub =>
      sub.setName('top')
        .setDescription('View the top inviters leaderboard for this server')
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Set the channel for invite join & leave tracking logs (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post invite announcements')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('app_channel')
            .setDescription('Optional dedicated channel to log who invited applicants before screening')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('prelog')
        .setDescription('Log who invited members before they accept the server application or rules (Admin only)')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable pre-application invite logging').setRequired(false))
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Dedicated channel to log who invited applicants before screening')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add bonus invites to a member (Admin only)')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of bonus invites to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove bonus invites from a member (Admin only)')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Number of bonus invites to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset all invites for a member (Admin only)')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('guard')
        .setDescription('Configure exclusive Inviter role requirements (Admin only)')
        .addRoleOption(opt => opt.setName('role').setDescription('Role required to create and share invites').setRequired(false))
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable inviter role guard').setRequired(false))
    ),
  name: 'invites',
  description: 'View or manage server invites',
  aliases: ['inv', 'invite'],
  module: 'invite_tracker',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // 1. VIEW
    if (sub === 'view') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const embed = await buildInviteStatsEmbed(interaction.guild, targetUser);
      return interaction.reply({ embeds: [embed] });
    }

    // 2. TOP
    if (sub === 'top') {
      const embed = await buildInviteLeaderboardEmbed(interaction.guild);
      return interaction.reply({ embeds: [embed] });
    }

    // Admin / privileged checks for management subcommands
    if (!isOwnerOrAdmin(interaction.member, interaction.guild, client, settings)) {
      return interaction.reply({ content: '🚫 Administrator, Server Owner, or Whitelisted permissions required.', ephemeral: true });
    }

    // 2.5. GUARD
    if (sub === 'guard') {
      const role = interaction.options.getRole('role');
      const enabledOpt = interaction.options.getBoolean('enabled');

      if (!role && enabledOpt === null) {
        const guard = settings?.inviteGuard;
        const isEnabled = guard?.enabled && guard?.roleId;
        const embed = new EmbedBuilder()
          .setColor(isEnabled ? COLORS.PRIMARY : COLORS.WARNING)
          .setTitle('🛡️ Inviter Role Guard Status')
          .setDescription(
            isEnabled
              ? `**Status:** 🟢 **Active**\n• **Required Role:** <@&${guard.roleId}>\n• *Members without this role cannot generate invite links.*`
              : `**Status:** 🔴 **Disabled**\nUse \`/inviterole set role:@Role\` or \`/invites guard role:@Role\` to enable.`
          );
        return interaction.reply({ embeds: [embed] });
      }

      const updateData = {};
      if (role) {
        updateData['inviteGuard.roleId'] = role.id;
        updateData['inviteGuard.enabled'] = true;
        updateData['modules.invite_guard'] = true;
      }
      if (enabledOpt !== null) {
        updateData['inviteGuard.enabled'] = enabledOpt;
      }

      const updated = await Guild.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { upsert: true, new: true }
      );

      if (role) {
        await inviteService.syncInvitePermissions(interaction.guild, role.id);
        await inviteService.purgeUnauthorizedInvites(interaction.guild, updated, client);
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🛡️ Inviter Role Guard Updated')
            .setDescription(
              role
                ? `Only members with the <@&${role.id}> role can now generate invite links or invite people to this server!`
                : `Inviter Role Guard is now ${enabledOpt ? '🟢 Enabled' : '🔴 Disabled'}.`
            )
        ]
      });
    }

    // 3. SETUP
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const appChannel = interaction.options.getChannel('app_channel');

      const updateData = {
        'modules.invite_tracker': true,
        'inviteTracker.enabled': true,
        'inviteTracker.channelId': channel.id
      };
      if (appChannel) {
        updateData['inviteTracker.applicationChannelId'] = appChannel.id;
      }

      await Guild.updateOne({ guildId }, { $set: updateData }, { upsert: true });

      const desc = appChannel
        ? `• **General Invite Logs:** <#${channel.id}>\n• **Pre-Application Invite Logs:** <#${appChannel.id}>\n\nMembers joining via invite will be logged with their inviter immediately, even before they accept the server application or rules!`
        : `Invite join/leave logs will be announced in <#${channel.id}>.\nWho invited incoming members will also be logged here before they accept the server application!`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('📈 Invite Tracker Configured')
            .setDescription(desc)
        ]
      });
    }

    // 3.5. PRELOG (Log who invited who before accepting server application)
    if (sub === 'prelog') {
      const enabledOpt = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');

      const updateData = {};
      if (enabledOpt !== null) updateData['inviteTracker.logPreScreening'] = enabledOpt;
      if (channel) updateData['inviteTracker.applicationChannelId'] = channel.id;

      if (Object.keys(updateData).length === 0) {
        const tracker = settings?.inviteTracker;
        const appChan = tracker?.applicationChannelId ? `<#${tracker.applicationChannelId}>` : (tracker?.channelId ? `<#${tracker.channelId}>` : '*None set*');
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.PRIMARY)
              .setTitle('📋 Pre-Application Invite Log Status')
              .setDescription(
                `• **Status:** ${tracker?.logPreScreening !== false ? '🟢 **Enabled**' : '🔴 **Disabled**'}\n` +
                `• **Log Channel:** ${appChan}\n\n` +
                `*When enabled, incoming members arriving via an invite link are logged immediately with their inviter before they complete screening or accept the server application.*`
              )
          ]
        });
      }

      await Guild.updateOne({ guildId }, { $set: updateData }, { upsert: true });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('📋 Pre-Application Invite Logging Updated')
            .setDescription(
              `Pre-application invite logging updated!\n` +
              (channel ? `• Dedicated channel set to: <#${channel.id}>\n` : '') +
              (enabledOpt !== null ? `• Status: ${enabledOpt ? '🟢 Enabled' : '🔴 Disabled'}` : '')
            )
        ]
      });
    }

    // 4. ADD BONUS INVITES
    if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (amount <= 0) {
        return interaction.reply({ content: '❌ Amount must be greater than 0.', ephemeral: true });
      }

      const record = await Invite.findOneAndUpdate(
        { guildId, userId: targetUser.id },
        { $inc: { bonus: amount } },
        { upsert: true, new: true }
      );

      return interaction.reply({
        content: `✨ Added **+${amount}** bonus invites to <@${targetUser.id}>! They now have **${record.total}** total invites.`
      });
    }

    // 5. REMOVE BONUS INVITES
    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (amount <= 0) {
        return interaction.reply({ content: '❌ Amount must be greater than 0.', ephemeral: true });
      }

      const record = await Invite.findOneAndUpdate(
        { guildId, userId: targetUser.id },
        { $inc: { bonus: -amount } },
        { upsert: true, new: true }
      );

      return interaction.reply({
        content: `🗑️ Deducted **-${amount}** bonus invites from <@${targetUser.id}>. They now have **${record.total}** total invites.`
      });
    }

    // 6. RESET
    if (sub === 'reset') {
      const targetUser = interaction.options.getUser('user');
      await Invite.deleteOne({ guildId, userId: targetUser.id });
      return interaction.reply({
        content: `🔄 Reset all invite records for <@${targetUser.id}>.`
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();
    const guildId = message.guild.id;

    // +inv top
    if (action === 'top' || action === 'lb' || action === 'leaderboard') {
      const embed = await buildInviteLeaderboardEmbed(message.guild);
      return message.reply({ embeds: [embed] });
    }

    // +inv guard @role / +inv guard off
    if (action === 'guard') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const role = message.mentions.roles.first();
      const subOpt = args[1]?.toLowerCase();

      if (subOpt === 'off' || subOpt === 'disable') {
        await Guild.updateOne({ guildId }, { $set: { 'inviteGuard.enabled': false } });
        return message.reply('🔓 Inviter Role Guard disabled.');
      }

      if (!role) {
        const guard = settings?.inviteGuard;
        return message.reply(
          guard?.enabled && guard?.roleId
            ? `🛡️ Inviter Role Guard is currently **Active** for <@&${guard.roleId}>.`
            : '🛡️ Inviter Role Guard is currently **Disabled**. Usage: `+inv guard @Role`'
        );
      }

      const updated = await Guild.findOneAndUpdate(
        { guildId },
        {
          $set: {
            'modules.invite_guard': true,
            'inviteGuard.enabled': true,
            'inviteGuard.roleId': role.id,
            'inviteGuard.blockChatInvites': true
          }
        },
        { upsert: true, new: true }
      );

      await inviteService.syncInvitePermissions(message.guild, role.id);
      await inviteService.purgeUnauthorizedInvites(message.guild, updated, client);

      return message.reply(`🛡️ Inviter Role Guard activated! Only members with <@&${role.id}> can now create or share invites.`);
    }

    // +inv setup #channel [#app-log-channel]
    if (action === 'setup') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const channels = message.mentions.channels;
      const channel = channels.first();
      if (!channel) {
        return message.reply('❌ Usage: `+inv setup #channel [#application-log-channel]`');
      }

      const appChannel = channels.size > 1 ? Array.from(channels.values())[1] : null;

      const updateData = {
        'modules.invite_tracker': true,
        'inviteTracker.enabled': true,
        'inviteTracker.channelId': channel.id
      };
      if (appChannel) {
        updateData['inviteTracker.applicationChannelId'] = appChannel.id;
      }

      await Guild.updateOne({ guildId }, { $set: updateData }, { upsert: true });

      const replyText = appChannel
        ? `📈 Invite Tracker configured!\n• **General Invite Logs:** <#${channel.id}>\n• **Pre-Application Invite Logs:** <#${appChannel.id}> (logs who invited applicants before screening)`
        : `📈 Invite Tracker configured! Join/leave logs (including pre-application logs) will be announced in <#${channel.id}>.`;

      return message.reply(replyText);
    }

    // +inv prelog [on|off] [#channel]
    if (action === 'prelog') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const channel = message.mentions.channels.first();
      const subOpt = args[1]?.toLowerCase();

      const updateData = {};
      if (subOpt === 'on' || subOpt === 'enable') updateData['inviteTracker.logPreScreening'] = true;
      if (subOpt === 'off' || subOpt === 'disable') updateData['inviteTracker.logPreScreening'] = false;
      if (channel) updateData['inviteTracker.applicationChannelId'] = channel.id;

      if (Object.keys(updateData).length === 0) {
        const tracker = settings?.inviteTracker;
        const appChan = tracker?.applicationChannelId ? `<#${tracker.applicationChannelId}>` : (tracker?.channelId ? `<#${tracker.channelId}>` : '*None set*');
        return message.reply(
          `📋 **Pre-Application Invite Log Status:**\n` +
          `• **Status:** ${tracker?.logPreScreening !== false ? '🟢 **Enabled**' : '🔴 **Disabled**'}\n` +
          `• **Channel:** ${appChan}\n` +
          `Usage: \`+inv prelog on #channel\` or \`+inv prelog off\``
        );
      }

      await Guild.updateOne({ guildId }, { $set: updateData }, { upsert: true });
      return message.reply(`📋 Pre-Application Invite Logging updated! (Channel: ${channel ? `<#${channel.id}>` : 'Default invite channel'})`);
    }

    // +inv add @user <amount>
    if (action === 'add') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[2], 10);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply('❌ Usage: `+inv add @user <amount>`');
      }

      const record = await Invite.findOneAndUpdate(
        { guildId, userId: targetUser.id },
        { $inc: { bonus: amount } },
        { upsert: true, new: true }
      );

      return message.reply(`✨ Added **+${amount}** bonus invites to <@${targetUser.id}>! Total: **${record.total}**.`);
    }

    // +inv remove @user <amount>
    if (action === 'remove') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[2], 10);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply('❌ Usage: `+inv remove @user <amount>`');
      }

      const record = await Invite.findOneAndUpdate(
        { guildId, userId: targetUser.id },
        { $inc: { bonus: -amount } },
        { upsert: true, new: true }
      );

      return message.reply(`🗑️ Deducted **-${amount}** bonus invites from <@${targetUser.id}>. Total: **${record.total}**.`);
    }

    // +inv reset @user
    if (action === 'reset') {
      if (!isOwnerOrAdmin(message.member, message.guild, client, settings)) {
        return message.reply('🚫 Administrator, Server Owner, or Whitelisted permissions required.');
      }
      const targetUser = message.mentions.users.first();
      if (!targetUser) return message.reply('❌ Usage: `+inv reset @user`');

      await Invite.deleteOne({ guildId, userId: targetUser.id });
      return message.reply(`🔄 Reset all invite records for <@${targetUser.id}>.`);
    }

    // Default: view user stats (e.g. +inv or +inv @user)
    const targetUser = message.mentions.users.first() || message.author;
    const embed = await buildInviteStatsEmbed(message.guild, targetUser);
    return message.reply({ embeds: [embed] });
  }
};

async function buildInviteStatsEmbed(guild, user) {
  const record = await Invite.findOne({ guildId: guild.id, userId: user.id });

  const regular = record?.regular || 0;
  const bonus = record?.bonus || 0;
  const left = record?.left || 0;
  const fake = record?.fake || 0;
  const total = Math.max(0, (regular + bonus) - left - fake);

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({ name: `${user.username}'s Invites`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(`**${user.username}** currently has **${total}** invites!`)
    .addFields(
      { name: '✨ Regular', value: `\`${regular}\``, inline: true },
      { name: '🎁 Bonus', value: `\`${bonus}\``, inline: true },
      { name: '📤 Left', value: `\`${left}\``, inline: true },
      { name: '⚠️ Fake / Alt', value: `\`${fake}\``, inline: true }
    )
    .setFooter({ text: `${guild.name} • Invite Tracker` })
    .setTimestamp();
}

async function buildInviteLeaderboardEmbed(guild) {
  const records = await Invite.find({ guildId: guild.id });

  // Compute total for all records and sort descending
  const sorted = records
    .map(r => ({
      userId: r.userId,
      regular: r.regular,
      bonus: r.bonus,
      left: r.left,
      fake: r.fake,
      total: Math.max(0, (r.regular + r.bonus) - r.left - r.fake)
    }))
    .filter(r => r.total > 0 || r.regular > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (!sorted.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`📈 ${guild.name} Top Inviters`)
      .setDescription('No invites recorded yet! Create an invite and share it to appear on the leaderboard.')
      .setFooter({ text: 'AURA Invite Tracker' });
  }

  const medals = ['🥇', '🥈', '🥉'];
  let list = '';

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const medal = medals[i] || `\`#${i + 1}\``;
    list += `${medal} <@${s.userId}> ➔ **${s.total}** invites *(${s.regular} reg, ${s.bonus} bonus, ${s.left} left)*\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📈 ${guild.name} Top Inviters Leaderboard`)
    .setDescription(list)
    .setFooter({ text: 'Top 10 Inviters • Keep inviting to stay on top!' })
    .setTimestamp();
}
