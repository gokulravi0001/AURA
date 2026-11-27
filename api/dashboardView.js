/**
 * AURA Core Dashboard View (Red, Black, Purple Theme)
 * Complete management system view with real-time API integrations
 */

function renderDashboardHTML({ botUser, totalGuilds = 0, totalUsers = 0, uptime = 0, ping = null, dbHealth = {}, maintenanceActive = false } = {}) {
  const avatarUrl = botUser?.displayAvatarURL ? botUser.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const botName = botUser?.username || 'AURA';
  const botTag = botUser?.tag || 'AURA#0000';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AURA — Core Management Dashboard</title>
  <link rel="icon" type="image/png" href="${avatarUrl}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0a0c;
      --bg-card: #121217;
      --bg-card-hover: #181820;
      --border: #272730;
      --purple: #9333ea;
      --purple-light: #a855f7;
      --purple-glow: rgba(147, 51, 234, 0.25);
      --red: #dc2626;
      --red-light: #ef4444;
      --red-glow: rgba(220, 38, 38, 0.25);
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --success: #22c55e;
      --warning: #f59e0b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Nav */
    header {
      background: rgba(18, 18, 23, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      text-decoration: none;
      color: var(--text);
    }
    .brand img {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2px solid var(--purple);
      box-shadow: 0 0 16px var(--purple-glow);
    }
    .brand-title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #f4f4f5 40%, var(--purple-light) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-badge {
      font-size: 0.7rem;
      font-weight: 700;
      background: var(--purple-glow);
      color: var(--purple-light);
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      border: 1px solid rgba(168, 85, 247, 0.3);
      text-transform: uppercase;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .btn {
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--purple) 0%, #7e22ce 100%);
      color: white;
      box-shadow: 0 4px 14px var(--purple-glow);
    }
    .btn-primary:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .btn-danger {
      background: linear-gradient(135deg, var(--red) 0%, #b91c1c 100%);
      color: white;
      box-shadow: 0 4px 14px var(--red-glow);
    }
    .btn-secondary {
      background: var(--bg-card);
      border-color: var(--border);
      color: var(--text);
    }
    .btn-secondary:hover {
      background: var(--bg-card-hover);
      border-color: #3f3f46;
    }

    /* Layout */
    .container {
      max-width: 1380px;
      margin: 0 auto;
      padding: 2rem;
      width: 100%;
      flex: 1;
    }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }
    .nav-tab {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .nav-tab:hover {
      color: var(--text);
    }
    .nav-tab.active {
      color: var(--purple-light);
      border-bottom-color: var(--purple);
    }

    /* Tab Content Panels */
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
      animation: fadeIn 0.25s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards & Grids */
    .grid-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.35rem;
      position: relative;
      overflow: hidden;
    }
    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--purple);
    }
    .metric-card.danger::before { background: var(--red); }
    .metric-card.success::before { background: var(--success); }
    .metric-card.warning::before { background: var(--warning); }
    .metric-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .metric-value {
      font-size: 1.85rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .metric-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.4rem;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-bottom: 1.75rem;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    /* Table */
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    td {
      padding: 0.95rem 1rem;
      border-bottom: 1px solid rgba(39, 39, 48, 0.6);
    }
    tr:hover td {
      background: var(--bg-card-hover);
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-success { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-danger { background: rgba(220, 38, 38, 0.15); color: #f87171; border: 1px solid rgba(220, 38, 38, 0.3); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-info { background: rgba(147, 51, 234, 0.15); color: #c084fc; border: 1px solid rgba(147, 51, 234, 0.3); }

    /* Code block */
    pre, code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
    }
    pre {
      background: #0d0d10;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      color: #e4e4e7;
    }

    /* Form controls */
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--text);
    }
    .form-input {
      width: 100%;
      background: #0a0a0d;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      color: var(--text);
      font-family: inherit;
      font-size: 0.88rem;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--purple);
      box-shadow: 0 0 10px var(--purple-glow);
    }

    /* Banner */
    .banner-maintenance {
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(147, 51, 234, 0.25) 100%);
      border: 1px solid var(--red);
      border-radius: 10px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.75rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      background: var(--bg-card);
    }
  </style>
