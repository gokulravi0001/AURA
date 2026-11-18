const mongoose = require('mongoose');
const { DEFAULT_GUILD_CONFIG } = require('../shared/constants');

const SystemConfigSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: true,
    unique: true,
    default: 'global_config'
  },
  maintenanceMode: {
    enabled: { type: Boolean, default: false },
    message: {
      type: String,
      default: '🔧 **AURA is currently undergoing scheduled system maintenance.** Regular commands are temporarily paused. Diagnostics remain active for developers.'
    },
    startedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null }
  },
  globalDefaults: {
    prefix: { type: String, default: '+' },
    language: { type: String, default: 'en' },
    modules: {
      leveling: { type: Boolean, default: true },
      statistics: { type: Boolean, default: true },
      voice_counters: { type: Boolean, default: true },
      join_to_create: { type: Boolean, default: true },
      sticky_messages: { type: Boolean, default: true },
      image_threads: { type: Boolean, default: true },
      birthdays: { type: Boolean, default: true },
      minigames: { type: Boolean, default: true },
      tickets: { type: Boolean, default: true },
      bump_reminder: { type: Boolean, default: true },
      invite_tracker: { type: Boolean, default: true },
      emoji_manager: { type: Boolean, default: true },
      invite_guard: { type: Boolean, default: true },
      server_tag_role: { type: Boolean, default: true }
    }
  },
  globalEmergencyDisabledModules: [{
    type: String
  }],
  operationalLogChannelId: {
    type: String,
    default: null
  },
  announcements: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, default: 'Developer' },
    publishedAt: { type: Date, default: Date.now },
    isPinned: { type: Boolean, default: false }
  }],
  changelogs: [{
    version: { type: String, required: true },
    releaseDate: { type: Date, default: Date.now },
    features: [{ type: String }],
    bugFixes: [{ type: String }],
    improvements: [{ type: String }],
    publishedBy: { type: String, default: null }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
