const logger = require('../../shared/logger');

const threadService = {
  /**
   * Check if a message qualifies as an image post and create thread
   */
  async handleImageMessage(message, settings) {
    if (message.hasThread) return; // Already has thread

    const isImageAttachment = message.attachments.some(att => {
      const contentType = att.contentType || '';
      return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(att.name || '');
    });

    const isImageEmbed = message.embeds.some(embed => embed.image || embed.thumbnail);

    if (!isImageAttachment && !isImageEmbed) {
      return; // Not an image post
    }

    try {
      const rawFormat = settings.imageThreads.threadNameFormat || '💬 Discussion - {author}';
      const threadName = rawFormat
        .replace(/{author}/g, message.author.username)
        .substring(0, 100); // Discord thread names max 100 chars

      const autoArchive = settings.imageThreads.autoArchiveDuration || 1440;

      await message.startThread({
        name: threadName,
        autoArchiveDuration: autoArchive,
        reason: 'AURA Auto-Image Thread'
      });

      logger.info(`Created image thread "${threadName}" in channel ${message.channel.id}`);
    } catch (err) {
      logger.warn(`Failed to create auto image thread: ${err.message}`);
    }
  }
};

module.exports = threadService;
