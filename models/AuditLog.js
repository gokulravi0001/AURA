const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  executorId: { type: String, default: null },
  executorName: { type: String, default: 'System' },
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, default: null }
}, {
  timestamps: true
});

AuditLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
