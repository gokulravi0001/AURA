require('dotenv').config();
const { connectDatabase } = require('./shared/database');
const logger = require('./shared/logger');
const client = require('./bot/client');
const { createServer } = require('./api/server');

// Handlers
const loadCommands = require('./bot/handlers/commandHandler');
const loadEvents = require('./bot/handlers/eventHandler');

async function startAura() {
  logger.info('=============================================');
  logger.info('  STARTING AURA: MULTIPURPOSE BOT & DASHBOARD');
  logger.info('=============================================');

  // 1. Connect to MongoDB
  await connectDatabase();

  // 2. Load Discord Handlers
  loadCommands(client);
  loadEvents(client);

  // 3. Start Express & Socket.IO API Server
  const { server } = createServer();
  const PORT = process.env.PORT || 5000;

  server.listen(PORT, () => {
    logger.api(`AURA API & Socket.IO Server running on port ${PORT}`);
    logger.api(`Dashboard URL configured as: ${process.env.DASHBOARD_URL || 'http://localhost:5173'}`);
  });

  // 4. Log in to Discord if token is configured
  const token = process.env.DISCORD_BOT_TOKEN;
  if (token && token !== 'your_bot_token_here') {
    try {
      await client.login(token);
    } catch (err) {
      logger.error('Failed to log in to Discord:', err.message);
      logger.warn('Please check DISCORD_BOT_TOKEN in your .env file.');
    }
  } else {
    logger.warn('⚠️ DISCORD_BOT_TOKEN is not configured yet in .env.');
    logger.info('Set your token in .env and restart to connect to Discord.');
  }

  // 5. Keep-Alive Self-Ping (Prevents Render Free Tier from spinning down after 15m)
  const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://aura-discord-bot-yg5a.onrender.com';
  const axios = require('axios');
  const PING_INTERVAL = 8 * 60 * 1000; // Ping every 8 minutes (Render sleep threshold is 15 minutes)

  setInterval(async () => {
    try {
      await axios.get(`${publicUrl}/api/bot/info`, { timeout: 15000 });
      logger.info(`[Keep-Alive] Pinged ${publicUrl} to keep bot active 24/7.`);
    } catch (err) {
      // Non-critical, ignore transient network drops
    }
  }, PING_INTERVAL);

  // Graceful Shutdown
  const shutdown = async () => {
    logger.info('Shutting down AURA gracefully...');
    if (client.isReady()) {
      client.destroy();
    }
    server.close(() => {
      logger.info('AURA API Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startAura().catch((err) => {
  logger.error('Fatal initialization error:', err);
});
