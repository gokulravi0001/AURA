const express = require('express');
const axios = require('axios');
const router = express.Router();
const client = require('../../bot/client');
const logger = require('../../shared/logger');

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

// 1. GET /api/auth/login - Redirect to Discord OAuth2
router.get('/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/auth/callback');
  const scope = encodeURIComponent('identify guilds');

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=consent`;
  res.redirect(authUrl);
});

// 2. GET /api/auth/callback - OAuth2 Callback Code Exchange
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';

  if (!code) {
    return res.redirect(`${dashboardUrl}?error=missing_code`);
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/auth/callback'
    });

    // Exchange code for token
    const tokenResponse = await axios.post(`${DISCORD_API_ENDPOINT}/oauth2/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // Fetch user profile
    const userResponse = await axios.get(`${DISCORD_API_ENDPOINT}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Fetch user guilds
    const guildsResponse = await axios.get(`${DISCORD_API_ENDPOINT}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Save in session
    req.session.user = {
      id: userResponse.data.id,
      username: userResponse.data.username,
      discriminator: userResponse.data.discriminator,
      avatar: userResponse.data.avatar,
      avatarUrl: userResponse.data.avatar
        ? `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`
    };

    req.session.guilds = guildsResponse.data;

    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.redirect(`${dashboardUrl}?error=session_error`);
      }
      return res.redirect(`${dashboardUrl}/servers`);
    });
  } catch (err) {
    logger.error('Discord OAuth2 Callback Error:', err.response?.data || err.message);
    res.redirect(`${dashboardUrl}?error=auth_failed`);
  }
});

// 3. GET /api/auth/user - Get logged-in user profile
router.get('/user', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: req.session.user });
});

// 4. POST /api/auth/logout - Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// 5. GET /api/auth/guilds - Return user guilds with permission & bot presence check
router.get('/guilds', (req, res) => {
  if (!req.session?.user || !req.session.guilds) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Filter guilds where user has Administrator (0x8) or Manage Server (0x20)
  const manageableGuilds = req.session.guilds
    .filter(g => {
      const perms = BigInt(g.permissions);
      const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
      const isManager = (perms & BigInt(0x20)) === BigInt(0x20);
      return isAdmin || isManager || g.owner;
    })
    .map(g => {
      const botInGuild = client.guilds.cache.has(g.id);
      const iconUrl = g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : null;

      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=8&guild_id=${g.id}&disable_guild_select=true`;

      return {
        id: g.id,
        name: g.name,
        icon: iconUrl,
        hasBot: botInGuild,
        inviteUrl
      };
    });

  res.json({ guilds: manageableGuilds });
});

module.exports = router;
