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

  // Serve React dashboard static files in production if present
  const distPath = path.join(__dirname, '../dashboard/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
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
