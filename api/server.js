const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
const logger = require('../shared/logger');
const client = require('../bot/client');

const authRoutes = require('./routes/auth');
const guildRoutes = require('./routes/guilds');
const systemRoutes = require('./routes/system');
const developerRoutes = require('./routes/developer');
const { apiRateLimiter, sanitizeInput } = require('./middleware/security');
const { renderDashboardHTML } = require('./dashboardView');
const { getDatabaseHealth } = require('../shared/database');
const maintenanceService = require('../shared/maintenanceService');

function createServer() {
  const app = express();
  const server = http.createServer(app);

  // Dynamic origin check: allows DASHBOARD_URL, localhost, onrender.com, and any *.netlify.app deployment
  const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Server-to-server or local tools
    if (origin === process.env.DASHBOARD_URL || origin === 'http://localhost:5173' || origin === 'http://localhost:5000') return true;
    if (origin.endsWith('.netlify.app') || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) return true;
    return true; // Permit cross-origin requests from dashboards
  };

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, origin || true);
      },
      credentials: true
    }
  });

  // Attach io to Discord client so bot events can emit to dashboard
  client.io = io;

  // Middlewares
  app.use(cors({
    origin: (origin, callback) => {
      // Dynamic origin reflection ensures credentials work across Vercel & Render
      callback(null, origin || true);
    },
    credentials: true
  }));

  app.set('trust proxy', true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitizeInput);

  // Apply rate limiter on API endpoints
  app.use('/api', apiRateLimiter);

  // Session configuration with MongoDB store
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura_bot';
  // Check if we are running in HTTPS environment (Render, production, or remote redirect URI)
  const isLocal = !process.env.RENDER && (!process.env.DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI.includes('localhost'));
  const isHttps = !isLocal;

  app.use(session({
    secret: process.env.SESSION_SECRET || 'aura_default_secret_key_change_me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      partitioned: isHttps
    }
  }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/guilds', guildRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/developer', developerRoutes);

  // Bot Info API
  app.get('/api/bot/info', (req, res) => {
    const botUser = client.user;
    const botAvatar = botUser
      ? botUser.displayAvatarURL({ dynamic: true, size: 256 })
      : process.env.BOT_AVATAR_FALLBACK || 'https://cdn.discordapp.com/embed/avatars/0.png';

    res.json({
      name: botUser ? botUser.username : 'AURA',
      tag: botUser ? botUser.tag : 'AURA#0000',
      avatar: botAvatar,
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      uptime: process.uptime(),
      ping: client.ws.ping
    });
  });

  // Health endpoint explicitly returning JSON
  app.get('/health', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user ? client.user.tag : 'AURA',
      uptime: process.uptime(),
      ping: client.ws?.ping ?? null,
      timestamp: new Date().toISOString()
    });
  });

  // Root endpoint serving API backend status (Web dashboard is hosted on Netlify)
  app.get(['/', '/dashboard'], async (req, res) => {
    try {
      const dbHealth = await getDatabaseHealth();
      res.json({
        status: 'online',
        service: 'AURA Discord Bot API Backend',
        bot: client.user ? client.user.tag : 'AURA',
        uptime: process.uptime(),
        ping: client.ws?.ping ?? null,
        dbStatus: dbHealth.status,
        dashboard: process.env.DASHBOARD_URL || 'Hosted on Netlify',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  // Real-time Socket.IO connection
  io.on('connection', (socket) => {
    socket.on('join_guild', (guildId) => {
      socket.join(`guild_${guildId}`);
    });

    socket.on('leave_guild', (guildId) => {
      socket.leave(`guild_${guildId}`);
    });
  });

  return { app, server, io };
}

module.exports = { createServer };
