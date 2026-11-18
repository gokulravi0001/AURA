const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const emojiManager = require('../../modules/emojiManager');
const { COLORS } = require('../../../shared/constants');
const { hasPermissionOrOwner } = require('../../../shared/permissionHelper');

/**
 * Extract full content string (including attachment URLs) from a Discord message
 */
function extractMessageContent(msg) {
  if (!msg) return '';
  let text = msg.content || '';
  if (msg.attachments && msg.attachments.size > 0) {
    const urls = typeof msg.attachments.map === 'function'
      ? msg.attachments.map(a => a.url).join(' ')
      : Array.from(msg.attachments.values()).map(a => a.url).join(' ');
    text += ' ' + urls;
  }
  return text;
}

/**
 * Fetch a target message and all messages sent after/below it in the channel
 */
async function fetchTargetAndMessagesBelow(channel, targetMessageId, stopMessageId = null) {
  const messages = [];

  // 1. Fetch the target message that was replied to
  const targetMsg = await channel.messages.fetch(targetMessageId).catch(() => null);
  if (targetMsg) {
    messages.push(targetMsg);
  }

  // 2. Fetch all messages sent below/after it (paginated up to 300 messages)
  let lastId = targetMessageId;
  let reachedEnd = false;

  while (messages.length < 300 && !reachedEnd) {
    const batch = await channel.messages.fetch({ after: lastId, limit: 100 }).catch(() => null);
    if (!batch || batch.size === 0) break;

    // Discord returns messages newest first or oldest first with 'after'; sort chronologically
    const sorted = Array.from(batch.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const msg of sorted) {
      if (stopMessageId && msg.id === stopMessageId) {
        reachedEnd = true;
        break;
      }
      messages.push(msg);
      lastId = msg.id;
    }

    if (batch.size < 100) break;
  }

  return messages;
}

module.exports = {
  data: null,

  name: 'addemj',
  description: 'Reply to an emoji message with +addemj to add it and all emojis below it directly to your server',
  aliases: ['addemoji', 'emj', 'stealall', 'addemojis'],
  module: 'emoji_manager',

  async execute(interaction, client, settings) {
    const guild = interaction.guild;
    const channel = interaction.channel;

    // Check user permission (Bypassed for Bot Developers / Owners)
    const hasUserPerm = hasPermissionOrOwner(interaction.member || interaction.user, PermissionsBitField.Flags.ManageGuildExpressions, client);
    if (!hasUserPerm) {
      return interaction.reply({
        content: '🚫 You need the **Manage Expressions / Emojis** permission to add server emojis.',
        ephemeral: true
      });
    }

    // Check bot permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      return interaction.reply({
        content: '🚫 I need the **Manage Expressions / Emojis** permission in this server to add emojis.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const messageId = interaction.options.getString('message_id');
    const directEmojis = interaction.options.getString('emojis');

    let combinedText = '';

    if (messageId) {
      const messages = await fetchTargetAndMessagesBelow(channel, messageId.trim());
      combinedText = messages.map(m => extractMessageContent(m)).join(' ');
    }

    if (directEmojis) {
      combinedText += ' ' + directEmojis;
    }

    const parsed = emojiManager.parseEmojis(combinedText);
    if (parsed.length === 0) {
      return interaction.followUp({
        content: '❌ No custom emojis or image links found. Provide a valid message ID or paste custom emojis!',
        ephemeral: true
      });
    }

    let lastProgressUpdate = 0;
    const progressCallback = async (processed, total, added) => {
      const now = Date.now();
      if (now - lastProgressUpdate > 2500 || processed === total) {
        lastProgressUpdate = now;
        await interaction.editReply({
          content: `⏳ Adding emojis to **${guild.name}**... (**${processed}/${total}** processed, **${added}** added)`
        }).catch(() => {});
      }
    };

    const results = await emojiManager.uploadEmojis(guild, parsed, interaction.user, progressCallback);
    const embed = emojiManager.buildResultEmbed(results, guild, interaction.user);

    return interaction.editReply({ content: null, embeds: [embed] });
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const channel = message.channel;

    // Check user permission (Bypassed for Bot Developers / Owners)
    const hasUserPerm = hasPermissionOrOwner(message.member || message.author, PermissionsBitField.Flags.ManageGuildExpressions, client);
    if (!hasUserPerm) {
      return message.reply('🚫 You need the **Manage Expressions / Emojis** permission to add server emojis.');
    }

    // Check bot permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      return message.reply('🚫 I need the **Manage Expressions / Emojis** permission in this server to add emojis.');
    }

    let combinedText = extractMessageContent(message);

    // 1. PRIMARY USE CASE: Replied to a message with +addemj
    // Scans the replied message AND all messages sent below it in the channel
    if (message.reference?.messageId) {
      const targetMessageId = message.reference.messageId;
      const messages = await fetchTargetAndMessagesBelow(channel, targetMessageId, message.id);
      const belowText = messages.map(m => extractMessageContent(m)).join(' ');
      combinedText = belowText + ' ' + combinedText;
    } else if (args[0] && /^\d{17,20}$/.test(args[0])) {
      // User passed starting message ID as first argument: +addemj <message_id>
      const targetMessageId = args[0];
      const messages = await fetchTargetAndMessagesBelow(channel, targetMessageId, message.id);
      const belowText = messages.map(m => extractMessageContent(m)).join(' ');
      combinedText = belowText + ' ' + combinedText;
    } else if (args.length === 0 && message.attachments.size === 0) {
      // User typed +addemj without reply or args: inspect the message right before this one
      const recent = await channel.messages.fetch({ limit: 2 }).catch(() => null);
      if (recent && recent.size > 1) {
        const prevMsg = Array.from(recent.values())[1];
        if (prevMsg) {
          combinedText += ' ' + extractMessageContent(prevMsg);
        }
      }
    }

    const parsed = emojiManager.parseEmojis(combinedText);

    if (parsed.length === 0) {
      return message.reply(
        `❌ **No custom emojis found!**\n\n` +
        `💡 **How to use \`+addemj\`:**\n` +
        `• **Reply to any message with emojis:** Reply with \`+addemj\` and AURA will automatically add all emojis from that message and every message below it!\n` +
        `• **Direct paste:** \`+addemj <:emoji1:...> <:emoji2:...>\` to directly add multiple emojis.`
      );
    }

    // Send initial live progress tracker
    const statusMsg = await message.reply(
      `⏳ Found **${parsed.length}** emoji(s)! Adding all to **${guild.name}** as server emojis now...`
    );

    let lastProgressUpdate = 0;
    const progressCallback = async (processed, total, added) => {
      const now = Date.now();
      if (now - lastProgressUpdate > 2500 || processed === total) {
        lastProgressUpdate = now;
        await statusMsg.edit(
          `⏳ Adding emojis to server... (**${processed}/${total}** processed, **${added}** added)`
        ).catch(() => {});
      }
    };

    const results = await emojiManager.uploadEmojis(guild, parsed, message.author, progressCallback);
    const embed = emojiManager.buildResultEmbed(results, guild, message.author);

    return statusMsg.edit({ content: null, embeds: [embed] });
  }
};
