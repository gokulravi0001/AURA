const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  regular: { type: Number, default: 0 },
  left: { type: Number, default: 0 },
  fake: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 }
}, {
  timestamps: true
});

InviteSchema.virtual('total').get(function() {
  return Math.max(0, (this.regular + this.bonus) - this.left - this.fake);
});

InviteSchema.set('toJSON', { virtuals: true });
InviteSchema.set('toObject', { virtuals: true });

InviteSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Invite', InviteSchema);