</head>
<body>

  <header>
    <a href="/" class="brand">
      <img src="${avatarUrl}" alt="AURA Bot">
      <div>
        <div class="brand-title">${botName} Core Management</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${botTag} • v1.0.0</div>
      </div>
      <span class="brand-badge">Production</span>
    </a>

    <div class="header-actions">
      <a href="/api/auth/login" class="btn btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
        Sign in with Discord
      </a>
      <a href="https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands" target="_blank" class="btn btn-secondary">
        Invite Bot
      </a>
    </div>
  </header>

  <div class="container">
    ${maintenanceActive ? `
    <div class="banner-maintenance">
      <span style="font-size: 1.5rem;">⚠️</span>
      <div>
        <div style="font-weight: 700; color: #fca5a5;">Maintenance Mode Active</div>
        <div style="font-size: 0.85rem; color: #fecaca;">Regular bot commands are temporarily paused. Diagnostics and developer controls remain operational.</div>
      </div>
    </div>` : ''}

    <!-- Navigation Tabs -->
    <div class="nav-tabs">
      <button class="nav-tab active" onclick="switchTab('tab-overview')">⚡ Overview</button>
      <button class="nav-tab" onclick="switchTab('tab-servers')">🌐 Server Management</button>
      <button class="nav-tab" onclick="switchTab('tab-logs')">📜 Monitoring & Logs</button>
      <button class="nav-tab" onclick="switchTab('tab-database')">🗄️ Database Management</button>
      <button class="nav-tab" onclick="switchTab('tab-security')">🛡️ Security & Audit</button>
      <button class="nav-tab" onclick="switchTab('tab-developer')">👑 Developer Controls</button>
      <button class="nav-tab" onclick="switchTab('tab-changelog')">📋 Changelogs</button>
    </div>

    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-content active">
      <div class="grid-metrics">
        <div class="metric-card success">
          <div class="metric-title">Bot Operational Status</div>
          <div class="metric-value" style="color: var(--success);">${botUser ? 'ONLINE' : 'STANDBY'}</div>
          <div class="metric-sub">WebSocket Ping: <strong>${ping !== null ? ping : '--'} ms</strong></div>
        </div>

        <div class="metric-card">
          <div class="metric-title">Connected Servers</div>
          <div class="metric-value">${totalGuilds}</div>
          <div class="metric-sub">Live guild connections</div>
        </div>

        <div class="metric-card">
          <div class="metric-title">Cached Users</div>
          <div class="metric-value">${totalUsers}</div>
          <div class="metric-sub">Across connected guilds</div>
        </div>

        <div class="metric-card ${(dbHealth && dbHealth.status === 'healthy') ? 'success' : 'warning'}">
          <div class="metric-title">Database Status</div>
          <div class="metric-value" style="color: ${(dbHealth && dbHealth.status === 'healthy') ? 'var(--success)' : 'var(--warning)'};">${((dbHealth && dbHealth.status) || 'ONLINE').toUpperCase()}</div>
          <div class="metric-sub">Latency: <strong>${dbHealth && dbHealth.latencyMs !== null && dbHealth.latencyMs !== undefined ? dbHealth.latencyMs : '--'} ms</strong></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🚀 Core Systems Telemetry</div>
          <span class="badge badge-info">Live Metrics</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Active Feature Modules</div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              <span class="badge badge-success">Leveling</span>
              <span class="badge badge-success">Birthdays</span>
              <span class="badge badge-success">Join-to-Create VC</span>
              <span class="badge badge-success">Tickets</span>
              <span class="badge badge-success">Server Tag Auto-Role</span>
              <span class="badge badge-success">Voice Counters</span>
              <span class="badge badge-success">Invite Guard</span>
              <span class="badge badge-success">Auto-Delete 1s</span>
              <span class="badge badge-success">Minigames</span>
              <span class="badge badge-success">Bump Reminders</span>
            </div>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">System Uptime & Node Runtime</div>
            <p style="font-size: 0.95rem;">Uptime: <strong>${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s</strong></p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Node: <strong>${process.version}</strong> • Memory Heap: <strong>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</strong></p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: SERVER MANAGEMENT -->
    <div id="tab-servers" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🌐 Connected Discord Servers (${totalGuilds})</div>
          <span class="badge badge-info">Independent Multi-Server Isolation</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Every server maintains strict isolated database storage, settings, and role configurations. Select any guild to configure its independent modules.
        </p>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Guild ID</th>
                <th>Status</th>
                <th>Isolation Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="servers-table-body">
              <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted);">
                  Sign in with Discord to manage individual server configurations.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: MONITORING & LOGS -->
    <div id="tab-logs" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📜 Centralized Log Stream & Error Inspector</div>
          <button class="btn btn-secondary" onclick="fetchLogs()">🔄 Refresh Logs</button>
        </div>
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
          <select id="log-filter-level" class="form-input" style="width: 140px;" onchange="fetchLogs()">
            <option value="">All Levels</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
          <input type="text" id="log-search" class="form-input" style="flex: 1; min-width: 200px;" placeholder="Search log message..." onkeyup="if(event.key==='Enter') fetchLogs()">
          <button class="btn btn-primary" onclick="fetchLogs()">Search</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>Scope</th>
                <th>Timestamp</th>
                <th>Message</th>
                <th>Guild ID</th>
              </tr>
            </thead>
            <tbody id="logs-table-body">
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Loading logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: DATABASE MANAGEMENT -->
    <div id="tab-database" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗄️ Database Health & Backup Manager</div>
          <button class="btn btn-primary" onclick="createBackup()">📦 Create New Backup</button>
        </div>
        <div class="grid-metrics" style="margin-bottom: 1.5rem;">
          <div class="metric-card ${(dbHealth && dbHealth.status === 'healthy') ? 'success' : 'warning'}">
            <div class="metric-title">Connection Status</div>
            <div class="metric-value">${((dbHealth && dbHealth.status) || 'OFFLINE').toUpperCase()}</div>
            <div class="metric-sub">Host: ${(dbHealth && dbHealth.host) || 'MongoDB Cluster'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Round-Trip Latency</div>
            <div class="metric-value">${dbHealth.latencyMs || 0} ms</div>
            <div class="metric-sub">Ping response time</div>
          </div>
          <div class="metric-card success">
            <div class="metric-title">Schema Migrations</div>
            <div class="metric-value" style="color: var(--success);">APPLIED</div>
            <div class="metric-sub">Auto-indexed on startup</div>
          </div>
        </div>

        <h4 style="font-size: 1rem; margin-bottom: 0.75rem;">Stored Point-in-Time Backups</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Backup ID</th>
                <th>Name</th>
                <th>Total Documents</th>
                <th>Size</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="backups-table-body">
              <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading backups...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: SECURITY & AUDIT -->
    <div id="tab-security" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🛡️ Administrative Audit Trail</div>
          <span class="badge badge-info">Immutable Records</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Tracks all configuration updates, role modifications, blacklist changes, and administrative overrides.
        </p>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Executor</th>
                <th>Guild</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Loading audit trail...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 6: DEVELOPER CONTROLS -->
    <div id="tab-developer" class="tab-content">
      <div class="card" style="border-color: rgba(147, 51, 234, 0.4);">
        <div class="card-header">
          <div class="card-title">👑 Developer-Only Control Panel</div>
          <span class="badge badge-danger">Restricted to Bot Developers</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          This control panel allows bot owners to toggle system maintenance, trigger emergency global module pauses, and manage global user/server blacklists.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          <!-- Maintenance Control -->
          <div style="background: #0d0d12; border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem;">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">🔧 Maintenance Mode</h4>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1rem;">
              Pauses regular member commands with a maintenance notice while keeping developer diagnostic access active.
            </p>
            <button id="btn-toggle-maintenance" class="btn ${maintenanceActive ? 'btn-danger' : 'btn-primary'}" onclick="toggleMaintenance()">
              ${maintenanceActive ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
            </button>
          </div>

          <!-- Blacklist Control -->
          <div style="background: #0d0d12; border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem;">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">🚫 Add User / Server to Blacklist</h4>
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <input type="text" id="blacklist-id" class="form-input" placeholder="User or Guild Discord ID">
            </div>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
              <select id="blacklist-type" class="form-input" style="width: 120px;">
                <option value="user">User</option>
                <option value="guild">Server</option>
              </select>
              <input type="text" id="blacklist-reason" class="form-input" placeholder="Reason (e.g. Spam / Abuse)">
            </div>
            <button class="btn btn-danger" onclick="addBlacklist()">Add to Blacklist</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 7: CHANGELOGS -->
    <div id="tab-changelog" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 Version History & Changelog</div>
          <span class="badge badge-info">v1.0.0 Stable</span>
        </div>
        <div style="border-left: 2px solid var(--purple); padding-left: 1.25rem; margin-left: 0.5rem;">
          <h3 style="font-size: 1.1rem; color: var(--purple-light); margin-bottom: 0.3rem;">v1.0.0 — Production Core System Upgrade</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">Released on ${new Date().toLocaleDateString()}</p>
          <ul style="font-size: 0.88rem; line-height: 1.8; margin-left: 1rem;">
            <li><strong>Interactive Guidance Hubs:</strong> Consolidated <code>/levels</code>, <code>/bday</code>, <code>/vc</code>, <code>/ticket</code>, <code>/servertools</code>, <code>/games</code> into sleek embeds with 1-click select menus and buttons.</li>
            <li><strong>Strict Permission Filtering:</strong> Administrative controls are strictly hidden from regular members.</li>
            <li><strong>Core Database Manager:</strong> Point-in-time database backups, latency ping monitoring, and schema migration runner.</li>
            <li><strong>Centralized Multi-Level Logging:</strong> Multi-level logging (DEBUG, INFO, WARN, ERROR) with token & credential masking.</li>
            <li><strong>Security System:</strong> Rate limiting, developer authorization guards, and administrative audit trail.</li>
            <li><strong>Maintenance Mode & Blacklist:</strong> Instant O(1) in-memory interception for maintenance and blacklisted entities.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <footer>
    AURA Discord Bot & Management Suite • Red, Black & Purple Theme • Built for High Performance
  </footer>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
      const target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      const clickedBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick').includes(tabId));
      if (clickedBtn) clickedBtn.classList.add('active');

      if (tabId === 'tab-logs') fetchLogs();
      if (tabId === 'tab-database') fetchDatabaseInfo();
      if (tabId === 'tab-security') fetchSecurityInfo();
      if (tabId === 'tab-servers') fetchServers();
    }

    async function fetchLogs() {
      const level = document.getElementById('log-filter-level')?.value || '';
      const search = document.getElementById('log-search')?.value || '';
      const res = await fetch('/api/system/logs?level=' + encodeURIComponent(level) + '&search=' + encodeURIComponent(search));
      const data = await res.json();
      const tbody = document.getElementById('logs-table-body');
      if (!tbody) return;
      if (!data.logs || data.logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No logs matching criteria.</td></tr>';
        return;
      }
      tbody.innerHTML = data.logs.map(log => \`
        <tr>
          <td><span class="badge \${log.level === 'ERROR' ? 'badge-danger' : log.level === 'WARN' ? 'badge-warning' : 'badge-info'}">\${log.level}</span></td>
          <td><code>\${log.scope || 'SYSTEM'}</code></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">\${new Date(log.createdAt).toLocaleString()}</td>
          <td>\${escapeHtml(log.message)}</td>
          <td><code>\${log.guildId || '--'}</code></td>
        </tr>
      \`).join('');
    }

    async function fetchDatabaseInfo() {
      const res = await fetch('/api/system/database');
      const data = await res.json();
      const tbody = document.getElementById('backups-table-body');
      if (!tbody) return;
      if (!data.backups || data.backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No backups recorded yet. Click "Create New Backup" above!</td></tr>';
        return;
      }
      tbody.innerHTML = data.backups.map(b => \`
        <tr>
          <td><code>\${b.backupId}</code></td>
          <td><strong>\${escapeHtml(b.name)}</strong></td>
          <td>\${b.totalDocuments} docs</td>
          <td>\${(b.sizeBytes / 1024).toFixed(1)} KB</td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">\${new Date(b.createdAt).toLocaleString()}</td>
          <td><button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="restoreBackup('\${b.backupId}')">Restore</button></td>
        </tr>
      \`).join('');
    }

    async function fetchSecurityInfo() {
      const res = await fetch('/api/system/security');
      const data = await res.json();
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;
      if (!data.auditLogs || data.auditLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No audit records found.</td></tr>';
        return;
      }
      tbody.innerHTML = data.auditLogs.map(a => \`
        <tr>
          <td><span class="badge badge-info">\${escapeHtml(a.action)}</span></td>
          <td>\${escapeHtml(a.executorName || a.executorId)}</td>
          <td><code>\${a.guildId || 'Global'}</code></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">\${new Date(a.createdAt).toLocaleString()}</td>
          <td><pre style="padding: 0.2rem 0.4rem; font-size: 0.75rem; display:inline-block;">\${JSON.stringify(a.details || {})}</pre></td>
        </tr>
      \`).join('');
    }

    async function fetchServers() {
      const res = await fetch('/api/auth/guilds');
      const data = await res.json();
      const tbody = document.getElementById('servers-table-body');
      if (!tbody) return;
      if (!data.guilds || data.guilds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No servers available. Sign in with Discord to view.</td></tr>';
        return;
      }
      tbody.innerHTML = data.guilds.map(g => \`
        <tr>
          <td><strong>\${escapeHtml(g.name)}</strong></td>
          <td><code>\${g.id}</code></td>
          <td><span class="badge \${g.hasBot ? 'badge-success' : 'badge-warning'}">\${g.hasBot ? 'Active' : 'Invite Needed'}</span></td>
          <td><span class="badge badge-info">Isolated</span></td>
          <td>
            \${g.hasBot ? \`<a href="/api/guilds/\${g.id}/overview" target="_blank" class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">Manage</a>\` : \`<a href="\${g.inviteUrl}" target="_blank" class="btn btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">Invite</a>\`}
          </td>
        </tr>
      \`).join('');
    }

    async function createBackup() {
      if (!confirm('Create a point-in-time snapshot backup of all server configurations?')) return;
      const res = await fetch('/api/system/database/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.success) {
        alert('Backup created successfully! ID: ' + data.backup.backupId);
        fetchDatabaseInfo();
      } else {
        alert('Error creating backup: ' + (data.error || 'Please sign in first'));
      }
    }

    async function restoreBackup(backupId) {
      if (!confirm('Are you sure you want to restore backup [' + backupId + ']? This will update collections.')) return;
      const res = await fetch('/api/system/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, confirm: true })
      });
      const data = await res.json();
      if (data.success) {
        alert('Database restored successfully from ' + backupId);
        fetchDatabaseInfo();
      } else {
        alert('Restore failed: ' + (data.error || 'Permission denied'));
      }
    }

    async function toggleMaintenance() {
      const active = ${maintenanceActive ? 'true' : 'false'};
      const res = await fetch('/api/developer/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !active })
      });
      const data = await res.json();
      if (data.success) {
        location.reload();
      } else {
        alert('Action failed: ' + (data.error || 'Requires Bot Developer account'));
      }
    }

    async function addBlacklist() {
      const targetId = document.getElementById('blacklist-id')?.value;
      const type = document.getElementById('blacklist-type')?.value;
      const reason = document.getElementById('blacklist-reason')?.value;
      if (!targetId) return alert('Please enter target ID');

      const res = await fetch('/api/developer/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, type, reason })
      });
      const data = await res.json();
      if (data.success) {
        alert('Target added to blacklist.');
        document.getElementById('blacklist-id').value = '';
      } else {
        alert('Error: ' + (data.error || 'Requires Developer account'));
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>`;
}

module.exports = { renderDashboardHTML };
