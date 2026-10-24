const StickyMessage = require('../../models/StickyMessage');
const logger = require('../../shared/logger');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// Debounce timers per channel
const channelTimers = new Map();
// In-flight repost locks
const repostLocks = new Set();
// Fast in-memory cache of channel IDs with active sticky messages
let activeStickyChannelIds = new Set();
let cacheLoaded = false;

const stickyService = {
  /**
   * Pre-load active sticky channel IDs into fast memory cache
   */
  async loadCache() {
    try {
      const stickies = await StickyMessage.find({ enabled: true }).select('channelId');
      activeStickyChannelIds = new Set(stickies.map(s => s.channelId));
      cacheLoaded = true;
    } catch (err) {
      logger.error('Failed to load sticky messages cache:', err.message);
    }
  },

  /**
   * Register or unregister channel in memory cache
   */
  updateCache(channelId, isEnabled) {
    if (isEnabled) {
      activeStickyChannelIds.add(channelId);
    } else {
      activeStickyChannelIds.delete(channelId);
      if (channelTimers.has(channelId)) {
        clearTimeout(channelTimers.get(channelId));
        channelTimers.delete(channelId);
      }
    }
  },

  /**
   * Handle incoming message in a channel
   */
  async handleMessage(message, settings) {
    if (!message || !message.channel || !message.channel.isTextBased()) return;

    const channelId = message.channel.id;

    // Fast check: is this channel known to have an active sticky message?
    if (cacheLoaded && !activeStickyChannelIds.has(channelId)) {
      return;
    }

    try {
      const sticky = await StickyMessage.findOne({ channelId, enabled: true });
      if (!sticky) {
        if (cacheLoaded) activeStickyChannelIds.delete(channelId);
        return;
      }

      // Ensure cache is synced
      activeStickyChannelIds.add(channelId);

      // Do not trigger on our own sticky message
      if (sticky.lastMessageId === message.id) return;

      // Reset existing debounce timer for this channel
      if (channelTimers.has(channelId)) {
        clearTimeout(channelTimers.get(channelId));
      }

      // Schedule repost with 1200ms debounce
      const timer = setTimeout(async () => {
        channelTimers.delete(channelId);
        if (repostLocks.has(channelId)) return;

        repostLocks.add(channelId);
        try {
          // Re-fetch latest sticky doc in case it was edited/removed
          const freshSticky = await StickyMessage.findOne({ channelId, enabled: true });
          if (!freshSticky) return;

          // Check if channel's last message is already our sticky message
          const recentMessages = await message.channel.messages.fetch({ limit: 1 }).catch(() => null);
          const lastMsg = recentMessages ? recentMessages.first() : null;

          if (lastMsg && lastMsg.id === freshSticky.lastMessageId) {
            return; // Already at the absolute bottom
          }

          await this.repostSticky(message.channel, freshSticky);
        } catch (err) {
          logger.warn(`Sticky repost debounce error in ${channelId}: ${err.message}`);
        } finally {
          repostLocks.delete(channelId);
        }
      }, 1200);

      channelTimers.set(channelId, timer);
    } catch (err) {
      logger.error('Error handling sticky message:', err.message);
    }
  },

  /**
   * Repost the sticky message at the bottom of the channel
   */
  async repostSticky(channel, sticky) {
    try {
      if (!channel || !channel.isTextBased()) return;

      // 1. Delete previous sticky message if present
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
        if (sticky.embedData.footer) {
          embed.setFooter({ text: sticky.embedData.footer });
        } else {
          embed.setFooter({ text: '📌 Sticky Message' });
        }

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
