const mongoose = require('mongoose');

const UserXPSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  lastXpEarnedAt: { type: Date, default: () => new Date(0) }
}, {
  timestamps: true
});

UserXPSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserXPSchema.index({ guildId: 1, xp: -1 });

module.exports = mongoose.model('UserXP', UserXPSchema);
