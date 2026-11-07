import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Search, Plus, Settings2, ShieldAlert, Globe, Sparkles, Eye, Users } from 'lucide-react';

export default function ServerSelect() {
  const [guilds, setGuilds] = useState([]);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const apiBase = import.meta.env.VITE_API_URL || '';
  const loginUrl = `${apiBase}/api/auth/login`;

  useEffect(() => {
    api.get('/api/auth/guilds')
      .then(res => {
        setGuilds(res.data.guilds || []);
        setIsGuest(!!res.data.isGuest);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load servers.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = guilds.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Select a Server</h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Explore live server dashboards or select a server to manage.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-aura-textMuted" />
          <input
            type="text"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-aura-card border border-aura-border text-sm text-white placeholder-aura-textMuted focus:outline-none focus:border-aura-purple transition"
          />
        </div>
      </div>

      {/* Guest Mode Banner */}
      {isGuest && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-aura-card to-aura-darker border border-aura-purple/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-purple-glow">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-aura-purple/20 border border-aura-purple/40 flex items-center justify-center text-aura-purpleLight shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Public Guest Mode Active
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">
                  Open Access
                </span>
              </h4>
              <p className="text-xs text-aura-textMuted mt-0.5">
                Anyone can freely explore server stats, leveling leaderboards, voice lounges, and modules! Sign in with Discord to manage settings.
              </p>
            </div>
          </div>
          <a
            href={loginUrl}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-90 transition shrink-0 flex items-center justify-center gap-1.5 shadow-purple-glow"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sign In to Manage
          </a>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-10 h-10 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-aura-textMuted font-medium">Fetching servers...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-aura-red/30 flex items-center gap-3 text-aura-redLight">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-aura-card rounded-2xl border border-aura-border">
          <p className="text-aura-textMuted text-base">No servers found matching "{search}".</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((guild) => (
          <div
            key={guild.id}
            className="p-5 rounded-2xl bg-aura-card border border-aura-border hover:border-aura-purple/50 transition-all duration-300 flex flex-col justify-between group hover:shadow-purple-glow"
          >
            <div>
              <div className="flex items-center gap-4 mb-4">
                {guild.icon ? (
                  <img
                    src={guild.icon}
                    alt={guild.name}
                    className="w-14 h-14 rounded-2xl border border-aura-border object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-aura-purple to-aura-red flex items-center justify-center font-bold text-lg text-white">
                    {guild.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden">
                  <h3 className="font-bold text-white text-base truncate group-hover:text-aura-purpleLight transition">
                    {guild.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        guild.hasBot
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}
                    >
                      {guild.hasBot ? '● Active' : '○ Not Joined'}
                    </span>
                    {guild.memberCount > 0 && (
                      <span className="text-[11px] text-aura-textMuted flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {guild.memberCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {guild.hasBot ? (
              <Link
                to={`/servers/${guild.id}`}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 text-white transition flex items-center justify-center gap-2 shadow-purple-glow"
              >
                {guild.canManage ? (
                  <>
                    <Settings2 className="w-4 h-4" />
                    Manage Server
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    View Dashboard
                  </>
                )}
              </Link>
            ) : (
              <a
                href={guild.inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-aura-cardHover border border-aura-border hover:border-aura-purple text-aura-purpleLight hover:text-white transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Invite AURA
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
