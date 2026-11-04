const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages or purge all messages after a specific message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('after')
        .setDescription('Delete all messages sent after a specific message ID')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('The ID of the message to purge after')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('include_message')
            .setDescription('Also delete the specified message itself (default: false)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('messages')
        .setDescription('Delete a specific number of recent messages')
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Number of messages to delete (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Only delete messages from this specific user')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('bots_only')
            .setDescription('Only delete messages sent by bots')
            .setRequired(false)
        )
    ),

  name: 'purge',
  description: 'Delete messages or purge all messages after a replied message',
  aliases: ['clear', 'clean', 'prune'],
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction, client, settings) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    // Check user permission
    const hasUserPerm = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasUserPerm) {
      return interaction.reply({ content: '🚫 You need the **Manage Messages** permission to use purge.', ephemeral: true });
    }

    // Check bot permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      return interaction.reply({ content: '🚫 I do not have the **Manage Messages** permission in this channel.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'after') {
      const messageId = interaction.options.getString('message_id').trim();
      const includeTarget = interaction.options.getBoolean('include_message') || false;

      if (!/^\d{17,20}$/.test(messageId)) {
        return interaction.reply({ content: '❌ Invalid Message ID. Discord message IDs are 17-20 digit numbers.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await purgeAfter(channel, messageId, includeTarget);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Purge Completed')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} sent after message \`${messageId}\`!` +
              (includeTarget ? ' *(Specified message was also deleted)*' : '') +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted due to Discord limits.*` : '')
            : `⚠️ No messages found after message \`${messageId}\`.`
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'messages') {
      const amount = interaction.options.getInteger('amount');
      const targetUser = interaction.options.getUser('user');
      const botsOnly = interaction.options.getBoolean('bots_only') || false;

      await interaction.deferReply({ ephemeral: true });

      const fetched = await channel.messages.fetch({ limit: Math.min(amount + 10, 100) });
      let toDelete = [...fetched.values()];

      if (targetUser) {
        toDelete = toDelete.filter(m => m.author.id === targetUser.id);
      }
      if (botsOnly) {
        toDelete = toDelete.filter(m => m.author.bot);
      }

      toDelete = toDelete.slice(0, amount);
      const result = await executeBatchDelete(channel, toDelete);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Purge Completed')
        .setDescription(
          `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'}!` +
          (targetUser ? ` *(Filtered to ${targetUser})*` : '') +
          (botsOnly ? ' *(Filtered to bot messages)*' : '') +
          (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted.*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed], ephemeral: true });
    }
  },

  async executePrefix(message, args, client, settings) {
    const channel = message.channel;
    const guild = message.guild;

    // Check user permission
    const hasUserPerm = message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                        message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasUserPerm) {
      const warn = await message.reply('🚫 You need the **Manage Messages** permission to use purge.');
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      return;
    }

    // Check bot permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      const warn = await message.reply('🚫 I do not have the **Manage Messages** permission in this channel.');
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      return;
    }

    const prefix = settings?.prefix || '+';

    // 1. PRIMARY USE CASE: Replying to a message with +purge
    // Deletes all messages sent after the replied-to message
    if (message.reference?.messageId) {
      const targetMessageId = message.reference.messageId;
      const includeTarget = args.some(a => ['include', 'with', 'all', 'true'].includes(a.toLowerCase()));

      const result = await purgeAfter(channel, targetMessageId, includeTarget, message.id);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Messages Purged!')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} sent after the replied message!` +
              (includeTarget ? ' *(Replied message was also deleted)*' : '') +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted due to Discord limits.*` : '')
            : '⚠️ No messages found after the replied message.'
        )
        .setFooter({ text: `Purged by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 2. Message ID as argument: +purge <message_id>
    if (args[0] && /^\d{17,20}$/.test(args[0])) {
      const targetMessageId = args[0];
      const includeTarget = args.some(a => ['include', 'with', 'all', 'true'].includes(a.toLowerCase()));

      const result = await purgeAfter(channel, targetMessageId, includeTarget, message.id);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Messages Purged!')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} sent after message \`${targetMessageId}\`!` +
              (includeTarget ? ' *(Specified message was also deleted)*' : '') +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted.*` : '')
            : `⚠️ No messages found after message \`${targetMessageId}\`.`
        )
        .setFooter({ text: `Purged by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 3. Count Purge: +purge <number> [@user|bots]
    const countArg = parseInt(args[0], 10);
    if (!isNaN(countArg) && countArg > 0) {
      const amount = Math.min(100, countArg);
      const targetUser = message.mentions.users.first();
      const botsOnly = args.some(a => ['bot', 'bots'].includes(a.toLowerCase()));

      // Delete the command message first or include it
      await message.delete().catch(() => {});

      const fetched = await channel.messages.fetch({ limit: Math.min(amount + 15, 100) });
      let toDelete = [...fetched.values()];

      if (targetUser) {
        toDelete = toDelete.filter(m => m.author.id === targetUser.id);
      }
      if (botsOnly) {
        toDelete = toDelete.filter(m => m.author.bot);
      }

      toDelete = toDelete.slice(0, amount);
      const result = await executeBatchDelete(channel, toDelete);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Messages Purged!')
        .setDescription(
          `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'}!` +
          (targetUser ? ` *(Filtered to ${targetUser})*` : '') +
          (botsOnly ? ' *(Filtered to bot messages)*' : '') +
          (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted.*` : '')
        )
        .setFooter({ text: `Purged by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 4. No reply and no valid count provided: Show interactive usage guide
    const guideEmbed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🗑️ AURA Purge & Clean Guide')
      .setDescription(
        `### How to Purge Messages\n` +
        `• **Reply Purge (Recommended):** Click **Reply** on any message and type **\`${prefix}purge\`** to delete all messages sent after it!\n` +
        `• **Reply & Include Target:** Reply with **\`${prefix}purge include\`** to delete the replied message as well!\n` +
        `• **Delete by Count:** Type **\`${prefix}purge 25\`** to delete the last 25 messages.\n` +
        `• **Filter by User:** Type **\`${prefix}purge 25 @user\`** to only delete messages from a specific user.\n` +
        `• **Filter Bots:** Type **\`${prefix}purge 25 bots\`** to clean up bot messages.\n` +
        `• **Slash Command:** \`/purge after message_id:<id>\` or \`/purge messages amount:<n>\``
      )
      .setFooter({ text: 'This notice will auto-delete in 10 seconds' })
      .setTimestamp();

    const guideMsg = await message.reply({ embeds: [guideEmbed] });
    setTimeout(() => guideMsg.delete().catch(() => {}), 10000);
  }
};

/**
 * Purge all messages strictly after a target message ID
 * @param {import('discord.js').TextChannel} channel
 * @param {string} targetMessageId
 * @param {boolean} includeTarget
 * @param {string|null} commandMessageId
 */
async function purgeAfter(channel, targetMessageId, includeTarget = false, commandMessageId = null) {
  const messagesToDelete = [];
  let oldestFetchedId = null;
  let reachedTarget = false;

  // Fetch batches backwards from newest to target (up to 500 messages)
  while (messagesToDelete.length < 500) {
    const fetchOptions = { limit: 100 };
    if (oldestFetchedId) {
      fetchOptions.before = oldestFetchedId;
    }

    const batch = await channel.messages.fetch(fetchOptions).catch(() => null);
    if (!batch || batch.size === 0) break;

    for (const msg of batch.values()) {
      if (msg.id === targetMessageId) {
        if (includeTarget) {
          messagesToDelete.push(msg);
        }
        reachedTarget = true;
        break;
      }

      if (BigInt(msg.id) > BigInt(targetMessageId)) {
        messagesToDelete.push(msg);
      } else {
        reachedTarget = true;
        break;
      }
    }

    if (reachedTarget) break;
    oldestFetchedId = batch.last()?.id;
    if (!oldestFetchedId) break;
  }

  // Ensure the command message itself is cleaned up if it was sent after target
  if (commandMessageId && !messagesToDelete.some(m => m.id === commandMessageId)) {
    const cmdMsg = await channel.messages.fetch(commandMessageId).catch(() => null);
    if (cmdMsg) messagesToDelete.push(cmdMsg);
  }

  return executeBatchDelete(channel, messagesToDelete);
}

/**
 * Execute batch deletion with 14-day limit handling
 * @param {import('discord.js').TextChannel} channel
 * @param {Array<import('discord.js').Message>} messages
 */
async function executeBatchDelete(channel, messages) {
  if (!messages || messages.length === 0) {
    return { count: 0, olderThan14Days: 0 };
  }

  const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
  const eligibleMessages = [];
  let olderCount = 0;

  for (const msg of messages) {
    if (msg.createdTimestamp < fourteenDaysAgo) {
      olderCount++;
    } else {
      eligibleMessages.push(msg);
    }
  }

  let totalDeleted = 0;

  if (eligibleMessages.length === 1) {
    try {
      await eligibleMessages[0].delete();
      totalDeleted = 1;
    } catch (_) {}
  } else if (eligibleMessages.length > 1) {
    // Delete in chunks of 100
    for (let i = 0; i < eligibleMessages.length; i += 100) {
      const chunk = eligibleMessages.slice(i, i + 100);
      try {
        const deleted = await channel.bulkDelete(chunk, true);
        totalDeleted += deleted.size;
      } catch (err) {
        // Fallback: delete individually
        for (const m of chunk) {
          try {
            await m.delete();
            totalDeleted++;
          } catch (_) {}
        }
      }
    }
  }

  return { count: totalDeleted, olderThan14Days: olderCount };
}
