const mongoose = require('mongoose');

const BirthdaySchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  day: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, default: null }, // Optional
  lastWishedYear: { type: Number, default: 0 }
}, {
  timestamps: true
});

BirthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });
BirthdaySchema.index({ guildId: 1, month: 1, day: 1 });

module.exports = mongoose.model('Birthday', BirthdaySchema);
