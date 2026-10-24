# ⚡ AURA — All-In-One Multipurpose Discord Bot & Web Dashboard

<div align="center">
  <img src="https://cdn.discordapp.com/embed/avatars/0.png" width="120" height="120" alt="AURA Logo" style="border-radius: 50%; box-shadow: 0 0 25px rgba(147, 51, 234, 0.4);" />
  <br />
  <h3>The Modern Powerhouse for Discord Communities</h3>
  <p>Built with Node.js, Discord.js v14, Express, MongoDB (Mongoose), Socket.IO, and React (Vite + Tailwind CSS)</p>
</div>

---

## 🌟 Highlights & Features

- **Dual Command Engine:** Full native support for **Discord Slash Commands** (`/`) AND traditional text prefix commands (`+` by default, e.g. `+help`, `+rank`).
- **Unified Architecture:** One bot, one database, and one centralized dashboard controlling every module.
- **Red, Black, and Purple Theme:** Sleek cyberpunk dark UI with black cards, vivid purple accents, red highlights, and smooth glow animations.
- **Discord OAuth2 Login:** Secure server administrator authentication with instant permission verification.
- **Dynamic Bot Branding:** Dashboard automatically retrieves and displays your Discord bot's profile avatar as its brand logo.

---

## 🛠️ Feature Modules

| Module | Description | Slash & `+` Commands |
| :--- | :--- | :--- |
| **📊 XP & Leveling** | Message XP, cooldowns, custom level-up alerts, role rewards, and server leaderboard. | `/rank`, `/leaderboard`, `/addxp` • `+rank`, `+top`, `+addxp` |
| **🔊 Join-to-Create Voice** | Temporary voice lounges created on demand with owner controls (lock, unlock, user limit, rename) and auto-deletion. | `/voice lock`, `/voice unlock`, `/voice limit`, `/voice rename` • `+voice` |
| **🎫 Ticket Support Desk** | Embedded panels, private channels, staff claiming, close/reopen, and complete transcript saving to MongoDB. | `/ticket-panel` • `+ticket-panel` |
| **📌 Sticky Messages** | Pinned messages and embeds that automatically repost near the bottom with spam protection. | `/sticky set`, `/sticky remove` • `+sticky` |
| **💬 Auto Image Threads** | Automatically creates discussion threads on qualifying image posts in designated channels. | Dashboard configured & monitored |
| **🎂 Birthday Celebrations** | Parse `DD/MM/YYYY`, `DD-MM-YYYY`, `DD/MM`, timezones, automated birthday wishes, and optional birthday role. | `/birthday set`, `/birthday list` • `+birthday` |
| **🎮 Minigames** | Dedicated Counting game channel (+1 check, anti-consecutive rule), Word Chain (streaks), and Rock Paper Scissors. | `/games rps`, `/games setup-counting`, `/games setup-wordchain` • `+rps` |
| **🚀 Bump Reminders** | Disboard auto-detection, countdown timer, reminder pings with an interactive "I Just Bumped!" button. | `/bump status`, `/bump done` • `+bump` |
| **📈 Server Voice Counters** | Real-time locked voice channels displaying Total Members, Humans, Bots, and Active Voice counts. | Wizard configured via `+counters-setup` or dashboard |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
npm run dashboard:install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your Discord credentials and MongoDB URI:
```bash
cp .env.example .env
```
*(See [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for detailed Developer Portal setup)*

### 3. Deploy Slash Commands
```bash
npm run deploy:commands
```

### 4. Run Automated Unit Tests
```bash
npm test
```

### 5. Launch AURA
In Terminal 1 (Backend & Bot):
```bash
npm start
```

In Terminal 2 (React Dashboard):
```bash
npm run dashboard:dev
```

Open `http://localhost:5173` to view the web dashboard!

---

## 📂 Project Organization

```
AURA/
├── bot/
│   ├── client.js               # Discord Client instance with Gateway Intents
│   ├── deploy-commands.js      # Global REST application command deployment
│   ├── commands/               # Slash & + prefix command handlers
│   │   ├── general/            # ping, help, stats
│   │   ├── leveling/           # rank, leaderboard, addxp
│   │   ├── voice/              # voice lock, unlock, rename, limit
│   │   ├── tickets/            # ticket-panel
│   │   ├── moderation/         # sticky, counters
│   │   ├── birthday/           # birthday set, list, remove
│   │   ├── games/              # rps, counting, wordchain
│   │   └── bump/               # bump status, done
│   ├── events/                 # Discord gateway events
│   │   ├── client/             # ready, interactionCreate, messageCreate
│   │   ├── guild/              # guildMemberAdd, guildMemberRemove
│   │   └── voice/              # voiceStateUpdate
│   └── modules/                # Feature business logic & schedulers
├── api/
│   ├── server.js               # Express API + Socket.IO server setup
│   ├── routes/                 # auth (OAuth2), guilds management
│   └── middleware/             # auth and guild administrator validation
├── models/                     # Mongoose database schemas
│   ├── Guild.js                # Core server configuration
│   ├── UserXP.js               # User leveling & message counts
│   ├── Ticket.js               # Ticket records & transcripts
│   ├── StickyMessage.js        # Sticky message tracking
│   ├── Birthday.js             # User registered birthdays
│   ├── TempVoice.js            # Active temporary voice lounges
│   └── ServerStats.js          # Daily server activity analytics
├── shared/                     # Logger, database connector, constants, guildService
├── dashboard/                  # React (Vite + Tailwind CSS) Frontend
│   └── src/
│       ├── components/         # Navbar, Sidebar, Layout, Cards
│       ├── context/            # AuthContext (user, botInfo, socket)
│       └── pages/              # Overview, Modules, Leveling, Voice, Tickets, etc.
├── docs/                       # Comprehensive documentation
├── tests/                      # Automated unit test suite
└── index.js                    # Unified entrypoint
```

---

## 🔒 Security Best Practices

- All bot tokens, OAuth client secrets, and session keys are kept strictly in `.env`.
- Frontend never receives secret keys.
- Every dashboard API route verifies user administrator permissions server-side on Discord before allowing modifications.
- Rate limiting and cooldowns protect commands, sticky messages, and XP increments against spam.

---

## 📄 License
MIT License. Created for the AURA Community.
