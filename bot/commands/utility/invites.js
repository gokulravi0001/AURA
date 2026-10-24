const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Invite = require('../../../models/Invite');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

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

    // Admin checks for management subcommands
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    // 3. SETUP
    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');

      await Guild.updateOne(
        { guildId },
        {
          $set: {
            'modules.invite_tracker': true,
            'inviteTracker.enabled': true,
            'inviteTracker.channelId': channel.id
          }
        },
        { upsert: true }
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('📈 Invite Tracker Configured')
            .setDescription(`Invite join and leave logs will now be announced in <#${channel.id}>!`)
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

    // +inv setup #channel
    if (action === 'setup') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }
      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply('❌ Usage: `+inv setup #channel`');
      }

      await Guild.updateOne(
        { guildId },
        {
          $set: {
            'modules.invite_tracker': true,
            'inviteTracker.enabled': true,
            'inviteTracker.channelId': channel.id
          }
        },
        { upsert: true }
      );

      return message.reply(`📈 Invite Tracker configured! Join/leave logs will be announced in <#${channel.id}>.`);
    }

    // +inv add @user <amount>
    if (action === 'add') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
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
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
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
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
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
