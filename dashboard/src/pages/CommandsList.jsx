import React, { useState } from 'react';
import { Terminal, Search, Shield, User } from 'lucide-react';

export default function CommandsList() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const commands = [
    { name: 'ping', slash: '/ping', prefix: '+ping', category: 'General', desc: 'Check AURA bot latency and Discord API response time', perm: 'Everyone' },
    { name: 'help', slash: '/help', prefix: '+help', category: 'General', desc: 'Explore all AURA commands, features, and dashboard link', perm: 'Everyone' },
    { name: 'stats', slash: '/stats', prefix: '+stats', category: 'General', desc: 'Display detailed server and bot analytics', perm: 'Everyone' },
    { name: 'rank', slash: '/rank [user]', prefix: '+rank [@user]', category: 'Leveling', desc: 'Check your or another member\'s XP, level, and server rank', perm: 'Everyone' },
    { name: 'leaderboard', slash: '/leaderboard', prefix: '+leaderboard', category: 'Leveling', desc: 'View the top 10 ranked members on this server', perm: 'Everyone' },
    { name: 'addxp', slash: '/addxp <user> <amount>', prefix: '+addxp <@user> <amount>', category: 'Leveling', desc: 'Add XP to a member', perm: 'Administrator' },
    { name: 'voice lock', slash: '/voice lock', prefix: '+voice lock', category: 'Voice', desc: 'Lock your temporary voice channel from new members', perm: 'Channel Owner' },
    { name: 'voice unlock', slash: '/voice unlock', prefix: '+voice unlock', category: 'Voice', desc: 'Unlock your temporary voice channel', perm: 'Channel Owner' },
    { name: 'voice limit', slash: '/voice limit <count>', prefix: '+voice limit <count>', category: 'Voice', desc: 'Set max member limit for your voice lounge', perm: 'Channel Owner' },
    { name: 'voice rename', slash: '/voice rename <name>', prefix: '+voice rename <name>', category: 'Voice', desc: 'Rename your temporary voice channel', perm: 'Channel Owner' },
    { name: 'ticket-panel', slash: '/ticket-panel [channel]', prefix: '+ticket-panel', category: 'Tickets', desc: 'Post a support ticket panel with interactive button', perm: 'Administrator' },
    { name: 'sticky set', slash: '/sticky set <text>', prefix: '+sticky <text>', category: 'Moderation', desc: 'Set or update a sticky message in the channel', perm: 'Manage Messages' },
    { name: 'sticky remove', slash: '/sticky remove', prefix: '+sticky remove', category: 'Moderation', desc: 'Remove the sticky message from the channel', perm: 'Manage Messages' },
    { name: 'birthday set', slash: '/birthday set', prefix: '+birthday <DD/MM>', category: 'Birthdays', desc: 'Register your birthday with date modal', perm: 'Everyone' },
    { name: 'birthday list', slash: '/birthday list', prefix: '+birthday list', category: 'Birthdays', desc: 'List upcoming server birthdays', perm: 'Everyone' },
    { name: 'rps', slash: '/games rps [@user]', prefix: '+rps [@user]', category: 'Games', desc: 'Play Rock Paper Scissors with buttons', perm: 'Everyone' },
    { name: 'setup-counting', slash: '/games setup-counting <#channel>', prefix: '+counting-setup', category: 'Games', desc: 'Set the dedicated counting game channel', perm: 'Administrator' },
    { name: 'setup-wordchain', slash: '/games setup-wordchain <#channel>', prefix: '+wordchain-setup', category: 'Games', desc: 'Set the dedicated word chain game channel', perm: 'Administrator' },
    { name: 'bump status', slash: '/bump status', prefix: '+bump', category: 'Bump', desc: 'Check when the next server bump is due', perm: 'Everyone' },
    { name: 'bump done', slash: '/bump done', prefix: '+bump done', category: 'Bump', desc: 'Mark server as bumped and start countdown timer', perm: 'Everyone' }
  ];

  const categories = ['All', 'General', 'Leveling', 'Voice', 'Tickets', 'Moderation', 'Birthdays', 'Games', 'Bump'];

  const filtered = commands.filter(cmd => {
    const matchesCategory = selectedCategory === 'All' || cmd.category === selectedCategory;
    const matchesSearch = cmd.name.toLowerCase().includes(search.toLowerCase()) ||
                          cmd.desc.toLowerCase().includes(search.toLowerCase()) ||
                          cmd.prefix.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Terminal className="w-7 h-7 text-aura-purpleLight" />
            Command Documentation
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Complete list of slash commands and <code className="text-aura-purpleLight font-bold">+</code> prefix commands.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-aura-textMuted" />
          <input
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-aura-card border border-aura-border text-sm text-white placeholder-aura-textMuted focus:outline-none focus:border-aura-purple"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCategory === cat
                ? 'bg-aura-purple text-white shadow-purple-glow'
                : 'bg-aura-card border border-aura-border text-aura-textMuted hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((cmd, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-aura-card border border-aura-border hover:border-aura-purple/50 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-base">{cmd.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  cmd.perm === 'Administrator' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  cmd.perm === 'Manage Messages' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                  'bg-zinc-500/20 text-zinc-300'
                }`}>
                  {cmd.perm}
                </span>
              </div>
              <p className="text-xs text-aura-textMuted">{cmd.desc}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-aura-border flex items-center justify-between gap-2 text-xs font-mono">
              <span className="px-2 py-1 rounded bg-aura-darker text-aura-purpleLight border border-aura-border">
                {cmd.slash}
              </span>
              <span className="px-2 py-1 rounded bg-aura-darker text-aura-redLight border border-aura-border">
                {cmd.prefix}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
