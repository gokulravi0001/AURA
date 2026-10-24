# AURA SETUP & DEPLOYMENT GUIDE

This guide walks you step-by-step through configuring and launching **AURA**, the all-in-one Discord bot with a real-time React web dashboard.

---

## 1. Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** (top right) and name your bot `AURA`.
3. Under **General Information**:
   - Copy the **Application ID** (this will be your `DISCORD_CLIENT_ID`).
4. Under **Bot** (left menu):
   - Click **Reset Token** and copy the token (this will be your `DISCORD_BOT_TOKEN`).
   - Under **Privileged Gateway Intents**, enable:
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent**
     - ✅ **Message Content Intent**
   - Click **Save Changes**.
5. Under **OAuth2 -> General**:
   - Copy the **Client Secret** (this will be your `DISCORD_CLIENT_SECRET`).
   - Click **Add Redirect** and enter:
     - For local development: `http://localhost:5000/api/auth/callback`
     - For production: `https://yourdomain.com/api/auth/callback`
   - Click **Save Changes**.

---

## 2. MongoDB Setup

You can use either a local MongoDB instance or a free MongoDB Atlas cloud database:

### Option A: MongoDB Atlas (Cloud - Recommended)
1. Sign up for a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Database Access**, create a database user and password.
4. Under **Network Access**, add IP `0.0.0.0/0` (allow access from anywhere).
5. Click **Connect** -> **Connect your application** -> Copy the connection URI:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/aura_bot?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB
If you have MongoDB installed locally:
```env
MONGODB_URI=mongodb://localhost:27017/aura_bot
```

---

## 3. Environment Variables Configuration

Create a file named `.env` in the root folder by copying `.env.example`:

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# 1. BOT CREDENTIALS
DISCORD_BOT_TOKEN=your_actual_bot_token_here
DISCORD_CLIENT_ID=your_actual_client_id_here
DISCORD_CLIENT_SECRET=your_actual_client_secret_here

# 2. BOT DEFAULTS
BOT_PREFIX=+
DEFAULT_EMBED_COLOR=#9333ea

# 3. DATABASE
MONGODB_URI=mongodb://localhost:27017/aura_bot

# 4. SERVER & DASHBOARD
PORT=5000
NODE_ENV=development
SESSION_SECRET=create_a_random_secure_secret_string_here_12345

# 5. OAUTH2 REDIRECT URLS
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/callback
DASHBOARD_URL=http://localhost:5173
```

---

## 4. Registering Slash Commands

Before or after starting the bot, register all slash commands with the Discord API:

```bash
npm run deploy:commands
```

---

## 5. Running AURA Locally

### Starting Backend & Discord Bot:
```bash
npm start
```
*(Or `npm run dev` to automatically reload on code changes)*

### Starting the Web Dashboard (Frontend):
In a separate terminal:
```bash
npm run dashboard:dev
```
Open your browser to `http://localhost:5173`. Click **Sign in with Discord** to access your servers!

---

## 6. Building for Production

To build the React dashboard for production:
```bash
npm run dashboard:build
```
Express will automatically serve the built dashboard files on `http://localhost:5000`.
