import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import {
  Users,
  Bot,
  UserCheck,
  Mic,
  Ticket,
  Award,
  Layers,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function Overview() {
  const { guildId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/overview`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { guild, settings, topXp, statsHistory } = data || {};

  const statCards = [
    { label: 'Total Members', value: guild?.memberCount || 0, icon: Users, color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/30' },
    { label: 'Humans', value: guild?.humans || 0, icon: UserCheck, color: 'from-red-500/20 to-red-500/5', border: 'border-red-500/30' },
    { label: 'Bots', value: guild?.bots || 0, icon: Bot, color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30' },
    { label: 'In Voice Channels', value: guild?.voiceActive || 0, icon: Mic, color: 'from-green-500/20 to-green-500/5', border: 'border-green-500/30' },
  ];

  // Enabled modules count
  const modules = settings?.modules || {};
  const activeModulesCount = Object.values(modules).filter(Boolean).length;
  const totalModulesCount = Object.keys(modules).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-aura-card border border-aura-border relative overflow-hidden shadow-aura-card">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-aura-purple/20 via-aura-red/10 to-transparent blur-3xl -z-10"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {guild?.icon ? (
              <img src={guild.icon} alt={guild.name} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-aura-border object-cover shadow-purple-glow" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-aura-purple to-aura-red flex items-center justify-center font-black text-2xl text-white">
                {guild?.name ? guild.name.substring(0, 2).toUpperCase() : 'GS'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black text-white">{guild?.name}</h1>
                <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold border border-green-500/20">
                  Online
                </span>
              </div>
              <p className="text-sm text-aura-textMuted mt-1">
                Prefix: <code className="px-1.5 py-0.5 rounded bg-aura-darker text-aura-purpleLight font-bold">{settings?.prefix || '+'}</code> •
                Active Modules: <span className="font-semibold text-white">{activeModulesCount} / {totalModulesCount}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/servers/${guildId}/modules`}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 text-white transition flex items-center gap-2 shadow-purple-glow"
            >
              <Layers className="w-4 h-4" />
              Configure Modules
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl bg-aura-card border ${card.border} bg-gradient-to-br ${card.color} flex items-center justify-between`}
            >
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-aura-textMuted">{card.label}</span>
                <h3 className="text-2xl font-black text-white mt-1">{card.value.toLocaleString()}</h3>
              </div>
              <div className="p-3 rounded-xl bg-aura-darker/60 text-white border border-aura-border">
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Server Activity Trends</h3>
              <p className="text-xs text-aura-textMuted">Recorded message volume over the last 7 days</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-aura-purple/10 text-aura-purpleLight border border-aura-purple/20">
              Live Mongo Analytics
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            {statsHistory && statsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statsHistory}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#120f1a', borderColor: '#281e3a', borderRadius: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="messagesRecorded" stroke="#9333ea" strokeWidth={3} fillOpacity={1} fill="url(#chartGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-aura-textMuted text-sm">
                Activity data is being gathered. Activity charts will appear as members chat!
              </div>
            )}
          </div>
        </div>

        {/* Top XP Leaderboard Quick Card */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-aura-purpleLight" />
                <h3 className="text-lg font-bold text-white">Top Members</h3>
              </div>
              <Link
                to={`/servers/${guildId}/leveling`}
                className="text-xs font-semibold text-aura-purpleLight hover:text-white flex items-center gap-1 transition"
              >
                View All
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {topXp && topXp.length > 0 ? (
                topXp.map((user, idx) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-aura-darker/60 border border-aura-border text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-sm text-aura-purpleLight w-5 text-center">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-white truncate max-w-[120px]">
                        User {user.userId.substring(0, 5)}...
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white">Level {user.level}</span>
                      <span className="block text-[11px] text-aura-textMuted font-mono">
                        {user.xp.toLocaleString()} XP
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-aura-textMuted py-8 text-center">No leveling data recorded yet.</p>
              )}
            </div>
          </div>

          <Link
            to={`/servers/${guildId}/leveling`}
            className="w-full mt-4 py-2.5 rounded-xl font-bold text-xs bg-aura-cardHover border border-aura-border hover:border-aura-purple text-center text-white transition block"
          >
            Configure Leveling System
          </Link>
        </div>
      </div>
    </div>
  );
}
