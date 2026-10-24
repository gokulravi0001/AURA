/**
 * AURA Shared Constants & Default Configurations
 */

module.exports = {
  // Bot Colors (Red, Black, Purple theme)
  COLORS: {
    PRIMARY: '#9333ea',    // Vivid Purple
    SECONDARY: '#dc2626',  // Vivid Red
    DARK: '#0a0a0c',       // Deep Black
    SUCCESS: '#22c55e',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    INFO: '#3b82f6',
    EMBED_DEFAULT: 0x9333ea,
    EMBED_ERROR: 0xef4444,
    EMBED_SUCCESS: 0x22c55e
  },

  // Available Bot Modules
  MODULES: {
    LEVELING: 'leveling',
    STATISTICS: 'statistics',
    VOICE_COUNTERS: 'voice_counters',
    JOIN_TO_CREATE: 'join_to_create',
    STICKY_MESSAGES: 'sticky_messages',
    IMAGE_THREADS: 'image_threads',
    BIRTHDAYS: 'birthdays',
    MINIGAMES: 'minigames',
    TICKETS: 'tickets',
    BUMP_REMINDER: 'bump_reminder'
  },

  // Default Guild Configuration
  DEFAULT_GUILD_CONFIG: {
    prefix: '+',
    modules: {
      leveling: true,
      statistics: true,
      voice_counters: false,
      join_to_create: false,
      sticky_messages: false,
      image_threads: false,
      birthdays: false,
      minigames: true,
      tickets: false,
      bump_reminder: false
    },
    language: 'en',
    timezone: 'UTC'
  },

  // Default Leveling Constants
  LEVELING: {
    BASE_XP: 100,
    MULTIPLIER: 1.5,
    MIN_XP_PER_MSG: 15,
    MAX_XP_PER_MSG: 25,
    COOLDOWN_SECONDS: 60
  },

  // Ticket Statuses
  TICKET_STATUS: {
    OPEN: 'open',
    CLAIMED: 'claimed',
    CLOSED: 'closed'
  },

  // Minigame Types
  GAMES: {
    COUNTING: 'counting',
    WORD_CHAIN: 'word_chain',
    TIC_TAC_TOE: 'tictactoe',
    ROCK_PAPER_SCISSORS: 'rps',
    TRIVIA: 'trivia',
    NUMBER_GUESS: 'number_guess'
  }
};
