const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    default: 'INFO',
    index: true
  },
  scope: {
    type: String,
    enum: ['BOT', 'API', 'DATABASE', 'INTERACTION', 'COMMAND', 'SECURITY', 'SYSTEM', 'DASHBOARD'],
    default: 'SYSTEM',
    index: true
  },
  message: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    default: null,
    index: true
  },
  userId: {
    type: String,
    default: null,
    index: true
  },
  commandName: {
    type: String,
    default: null,
    index: true
  },
  errorDetails: {
    name: { type: String, default: null },
    message: { type: String, default: null },
    stack: { type: String, default: null }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // 30-day automatic retention
  }
});

// Compound index for fast filtered log querying on the dashboard
SystemLogSchema.index({ level: 1, createdAt: -1 });
SystemLogSchema.index({ scope: 1, createdAt: -1 });
SystemLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('SystemLog', SystemLogSchema);
