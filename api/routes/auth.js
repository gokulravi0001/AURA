const express = require('express');
const axios = require('axios');
const router = express.Router();
const client = require('../../bot/client');
const logger = require('../../shared/logger');
const { isBotOwner } = require('../../shared/permissionHelper');
const whitelistService = require('../../shared/whitelistService');

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

// 1. GET /api/auth/login - Redirect to Discord OAuth2
router.get('/login', (req, res) => {
  const clientId = (process.env.DISCORD_CLIENT_ID || '1550194365635362876').trim();
  const redirectUri = encodeURIComponent(
    (process.env.DISCORD_REDIRECT_URI || 'https://aura-discord-bot-yg5a.onrender.com/api/auth/callback').trim()
  );
  const scope = encodeURIComponent('identify guilds');

  // Detect origin so user returns to the exact dashboard they logged in from
  const referer = req.headers.referer || '';
  let returnTo = req.query.returnTo || '';
  if (!returnTo) {
    if (referer.includes('vercel.app')) {
      returnTo = 'vercel';
    } else if (referer.includes('onrender.com') || referer.includes('localhost')) {
      returnTo = 'render';
    }
  }

  const stateObj = { returnTo };
  const state = encodeURIComponent(Buffer.from(JSON.stringify(stateObj)).toString('base64url'));

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&prompt=consent`;
  res.redirect(authUrl);
});

// 2. GET /api/auth/callback - OAuth2 Callback Code Exchange
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const dashboardUrl = (process.env.DASHBOARD_URL && !process.env.DASHBOARD_URL.includes('aura-bot-dashboard'))
    ? process.env.DASHBOARD_URL
    : 'https://dashboard-alpha-lovat.vercel.app';

  // Decode state to know where to return user
  let returnTo = '';
  if (req.query.state) {
    try {
      const decoded = JSON.parse(Buffer.from(decodeURIComponent(req.query.state), 'base64url').toString('utf8'));
      returnTo = decoded.returnTo || '';
    } catch {}
  }

  // Determine fallback target if error
  const errorTarget = returnTo === 'render' ? '/?error=' : `${dashboardUrl}?error=`;

  if (!code) {
    return res.redirect(`${errorTarget}missing_code`);
  }

  const clientId = (process.env.DISCORD_CLIENT_ID || '1550194365635362876').trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ? process.env.DISCORD_CLIENT_SECRET.trim() : '';
  const redirectUri = (process.env.DISCORD_REDIRECT_URI || 'https://aura-discord-bot-yg5a.onrender.com/api/auth/callback').trim();

  if (!clientSecret) {
    logger.error('[Auth] DISCORD_CLIENT_SECRET is missing from environment variables on Render!');
    return res.redirect(`${errorTarget}auth_failed&reason=Missing_DISCORD_CLIENT_SECRET_on_Render`);
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
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

    // Filter guild data to only essential fields to keep session lightweight and fast
    const userGuilds = Array.isArray(guildsResponse.data) ? guildsResponse.data.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      permissions: g.permissions,
      owner: g.owner
    })) : [];

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

    req.session.guilds = userGuilds;

    logger.info(`[Auth] User ${userResponse.data.username} (${userResponse.data.id}) logged in successfully.`);

    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.redirect(`${errorTarget}session_error`);
      }

      // If user logged in from the Render dashboard, keep them on the Render dashboard!
      if (returnTo === 'render') {
        return res.redirect('/dashboard');
      }

      // Otherwise return to Vercel servers view
      return res.redirect(`${dashboardUrl}/servers`);
    });
  } catch (err) {
    const errorData = err.response?.data;
    const reason = errorData?.error_description || errorData?.error || err.message;
    logger.error('Discord OAuth2 Callback Error:', {
      status: err.response?.status,
      data: errorData,
      message: err.message
    });
    res.redirect(`${errorTarget}auth_failed&reason=${encodeURIComponent(reason)}`);
  }
});

// 3. GET /api/auth/user - Get logged-in user profile
router.get('/user', (req, res) => {
  if (!req.session?.user) {
    return res.status(200).json({ user: null, isGuest: true });
  }
  res.json({ user: req.session.user, isGuest: false });
});

// 4. GET or POST /api/auth/logout - Logout
router.all('/logout', (req, res) => {
  const referer = req.headers.referer || '';
  req.session.destroy(() => {
    if (req.method === 'POST') {
      return res.json({ success: true });
    }
    if (referer.includes('vercel.app')) {
      return res.redirect(process.env.DASHBOARD_URL || 'https://dashboard-alpha-lovat.vercel.app');
    }
    return res.redirect('/');
  });
});

// 5. GET /api/auth/guilds - Return guilds with public guest mode and management checks
router.get('/guilds', (req, res) => {
  const user = req.session?.user || null;
  const userGuilds = req.session?.guilds || [];
  const isBotDev = user ? isBotOwner(user.id, client) : false;

  // Active guilds where AURA is present (Publicly viewable by anyone)
  const activeGuilds = client.guilds.cache.map(g => {
    const iconUrl = g.iconURL({ dynamic: true, size: 128 });
    const userGuildObj = userGuilds.find(ug => ug.id === g.id);
    let canManage = isBotDev;

    if (user && userGuildObj) {
      const perms = BigInt(userGuildObj.permissions || 0);
      const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
      const isManager = (perms & BigInt(0x20)) === BigInt(0x20);
      const isOwner = userGuildObj.owner || g.ownerId === user.id;
      const isWhitelisted = whitelistService.isWhitelisted(user.id, g.id);
      canManage = canManage || isAdmin || isManager || isOwner || isWhitelisted;
    } else if (user) {
      const isOwner = g.ownerId === user.id;
      const isWhitelisted = whitelistService.isWhitelisted(user.id, g.id);
      canManage = canManage || isOwner || isWhitelisted;
    }

    return {
      id: g.id,
      name: g.name,
      icon: iconUrl,
      memberCount: g.memberCount || 0,
      hasBot: true,
      canManage,
      inviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=8&guild_id=${g.id}&disable_guild_select=true`
    };
  });

  // Non-bot guilds where logged-in user has admin permission (for inviting bot)
  const inviteableGuilds = [];
  if (user && userGuilds.length > 0) {
    userGuilds.forEach(g => {
      if (!client.guilds.cache.has(g.id)) {
        const perms = BigInt(g.permissions || 0);
        const isAdmin = (perms & BigInt(0x8)) === BigInt(0x8);
        const isManager = (perms & BigInt(0x20)) === BigInt(0x20);
        if (isAdmin || isManager || g.owner || isBotDev) {
          inviteableGuilds.push({
            id: g.id,
            name: g.name,
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
            hasBot: false,
            canManage: true,
            inviteUrl: `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=8&guild_id=${g.id}&disable_guild_select=true`
          });
        }
      }
    });
  }

  res.json({
    isGuest: !user,
    user: user,
    guilds: [...activeGuilds, ...inviteableGuilds]
  });
});

module.exports = router;
