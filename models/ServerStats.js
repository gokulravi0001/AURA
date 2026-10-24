const mongoose = require('mongoose');

const ServerStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  totalMembers: { type: Number, default: 0 },
  humans: { type: Number, default: 0 },
  bots: { type: Number, default: 0 },
  voiceActive: { type: Number, default: 0 },
  messagesRecorded: { type: Number, default: 0 },
  joinsRecorded: { type: Number, default: 0 },
  leavesRecorded: { type: Number, default: 0 }
}, {
  timestamps: true
});

ServerStatsSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ServerStats', ServerStatsSchema);
