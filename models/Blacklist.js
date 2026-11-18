const mongoose = require('mongoose');

const BlacklistSchema = new mongoose.Schema({
  targetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['user', 'guild'],
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: 'Violation of Terms of Service / Abuse'
  },
  blacklistedBy: {
    type: String,
    required: true
  },
  blacklistedByName: {
    type: String,
    default: 'Developer'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Blacklist', BlacklistSchema);
