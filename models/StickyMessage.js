const mongoose = require('mongoose');

const StickyMessageSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true, index: true },
  content: { type: String, default: '' },
  embedData: {
    title: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: String, default: '#9333ea' },
    footer: { type: String, default: null }
  },
  lastMessageId: { type: String, default: null },
  cooldownSeconds: { type: Number, default: 4 },
  messageThreshold: { type: Number, default: 2 },
  messagesSinceLastPost: { type: Number, default: 0 },
  lastPostedAt: { type: Date, default: null },
  enabled: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('StickyMessage', StickyMessageSchema);
