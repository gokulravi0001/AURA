const mongoose = require('mongoose');

const MemberInviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  memberId: { type: String, required: true, index: true },
  inviterId: { type: String, default: null, index: true },
  code: { type: String, default: null },
  isFake: { type: Boolean, default: false }
}, {
  timestamps: true
});

MemberInviteSchema.index({ guildId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model('MemberInvite', MemberInviteSchema);
