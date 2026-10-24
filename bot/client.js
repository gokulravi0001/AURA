const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const logger = require('../shared/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User,
    Partials.Reaction
  ]
});

// Collections for commands and interactions
client.commands = new Collection();         // Slash commands
client.prefixCommands = new Collection();   // Prefix commands (+)
client.aliases = new Collection();          // Prefix command aliases
client.cooldowns = new Collection();        // Command cooldowns
client.buttons = new Collection();          // Button handlers
client.modals = new Collection();           // Modal submit handlers
client.selectMenus = new Collection();      // Select menu handlers

// Socket.io instance reference attached on API startup
client.io = null;

module.exports = client;
