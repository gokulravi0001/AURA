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

  // Dynamic origin check: allows DASHBOARD_URL, localhost, and any *.vercel.app deployment
  const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Server-to-server or local tools
    if (origin === process.env.DASHBOARD_URL || origin === 'http://localhost:5173') return true;
    if (origin.endsWith('.vercel.app')) return true;
    return false;
  };

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) callback(null, true);
        else callback(new Error('Blocked by CORS'));
      },
      credentials: true
    }
  });

  // Attach io to Discord client so bot events can emit to dashboard
  client.io = io;

  // Middlewares
  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('Blocked by CORS'));
    },
    credentials: true
  }));

  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitizeInput);

  // Apply rate limiter on API endpoints
  app.use('/api', apiRateLimiter);

  // Session configuration with MongoDB store
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura_bot';
  const isProd = process.env.NODE_ENV === 'production';

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
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
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

  // Root endpoint serving the Core Management Dashboard interface
  app.get(['/', '/dashboard'], async (req, res) => {
    // If request explicitly asks for JSON, respond with JSON health check
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html')) {
      return res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'AURA',
        uptime: process.uptime(),
        ping: client.ws?.ping ?? null,
        timestamp: new Date().toISOString()
      });
    }

    try {
      const dbHealth = await getDatabaseHealth();
      const html = renderDashboardHTML({
        botUser: client.user,
        totalGuilds: client.guilds.cache.size,
        totalUsers: client.users.cache.size,
        uptime: process.uptime(),
        ping: client.ws?.ping ?? null,
        dbHealth,
        maintenanceActive: maintenanceService.isMaintenanceActive()
      });
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      res.status(500).send('Error rendering dashboard: ' + err.message);
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
