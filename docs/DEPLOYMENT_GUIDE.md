# AURA DEPLOYMENT GUIDE: BOT HOSTING + VERCEL

This guide explains how to deploy **AURA** using **Bot Hosting** (for the 24/7 Discord bot + API) and **Vercel** (for the modern Web Dashboard).

---

## 1. Hosting Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              MongoDB Atlas (Free)            │
                      │         (Users, Guilds, XP, Tickets)         │
                      └──────────────────────▲───────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│       Vercel Dashboard       │ ───► │   Bot Hosting (24/7 Host)    │
│  (React + Vite Web Frontend) │ CORS │   • Discord Bot WebSocket    │
│   https://aura.vercel.app    │      │   • Express API & Socket.IO  │
└──────────────────────────────┘      └──────────────▲───────────────┘
                                                     │
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │       Discord Gateway        │
                                      └──────────────────────────────┘
```

---

## 2. Deploying the Bot & API (Bot Hosting)

Choose any persistent bot hosting provider such as **Railway**, **Render**, **Koyeb**, **Discloud**, or a **VPS**.

### Example: Deploying to Railway / Render:
1. Push your project to a GitHub repository.
2. Link the repository to Railway or Render.
3. It will automatically detect the [`Procfile`](file:///d:/DC%20BOTS/AURA/Procfile) or [`Dockerfile`](file:///d:/DC%20BOTS/AURA/Dockerfile).
4. Add the following **Environment Variables** in your host dashboard:
   - `DISCORD_BOT_TOKEN`: Your bot token.
   - `DISCORD_CLIENT_ID`: Your application ID.
   - `DISCORD_CLIENT_SECRET`: Your OAuth2 client secret.
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `PORT`: `5000` (or let the platform assign one).
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: A long random secret string.
   - `DISCORD_REDIRECT_URI`: `https://your-bot-backend.up.railway.app/api/auth/callback`
   - `DASHBOARD_URL`: `https://your-aura-dashboard.vercel.app`
5. Note down your backend URL (e.g. `https://your-bot-backend.up.railway.app`).

---

## 3. Deploying the Dashboard to Vercel

1. Go to [Vercel](https://vercel.com) and click **Add New Project**.
2. Select your GitHub repository.
3. Under **Root Directory**, click **Edit** and select `dashboard`.
4. Vercel will automatically detect **Vite**.
5. Add the following **Environment Variable** in Vercel:
   - `VITE_API_URL`: Your backend URL from Step 2 (e.g. `https://your-bot-backend.up.railway.app`).
6. Click **Deploy**!

---

## 4. Final Discord Developer Portal Update

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) -> Your Bot -> **OAuth2 -> General**.
2. Under **Redirects**, add your live production backend callback URL:
   ```
   https://your-bot-backend.up.railway.app/api/auth/callback
   ```
3. Save changes.
