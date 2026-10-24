const mongoose = require('mongoose');

const TempVoiceSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, index: true },
  isLocked: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('TempVoice', TempVoiceSchema);
