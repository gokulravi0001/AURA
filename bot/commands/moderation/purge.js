const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');
const { hasPermissionOrOwner } = require('../../../shared/permissionHelper');
const immunityService = require('../../../shared/immunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages or clean up spam bot aftermath')
    .addSubcommand(sub =>
      sub.setName('after')
        .setDescription('Delete all messages sent after (and including) a specific message ID')
        .addStringOption(opt =>
          opt.setName('message_id')
            .setDescription('The ID of the message to purge from')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('include_message')
            .setDescription('Also delete the specified message itself (default: true)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('bots_only')
            .setDescription('Only delete bot & webhook messages in that range (default: false)')
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
  description: 'Delete messages or clean up spam bot messages after a replied message',
  aliases: ['clear', 'clean', 'prune'],
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction, client, settings) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    // Check user permission (Bypassed for Bot Developers / Owners)
    const hasUserPerm = hasPermissionOrOwner(interaction.member || interaction.user, PermissionsBitField.Flags.ManageMessages, client);
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
      const includeTarget = interaction.options.getBoolean('include_message') !== false; // Default: true!
      const botsOnly = interaction.options.getBoolean('bots_only') || false;

      if (!/^\d{17,20}$/.test(messageId)) {
        return interaction.reply({ content: '❌ Invalid Message ID. Discord message IDs are 17-20 digit numbers.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await purgeAfter(channel, messageId, includeTarget, null, botsOnly);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🧹 Spam & Message Cleanup Completed!')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} (including bot and spam messages) starting from message \`${messageId}\`!` +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted due to Discord limits.*` : '')
            : `⚠️ No messages found to delete starting from message \`${messageId}\`.`
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'messages') {
      const amount = interaction.options.getInteger('amount');
      const targetUser = interaction.options.getUser('user');
      const botsOnly = interaction.options.getBoolean('bots_only') || false;

      if (targetUser && immunityService.isImmune(targetUser.id, guild, client)) {
        return interaction.reply({
          content: `🛡️ **Immunity Protected**: <@${targetUser.id}> possesses **Immunity** and their messages cannot be targeted for deletion (even by the Server Owner).`,
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const fetched = await channel.messages.fetch({ limit: Math.min(amount + 10, 100) });
      let toDelete = [...fetched.values()];

      // Shield permanently immune user's messages from deletion
      toDelete = toDelete.filter(m => !immunityService.isAbsoluteImmune(m.author.id));

      if (targetUser) {
        toDelete = toDelete.filter(m => m.author.id === targetUser.id);
      }
      if (botsOnly) {
        toDelete = toDelete.filter(m => m.author.bot || m.webhookId);
      }

      toDelete = toDelete.slice(0, amount);
      const result = await executeBatchDelete(channel, toDelete);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Purge Completed')
        .setDescription(
          `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'}!` +
          (targetUser ? ` *(Filtered to ${targetUser})*` : '') +
          (botsOnly ? ' *(Filtered to bot/spam messages)*' : '') +
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

    // Check user permission (Bypassed for Bot Developers / Owners)
    const hasUserPerm = hasPermissionOrOwner(message.member || message.author, PermissionsBitField.Flags.ManageMessages, client);
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
    // Wipes out the spam bot aftermath: deletes that message itself + all messages sent after it (including bot messages)
    if (message.reference?.messageId) {
      const targetMessageId = message.reference.messageId;
      const excludeTarget = args.some(a => ['exclude', 'keep', 'without'].includes(a.toLowerCase()));
      const includeTarget = !excludeTarget; // Default to TRUE so the target spam message is wiped out!
      const botsOnly = args.some(a => ['bot', 'bots'].includes(a.toLowerCase()));

      const result = await purgeAfter(channel, targetMessageId, includeTarget, message.id, botsOnly);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🧹 Spam & Message Cleanup Completed!')
        .setDescription(
          result.count > 0
            ? `Successfully purged **${result.count}** message${result.count === 1 ? '' : 's'} (including all bot, webhook & user messages)!` +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted due to Discord limits.*` : '')
            : '⚠️ No messages found to delete after the replied message.'
        )
        .setFooter({ text: `Cleaned up by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 2. Direct Spam/Bot Purge: +purge bots [amount] OR +purge spam [amount]
    const isBotArg = args.some(a => ['bot', 'bots', 'spam'].includes(a.toLowerCase()));
    if (isBotArg) {
      const numArg = args.find(a => !isNaN(parseInt(a, 10)));
      const amount = numArg ? Math.min(100, Math.max(1, parseInt(numArg, 10))) : 50;

      await message.delete().catch(() => {});

      const fetched = await channel.messages.fetch({ limit: 100 });
      const toDelete = [...fetched.values()]
        .filter(m => m.author.bot || m.webhookId)
        .slice(0, amount);

      const result = await executeBatchDelete(channel, toDelete);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🤖 Bot & Spam Cleanup Completed!')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** bot/spam message${result.count === 1 ? '' : 's'}!`
            : '⚠️ No bot or spam messages found in recent history.'
        )
        .setFooter({ text: `Cleaned up by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 3. Message ID as argument: +purge <message_id>
    if (args[0] && /^\d{17,20}$/.test(args[0])) {
      const targetMessageId = args[0];
      const excludeTarget = args.some(a => ['exclude', 'keep', 'without'].includes(a.toLowerCase()));
      const includeTarget = !excludeTarget;
      const botsOnly = args.some(a => ['bot', 'bots'].includes(a.toLowerCase()));

      const result = await purgeAfter(channel, targetMessageId, includeTarget, message.id, botsOnly);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🧹 Spam & Message Cleanup Completed!')
        .setDescription(
          result.count > 0
            ? `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} (including bot messages) starting from message \`${targetMessageId}\`!` +
              (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted.*` : '')
            : `⚠️ No messages found after message \`${targetMessageId}\`.`
        )
        .setFooter({ text: `Cleaned up by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 4. Count Purge: +purge <number> [@user]
    const countArg = parseInt(args[0], 10);
    if (!isNaN(countArg) && countArg > 0) {
      const amount = Math.min(100, countArg);
      const targetUser = message.mentions.users.first();

      if (targetUser && immunityService.isImmune(targetUser.id, guild, client)) {
        return message.reply(`🛡️ **Immunity Protected**: <@${targetUser.id}> possesses **Immunity** and their messages cannot be targeted for deletion (even by the Server Owner).`);
      }

      // Delete the command message first
      await message.delete().catch(() => {});

      const fetched = await channel.messages.fetch({ limit: Math.min(amount + 15, 100) });
      let toDelete = [...fetched.values()];

      // Shield permanently immune user's messages from deletion
      toDelete = toDelete.filter(m => !immunityService.isAbsoluteImmune(m.author.id));

      if (targetUser) {
        toDelete = toDelete.filter(m => m.author.id === targetUser.id);
      }

      toDelete = toDelete.slice(0, amount);
      const result = await executeBatchDelete(channel, toDelete);

      const embed = new EmbedBuilder()
        .setColor(result.count > 0 ? COLORS.SUCCESS : COLORS.WARNING)
        .setTitle('🗑️ Messages Purged!')
        .setDescription(
          `Successfully deleted **${result.count}** message${result.count === 1 ? '' : 's'} (including all bot & user messages)!` +
          (targetUser ? ` *(Filtered to ${targetUser})*` : '') +
          (result.olderThan14Days > 0 ? `\n⚠️ *${result.olderThan14Days} message(s) older than 14 days could not be bulk deleted.*` : '')
        )
        .setFooter({ text: `Purged by ${message.author.username}` })
        .setTimestamp();

      const confirm = await channel.send({ embeds: [embed] });
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
      return;
    }

    // 5. No reply and no valid count provided: Show interactive usage guide
    const guideEmbed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🧹 AURA Spam Cleaner & Purge Guide')
      .setDescription(
        `### How to Clear Spam Bot Aftermath\n` +
        `• **Reply Purge (Recommended):** Click **Reply** on the first spam message (or any message) and type **\`${prefix}purge\`** — AURA deletes that message and **all** messages sent after it (including all bot messages, webhooks, embeds, and user messages)!\n` +
        `• **Instant Bot/Spam Cleanup:** Type **\`${prefix}purge bots\`** or **\`${prefix}purge spam [amount]\`** to clear recent spam bot messages.\n` +
        `• **Delete Last N Messages:** **\`${prefix}purge 25\`** *(deletes last 25 messages, including bot messages)*\n` +
        `• **Filter by User:** **\`${prefix}purge 25 @user\`**\n` +
        `• **Slash Command:** \`/purge after message_id:<id>\` or \`/purge messages amount:<n>\``
      )
      .setFooter({ text: 'This notice will auto-delete in 10 seconds' })
      .setTimestamp();

    const guideMsg = await message.reply({ embeds: [guideEmbed] });
    setTimeout(() => guideMsg.delete().catch(() => {}), 10000);
  }
};

/**
 * Purge all messages strictly after (or including) a target message ID
 * Includes bot messages, webhook messages, embeds, and user messages
 * @param {import('discord.js').TextChannel} channel
 * @param {string} targetMessageId
 * @param {boolean} includeTarget
 * @param {string|null} commandMessageId
 * @param {boolean} botsOnly
 */
async function purgeAfter(channel, targetMessageId, includeTarget = true, commandMessageId = null, botsOnly = false) {
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
          if (!botsOnly || (msg.author.bot || msg.webhookId)) {
            messagesToDelete.push(msg);
          }
        }
        reachedTarget = true;
        break;
      }

      if (BigInt(msg.id) > BigInt(targetMessageId)) {
        if (!botsOnly || (msg.author.bot || msg.webhookId)) {
          messagesToDelete.push(msg);
        }
      } else {
        reachedTarget = true;
        break;
      }
    }

    if (reachedTarget) break;
    oldestFetchedId = batch.last()?.id;
    if (!oldestFetchedId) break;
  }

  // Ensure target message is included if requested and not yet added
  if (includeTarget && !messagesToDelete.some(m => m.id === targetMessageId)) {
    const targetMsg = await channel.messages.fetch(targetMessageId).catch(() => null);
    if (targetMsg && (!botsOnly || (targetMsg.author.bot || targetMsg.webhookId))) {
      messagesToDelete.push(targetMsg);
    }
  }

  // Ensure the command message itself is cleaned up
  if (commandMessageId && !messagesToDelete.some(m => m.id === commandMessageId)) {
    const cmdMsg = await channel.messages.fetch(commandMessageId).catch(() => null);
    if (cmdMsg) messagesToDelete.push(cmdMsg);
  }

  // Filter out messages from permanently immune developer
  const filteredToDelete = messagesToDelete.filter(m => !immunityService.isAbsoluteImmune(m.author?.id));
  return executeBatchDelete(channel, filteredToDelete);
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

  // Deduplicate by message ID
  const uniqueMap = new Map();
  for (const m of messages) {
    if (m && m.id) uniqueMap.set(m.id, m);
  }
  const uniqueMessages = [...uniqueMap.values()];

  const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
  const eligibleMessages = [];
  let olderCount = 0;

  for (const msg of uniqueMessages) {
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
