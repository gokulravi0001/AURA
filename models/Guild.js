const mongoose = require('mongoose');
const { DEFAULT_GUILD_CONFIG } = require('../shared/constants');

const GuildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Discord Server' },
  icon: { type: String, default: null },
  ownerId: { type: String },
  prefix: { type: String, default: '+' },

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
    invite_tracker: { type: Boolean, default: true }
  },

  leveling: {
    enabled: { type: Boolean, default: true },
    xpMin: { type: Number, default: 15 },
    xpMax: { type: Number, default: 25 },
    cooldownSeconds: { type: Number, default: 60 },
    announcementChannelId: { type: String, default: null },
    levelUpMessage: { type: String, default: '🎉 Congratulations {user}, you leveled up to **Level {level}**!' },
    roleRewards: [{
      level: { type: Number, required: true },
      roleId: { type: String, required: true }
    }],
    noXpChannels: [{ type: String }],
    noXpRoles: [{ type: String }]
  },

  voiceCounters: {
    enabled: { type: Boolean, default: false },
    categoryId: { type: String, default: null },
    counters: [{
      type: { type: String, enum: ['total', 'humans', 'bots', 'voice'], required: true },
      channelId: { type: String, required: true },
      format: { type: String, default: '{label}: {count}' }
    }]
  },

  joinToCreate: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    categoryId: { type: String, default: null },
    channelNameFormat: { type: String, default: "🔊 {username}'s Lounge" },
    userLimit: { type: Number, default: 0 },
    bitrate: { type: Number, default: 64000 }
  },

  imageThreads: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    threadNameFormat: { type: String, default: '💬 Discussion - {author}' },
    autoArchiveDuration: { type: Number, default: 1440 } // 24 hours in minutes
  },

  birthdays: {
    enabled: { type: Boolean, default: true },
    setChannelId: { type: String, default: null },
    wishChannelId: { type: String, default: null },
    channelId: { type: String, default: null },
    roleId: { type: String, default: null },
    message: { type: String, default: '🎂 Happy Birthday {user}! Wishing you an awesome day! 🎉' },
    timezone: { type: String, default: 'UTC' },
    leapDayPolicy: { type: String, enum: ['Feb28', 'Mar1'], default: 'Feb28' }
  },

  tickets: {
    enabled: { type: Boolean, default: false },
    categoryId: { type: String, default: null },
    staffRoleId: { type: String, default: null },
    logChannelId: { type: String, default: null },
    ticketCounter: { type: Number, default: 0 },
    welcomeMessage: { type: String, default: 'Welcome {user}! Support staff will assist you shortly. Use the buttons below to manage this ticket.' }
  },

  bumpReminder: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    reminderRoleId: { type: String, default: null },
    intervalMinutes: { type: Number, default: 120 },
    lastBumpTime: { type: Date, default: null },
    nextBumpTime: { type: Date, default: null },
    reminderMessage: { type: String, default: '⏰ **Bump Reminder!** It is time to bump the server using `/bump`! {role}' }
  },

  countingGame: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    currentNumber: { type: Number, default: 0 },
    lastUserId: { type: String, default: null },
    allowConsecutive: { type: Boolean, default: false },
    highScore: { type: Number, default: 0 }
  },

  wordChainGame: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    lastWord: { type: String, default: '' },
    lastUserId: { type: String, default: null },
    usedWords: [{ type: String }],
    currentStreak: { type: Number, default: 0 },
    highScore: { type: Number, default: 0 }
  },

  inviteTracker: {
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: null },
    joinMessage: { type: String, default: '👋 Welcome {user} to **{server}**! Invited by **{inviter}** (**{total}** invites) using code `{code}`.' },
    leaveMessage: { type: String, default: '📤 **{user}** left the server. Invited by **{inviter}** (**{total}** invites).' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Guild', GuildSchema);
