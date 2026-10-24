import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Award, Save, Plus, Trash2, CheckCircle2, Trophy } from 'lucide-react';

export default function Leveling() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // New role reward input state
  const [newRewardLevel, setNewRewardLevel] = useState('');
  const [newRewardRole, setNewRewardRole] = useState('');

  useEffect(() => {
    // 1. Settings
    api.get(`/api/guilds/${guildId}/settings`)
      .then(res => setSettings(res.data.settings))
      .catch(console.error);

    // 2. Channels
    api.get(`/api/guilds/${guildId}/channels`)
      .then(res => setChannels(res.data.channels || []))
      .catch(console.error);

    // 3. Roles
    api.get(`/api/guilds/${guildId}/roles`)
      .then(res => setRoles(res.data.roles || []))
      .catch(console.error);

    // 4. Leaderboard
    api.get(`/api/guilds/${guildId}/leaderboard`)
      .then(res => setLeaderboard(res.data.users || []))
      .catch(console.error);
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        leveling: settings.leveling
      });
      setToast('Leveling settings saved successfully!');
    } catch (err) {
      setToast('Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const addRoleReward = () => {
    if (!newRewardLevel || !newRewardRole) return;
    const current = settings.leveling?.roleRewards || [];
    setSettings({
      ...settings,
      leveling: {
        ...settings.leveling,
        roleRewards: [...current, { level: parseInt(newRewardLevel, 10), roleId: newRewardRole }]
      }
    });
    setNewRewardLevel('');
    setNewRewardRole('');
  };

  const removeRoleReward = (index) => {
    const current = [...(settings.leveling?.roleRewards || [])];
    current.splice(index, 1);
    setSettings({
      ...settings,
      leveling: {
        ...settings.leveling,
        roleRewards: current
      }
    });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const textChannels = channels.filter(c => c.isText);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Award className="w-7 h-7 text-aura-purpleLight" />
            XP & Leveling Configuration
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Configure rates, announcement messages, role rewards, and view the server leaderboard.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 text-white transition flex items-center gap-2 shadow-purple-glow disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* XP Rates & Cooldown */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <h3 className="font-bold text-lg text-white">XP Parameters</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Min XP per message</label>
              <input
                type="number"
                value={settings.leveling?.xpMin || 15}
                onChange={(e) => setSettings({
                  ...settings,
                  leveling: { ...settings.leveling, xpMin: parseInt(e.target.value, 10) }
                })}
                className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Max XP per message</label>
              <input
                type="number"
                value={settings.leveling?.xpMax || 25}
                onChange={(e) => setSettings({
                  ...settings,
                  leveling: { ...settings.leveling, xpMax: parseInt(e.target.value, 10) }
                })}
                className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">XP Cooldown (Seconds)</label>
            <input
              type="number"
              value={settings.leveling?.cooldownSeconds || 60}
              onChange={(e) => setSettings({
                ...settings,
                leveling: { ...settings.leveling, cooldownSeconds: parseInt(e.target.value, 10) }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            />
            <span className="text-[11px] text-aura-textMuted mt-1 block">Prevents message spamming and XP farming.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Announcement Channel</label>
            <select
              value={settings.leveling?.announcementChannelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                leveling: { ...settings.leveling, announcementChannelId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Current Channel (Where user leveled up)</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Level Up Announcement Template */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white">Announcement Message</h3>
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Message Template</label>
              <textarea
                rows={4}
                value={settings.leveling?.levelUpMessage || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  leveling: { ...settings.leveling, levelUpMessage: e.target.value }
                })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
              />
              <span className="text-[11px] text-aura-textMuted mt-1 block">
                Available tags: <code className="text-aura-purpleLight">{'{user}'}</code>, <code className="text-aura-purpleLight">{'{username}'}</code>, <code className="text-aura-purpleLight">{'{level}'}</code>
              </span>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-xl bg-aura-darker/70 border border-aura-border">
            <span className="text-[10px] uppercase font-bold tracking-wider text-aura-textMuted block mb-1">Live Preview</span>
            <p className="text-xs text-white">
              {(settings.leveling?.levelUpMessage || '')
                .replace(/{user}/g, '@AuraMember')
                .replace(/{username}/g, 'AuraMember')
                .replace(/{level}/g, '5')}
            </p>
          </div>
        </div>
      </div>

      {/* Role Rewards Section */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
        <h3 className="font-bold text-lg text-white">Level Role Rewards</h3>
        <p className="text-xs text-aura-textMuted">Automatically assign server roles when members reach milestone levels.</p>

        {/* Add reward form */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="number"
            placeholder="Level (e.g. 5)"
            value={newRewardLevel}
            onChange={(e) => setNewRewardLevel(e.target.value)}
            className="w-full sm:w-36 px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
          />
          <select
            value={newRewardRole}
            onChange={(e) => setNewRewardRole(e.target.value)}
            className="w-full sm:flex-1 px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
          >
            <option value="">Select Role to Award...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>@{r.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addRoleReward}
            className="w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-sm bg-aura-purple/20 text-aura-purpleLight hover:bg-aura-purple/30 border border-aura-purple/40 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Reward
          </button>
        </div>

        {/* Rewards list */}
        <div className="space-y-2 pt-2">
          {settings.leveling?.roleRewards?.length ? (
            settings.leveling.roleRewards.map((reward, idx) => {
              const role = roles.find(r => r.id === reward.roleId);
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-aura-darker/60 border border-aura-border text-sm">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-aura-purple/20 text-aura-purpleLight font-bold text-xs">
                      Level {reward.level}
                    </span>
                    <span className="text-white font-medium">@{role ? role.name : reward.roleId}</span>
                  </div>
                  <button
                    onClick={() => removeRoleReward(idx)}
                    className="p-1.5 text-aura-textMuted hover:text-aura-red transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-aura-textMuted py-3 text-center">No role rewards configured yet.</p>
          )}
        </div>
      </div>

      {/* Server Leaderboard Table */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="font-bold text-lg text-white">Server XP Leaderboard</h3>
          </div>
          <span className="text-xs text-aura-textMuted font-mono">Top {leaderboard.length} Members</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-aura-textMuted">
            <thead className="bg-aura-darker/80 text-xs uppercase font-bold text-aura-purpleLight border-b border-aura-border">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Current XP</th>
                <th className="py-3 px-4">Messages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aura-border">
              {leaderboard.length ? (
                leaderboard.map((user, idx) => (
                  <tr key={user.userId} className="hover:bg-aura-cardHover transition">
                    <td className="py-3 px-4 font-black text-white">#{idx + 1}</td>
                    <td className="py-3 px-4 font-mono text-white text-xs">{user.userId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-aura-purple/20 text-aura-purpleLight font-bold text-xs">
                        Lvl {user.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">{user.xp.toLocaleString()} XP</td>
                    <td className="py-3 px-4">{user.totalMessages || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-aura-textMuted">No users have earned XP yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
