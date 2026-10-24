const StickyMessage = require('../../models/StickyMessage');
const logger = require('../../shared/logger');
const { EmbedBuilder } = require('discord.js');

// Lock map to prevent concurrent repost race conditions
const processingChannels = new Set();

const stickyService = {
  /**
   * Handle incoming message in a channel that might have a sticky message
   */
  async handleMessage(message, settings) {
    const channelId = message.channel.id;
    if (processingChannels.has(channelId)) return;

    try {
      const sticky = await StickyMessage.findOne({ channelId, enabled: true });
      if (!sticky) return;

      // Do not trigger on our own sticky message
      if (sticky.lastMessageId === message.id) return;

      sticky.messagesSinceLastPost += 1;

      // Check threshold and cooldown
      const now = Date.now();
      const lastPosted = sticky.lastPostedAt ? new Date(sticky.lastPostedAt).getTime() : 0;
      const cooldownMs = (sticky.cooldownSeconds || 4) * 1000;

      if (sticky.messagesSinceLastPost >= (sticky.messageThreshold || 2) && (now - lastPosted >= cooldownMs)) {
        processingChannels.add(channelId);
        await this.repostSticky(message.channel, sticky);
        processingChannels.delete(channelId);
      } else {
        await sticky.save();
      }
    } catch (err) {
      processingChannels.delete(channelId);
      logger.error('Error handling sticky message:', err.message);
    }
  },

  /**
   * Repost the sticky message at the bottom of the channel
   */
  async repostSticky(channel, sticky) {
    try {
      // 1. Delete previous sticky message if still present
      if (sticky.lastMessageId) {
        try {
          const oldMsg = await channel.messages.fetch(sticky.lastMessageId).catch(() => null);
          if (oldMsg && oldMsg.deletable) {
            await oldMsg.delete().catch(() => {});
          }
        } catch (e) {}
      }

      // 2. Prepare payload
      const payload = {};
      if (sticky.content) {
        payload.content = sticky.content;
      }

      if (sticky.embedData && (sticky.embedData.title || sticky.embedData.description)) {
        const embed = new EmbedBuilder()
          .setColor(sticky.embedData.color || '#9333ea');

        if (sticky.embedData.title) embed.setTitle(sticky.embedData.title);
        if (sticky.embedData.description) embed.setDescription(sticky.embedData.description);
        if (sticky.embedData.footer) embed.setFooter({ text: sticky.embedData.footer });

        payload.embeds = [embed];
      }

      if (!payload.content && !payload.embeds) return;

      // 3. Send new sticky message
      const sent = await channel.send(payload);
      sticky.lastMessageId = sent.id;
      sticky.lastPostedAt = new Date();
      sticky.messagesSinceLastPost = 0;
      await sticky.save();
    } catch (err) {
      logger.warn(`Could not repost sticky in channel ${channel.id}: ${err.message}`);
    }
  }
};

module.exports = stickyService;
