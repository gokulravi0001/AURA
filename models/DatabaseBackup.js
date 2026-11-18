const mongoose = require('mongoose');

const DatabaseBackupSchema = new mongoose.Schema({
  backupId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: 'Manual system backup'
  },
  collections: [{
    name: { type: String, required: true },
    count: { type: Number, default: 0 }
  }],
  totalDocuments: {
    type: Number,
    default: 0
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('DatabaseBackup', DatabaseBackupSchema);
