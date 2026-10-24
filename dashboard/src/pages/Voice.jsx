import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Mic, BarChart3, Save, CheckCircle2, Wand2 } from 'lucide-react';

export default function Voice() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/settings`)
      .then(res => setSettings(res.data.settings))
      .catch(console.error);

    api.get(`/api/guilds/${guildId}/channels`)
      .then(res => setChannels(res.data.channels || []))
      .catch(console.error);
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        joinToCreate: settings.joinToCreate,
        voiceCounters: settings.voiceCounters
      });
      setToast('Voice and counter settings saved!');
    } catch (err) {
      setToast('Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const voiceChannels = channels.filter(c => c.isVoice);
  const categories = channels.filter(c => c.isCategory);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Mic className="w-7 h-7 text-aura-purpleLight" />
            Voice Channels & Counters
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Configure Join-to-Create temporary voice lounges and automated voice statistics channels.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 text-white transition flex items-center gap-2 shadow-purple-glow"
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

      {/* 1. Join-to-Create Voice */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-white">Join-to-Create Voice Channels</h3>
            <p className="text-xs text-aura-textMuted mt-0.5">
              Members who join the trigger channel are moved into their own temporary private voice lounge.
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            settings.joinToCreate?.enabled ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
          }`}>
            {settings.joinToCreate?.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Trigger Voice Channel</label>
            <select
              value={settings.joinToCreate?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                joinToCreate: { ...settings.joinToCreate, channelId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Select Trigger Channel...</option>
              {voiceChannels.map(c => (
                <option key={c.id} value={c.id}>🔊 {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Parent Category</label>
            <select
              value={settings.joinToCreate?.categoryId || ''}
              onChange={(e) => setSettings({
                ...settings,
                joinToCreate: { ...settings.joinToCreate, categoryId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Default (Same category as trigger)</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>📁 {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Channel Name Format</label>
            <input
              type="text"
              value={settings.joinToCreate?.channelNameFormat || "🔊 {username}'s Lounge"}
              onChange={(e) => setSettings({
                ...settings,
                joinToCreate: { ...settings.joinToCreate, channelNameFormat: e.target.value }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            />
            <span className="text-[11px] text-aura-textMuted mt-1 block">Supports <code className="text-aura-purpleLight">{'{username}'}</code> and <code className="text-aura-purpleLight">{'{tag}'}</code></span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">User Limit (0 = Unlimited)</label>
            <input
              type="number"
              value={settings.joinToCreate?.userLimit || 0}
              onChange={(e) => setSettings({
                ...settings,
                joinToCreate: { ...settings.joinToCreate, userLimit: parseInt(e.target.value, 10) }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            />
          </div>
        </div>
      </div>

      {/* 2. Automated Voice Counters */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-aura-purple/20 text-aura-purpleLight">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Live Server Stat Counters</h3>
              <p className="text-xs text-aura-textMuted">
                Displays live counts for Total Members, Humans, Bots, and Active Voice members in locked channels.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const current = settings.voiceCounters?.enabled;
                setSettings({
                  ...settings,
                  voiceCounters: { ...settings.voiceCounters, enabled: !current }
                });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                settings.voiceCounters?.enabled
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-aura-darker text-aura-textMuted border-aura-border'
              }`}
            >
              {settings.voiceCounters?.enabled ? 'Counters Enabled' : 'Enable Counters'}
            </button>
          </div>
        </div>

        <p className="text-xs text-aura-textMuted">
          💡 You can run <code className="px-1.5 py-0.5 rounded bg-aura-darker text-aura-purpleLight font-mono">+counters-setup</code> inside Discord to automatically generate the category and all counter channels instantly!
        </p>
      </div>
    </div>
  );
}
