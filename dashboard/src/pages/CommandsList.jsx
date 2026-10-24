import React, { useState } from 'react';
import { Terminal, Search, Shield, User } from 'lucide-react';

export default function CommandsList() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const commands = [
    // General
    { name: 'ping', slash: '/ping', prefix: '+ping', category: 'General', desc: 'Check AURA bot latency and Discord API response time', perm: 'Everyone' },
    { name: 'help', slash: '/help', prefix: '+help', category: 'General', desc: 'Explore all AURA commands, features, and dashboard link', perm: 'Everyone' },
    { name: 'stats', slash: '/stats', prefix: '+stats', category: 'General', desc: 'Display detailed server and bot analytics', perm: 'Everyone' },

    // Leveling
    { name: 'rank', slash: '/rank [user]', prefix: '+rank [@user]', category: 'Leveling', desc: 'Check your or another member\'s XP, level, and server rank', perm: 'Everyone' },
    { name: 'leaderboard', slash: '/leaderboard', prefix: '+leaderboard', category: 'Leveling', desc: 'View the top 10 ranked members on this server', perm: 'Everyone' },
    { name: 'rewards view', slash: '/rewards view', prefix: '+rewards', category: 'Leveling', desc: 'View all configured level role rewards on the server', perm: 'Everyone' },
    { name: 'rewards add', slash: '/rewards add <level> <role>', prefix: '+rewards add <level> @role', category: 'Leveling', desc: 'Configure a role reward for reaching a level', perm: 'Administrator' },
    { name: 'rewards remove', slash: '/rewards remove <level>', prefix: '+rewards remove <level>', category: 'Leveling', desc: 'Remove a level role reward', perm: 'Administrator' },
    { name: 'addxp', slash: '/addxp <user> <amount>', prefix: '+addxp <@user> <amount>', category: 'Leveling', desc: 'Add XP to a member', perm: 'Administrator' },
    { name: 'resetxp', slash: '/resetxp [user] [server]', prefix: '+resetxp @user / +resetxp all', category: 'Leveling', desc: 'Reset XP for a specific member or all server members', perm: 'Administrator' },
    { name: 'level-settings', slash: '/level-settings <view|channel|rates>', prefix: '+level-settings', category: 'Leveling', desc: 'Configure XP rate limits, cooldowns, and announcement channels', perm: 'Administrator' },

    // Voice
    { name: 'voice setup', slash: '/voice setup [format]', prefix: '+voice setup', category: 'Voice', desc: 'Create Join-to-Create trigger channel and category automatically', perm: 'Administrator' },
    { name: 'voice lock', slash: '/voice lock', prefix: '+voice lock', category: 'Voice', desc: 'Lock your temporary voice channel from new members', perm: 'Channel Owner' },
    { name: 'voice unlock', slash: '/voice unlock', prefix: '+voice unlock', category: 'Voice', desc: 'Unlock your temporary voice channel', perm: 'Channel Owner' },
    { name: 'voice hide', slash: '/voice hide', prefix: '+voice hide', category: 'Voice', desc: 'Hide your temporary voice channel from @everyone', perm: 'Channel Owner' },
    { name: 'voice show', slash: '/voice show', prefix: '+voice show', category: 'Voice', desc: 'Make your temporary voice channel visible to @everyone', perm: 'Channel Owner' },
    { name: 'voice limit', slash: '/voice limit <count>', prefix: '+voice limit <count>', category: 'Voice', desc: 'Set max member limit for your voice lounge (0-99)', perm: 'Channel Owner' },
    { name: 'voice rename', slash: '/voice rename <name>', prefix: '+voice rename <name>', category: 'Voice', desc: 'Rename your temporary voice channel', perm: 'Channel Owner' },
    { name: 'voice transfer', slash: '/voice transfer <target>', prefix: '+voice transfer @member', category: 'Voice', desc: 'Transfer channel ownership to another member in the lounge', perm: 'Channel Owner' },

    // Birthdays
    { name: 'birthday view', slash: '/birthday view [user]', prefix: '+birthday view [@user]', category: 'Birthdays', desc: 'View registered birthday and countdown of days remaining', perm: 'Everyone' },
    { name: 'birthday set', slash: '/birthday set [date]', prefix: '+birthday <DD/MM/YYYY>', category: 'Birthdays', desc: 'Register your birthday using modal or direct date', perm: 'Everyone' },
    { name: 'birthday list', slash: '/birthday list', prefix: '+birthday list', category: 'Birthdays', desc: 'List upcoming server birthdays in order', perm: 'Everyone' },
    { name: 'birthday remove', slash: '/birthday remove', prefix: '+birthday remove', category: 'Birthdays', desc: 'Remove your registered birthday from this server', perm: 'Everyone' },
    { name: 'birthday setup', slash: '/birthday setup <channel> [role]', prefix: '+birthday setup #channel [@role]', category: 'Birthdays', desc: 'Configure birthday announcement channel and role', perm: 'Administrator' },

    // Tickets
    { name: 'ticket panel', slash: '/ticket panel [channel] [title]', prefix: '+ticket-panel', category: 'Tickets', desc: 'Post a support ticket panel with interactive button', perm: 'Administrator' },
    { name: 'ticket setup', slash: '/ticket setup <category> [staff_role]', prefix: '+ticket setup', category: 'Tickets', desc: 'Configure ticket category and support staff role', perm: 'Administrator' },
    { name: 'ticket close', slash: '/ticket close', prefix: '+close', category: 'Tickets', desc: 'Close and archive current support ticket and save transcript', perm: 'Ticket Staff' },
    { name: 'ticket claim', slash: '/ticket claim', prefix: '+claim', category: 'Tickets', desc: 'Claim the current support ticket', perm: 'Ticket Staff' },
    { name: 'ticket add', slash: '/ticket add <user>', prefix: '+ticket add @user', category: 'Tickets', desc: 'Add a user to this ticket channel', perm: 'Ticket Staff' },

    // Moderation & Counters
    { name: 'sticky set', slash: '/sticky set <text> [title] [channel]', prefix: '+sticky <text>', category: 'Moderation', desc: 'Set or update a sticky message in the channel', perm: 'Manage Messages' },
    { name: 'sticky list', slash: '/sticky list', prefix: '+sticky list', category: 'Moderation', desc: 'List all channels with active sticky messages', perm: 'Manage Messages' },
    { name: 'sticky remove', slash: '/sticky remove [channel]', prefix: '+sticky remove', category: 'Moderation', desc: 'Remove the sticky message from the channel', perm: 'Manage Messages' },
    { name: 'threads setup', slash: '/threads setup <channel> [format]', prefix: '+threads setup #channel', category: 'Moderation', desc: 'Set up automatic discussion threads for image posts', perm: 'Manage Channels' },
    { name: 'threads status', slash: '/threads status', prefix: '+threads', category: 'Moderation', desc: 'View current image thread settings', perm: 'Manage Channels' },
    { name: 'counters setup', slash: '/counters setup', prefix: '+counters-setup', category: 'Counters', desc: 'Automated wizard to create locked voice stat counters', perm: 'Manage Channels' },
    { name: 'counters update', slash: '/counters update', prefix: '+counters update', category: 'Counters', desc: 'Force refresh all server counter channel numbers', perm: 'Manage Channels' },

    // Games
    { name: 'games rps', slash: '/games rps [opponent]', prefix: '+rps [@user]', category: 'Games', desc: 'Play Rock Paper Scissors with button controls', perm: 'Everyone' },
    { name: 'games trivia', slash: '/games trivia', prefix: '+trivia', category: 'Games', desc: 'Answer an interactive trivia question with buttons', perm: 'Everyone' },
    { name: 'counting-setup', slash: '/games counting-setup <#channel>', prefix: '+counting setup #channel', category: 'Games', desc: 'Set the dedicated counting game channel', perm: 'Administrator' },
    { name: 'counting-status', slash: '/games counting-status', prefix: '+counting', category: 'Games', desc: 'View counting streak and record high score', perm: 'Everyone' },
    { name: 'wordchain-setup', slash: '/games wordchain-setup <#channel>', prefix: '+wordchain setup #channel', category: 'Games', desc: 'Set the dedicated word chain game channel', perm: 'Administrator' },
    { name: 'wordchain-status', slash: '/games wordchain-status', prefix: '+wordchain', category: 'Games', desc: 'View current word chain streak and last word', perm: 'Everyone' },

    // Bump
    { name: 'bump status', slash: '/bump status', prefix: '+bump', category: 'Bump', desc: 'Check when the next server bump is due', perm: 'Everyone' },
    { name: 'bump done', slash: '/bump done', prefix: '+bump done', category: 'Bump', desc: 'Mark server as bumped and start countdown timer', perm: 'Everyone' },
    { name: 'bump setup', slash: '/bump setup <channel> [role] [interval]', prefix: '+bump setup #channel [@role]', category: 'Bump', desc: 'Configure reminder channel, role, and interval', perm: 'Administrator' }
  ];

  const categories = ['All', 'General', 'Leveling', 'Voice', 'Birthdays', 'Tickets', 'Moderation', 'Counters', 'Games', 'Bump'];

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
            Complete list of all 17 command suites with both Slash commands and <code className="text-aura-purpleLight font-bold">+</code> prefix syntax.
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
                  cmd.perm.includes('Owner') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                  cmd.perm.includes('Manage') || cmd.perm.includes('Staff') ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
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
