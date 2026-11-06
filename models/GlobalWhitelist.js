const mongoose = require('mongoose');

const GlobalWhitelistSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  addedBy: { type: String, required: true },
  tag: { type: String, default: null },
  reason: { type: String, default: 'Bot Developer Whitelist' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GlobalWhitelist', GlobalWhitelistSchema);
