const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  ticketNumber: { type: Number, required: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  claimedBy: { type: String, default: null },
  claimedByName: { type: String, default: null },
  status: { type: String, enum: ['open', 'claimed', 'closed'], default: 'open', index: true },
  subject: { type: String, default: 'General Support' },
  reason: { type: String, default: 'No reason provided' },
  closedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closedByName: { type: String, default: null },
  transcript: [{
    author: String,
    authorId: String,
    isBot: Boolean,
    content: String,
    attachments: [String],
    timestamp: Date
  }]
}, {
  timestamps: true
});

TicketSchema.index({ guildId: 1, ticketNumber: 1 });

module.exports = mongoose.model('Ticket', TicketSchema);
