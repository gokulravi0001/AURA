const logger = require('../../shared/logger');
const { PermissionsBitField } = require('discord.js');

const threadService = {
  /**
   * Check if a message qualifies as an image post and create thread
   */
  async handleImageMessage(message, settings) {
    if (!message || !message.channel || !message.guild) return;
    if (message.hasThread) return; // Already has thread
    if (!message.channel.isTextBased() || message.channel.isThread()) return;

    // Check bot permissions
    const botMember = message.guild.members.me;
    if (!botMember) return;
    const perms = message.channel.permissionsFor(botMember);
    if (!perms || !perms.has([PermissionsBitField.Flags.CreatePublicThreads, PermissionsBitField.Flags.SendMessagesInThreads])) {
      logger.warn(`Missing CreatePublicThreads/SendMessagesInThreads permissions in ${message.channel.id}`);
      return;
    }

    const isImageAttachment = message.attachments.some(att => {
      const contentType = att.contentType || '';
      return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff)$/i.test(att.name || '');
    });

    const isImageEmbed = message.embeds.some(embed => embed.image || embed.thumbnail);

    const hasImageUrl = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))/i.test(message.content);
    const hasGifServiceUrl = /(https?:\/\/(?:tenor\.com|giphy\.com)\/[^\s]+)/i.test(message.content);

    if (!isImageAttachment && !isImageEmbed && !hasImageUrl && !hasGifServiceUrl) {
      return; // Not an image post
    }

    try {
      const rawFormat = settings?.imageThreads?.threadNameFormat || '💬 Discussion - {author}';
      const cleanAuthor = message.author.displayName || message.author.username;
      const threadName = rawFormat
        .replace(/{author}/g, cleanAuthor)
        .substring(0, 100); // Discord thread names max 100 chars

      const autoArchive = settings?.imageThreads?.autoArchiveDuration || 1440;

      await message.startThread({
        name: threadName,
        autoArchiveDuration: autoArchive,
        reason: 'AURA Auto-Image Thread'
      });

      logger.info(`Created image thread "${threadName}" in channel ${message.channel.id}`);
    } catch (err) {
      logger.warn(`Failed to create auto image thread in ${message.channel.id}: ${err.message}`);
    }
  }
};

module.exports = threadService;
