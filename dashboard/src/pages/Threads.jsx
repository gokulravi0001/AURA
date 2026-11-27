import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { MessageSquareShare, Save, CheckCircle2 } from 'lucide-react';

export default function Threads() {
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
        imageThreads: settings.imageThreads
      });
      setToast('Image threads settings saved!');
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

  const textChannels = channels.filter(c => c.isText);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <MessageSquareShare className="w-7 h-7 text-aura-purpleLight" />
            Automatic Image Threads
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Automatically create dedicated discussion threads whenever qualifying image posts appear.
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

      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
        <h3 className="font-bold text-lg text-white">Thread Automation Rules</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Monitored Channel</label>
            <select
              value={settings.imageThreads?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                imageThreads: { ...settings.imageThreads, channelId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            >
              <option value="">Select Channel...</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Auto-Archive Duration</label>
            <select
              value={settings.imageThreads?.autoArchiveDuration || 1440}
              onChange={(e) => setSettings({
                ...settings,
                imageThreads: { ...settings.imageThreads, autoArchiveDuration: parseInt(e.target.value, 10) }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            >
              <option value={60}>1 Hour</option>
              <option value={1440}>24 Hours (Recommended)</option>
              <option value={4320}>3 Days</option>
              <option value={10080}>1 Week</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Thread Title Format</label>
          <input
            type="text"
            value={settings.imageThreads?.threadNameFormat || '💬 Discussion - {author}'}
            onChange={(e) => setSettings({
              ...settings,
              imageThreads: { ...settings.imageThreads, threadNameFormat: e.target.value }
            })}
            className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
          />
          <span className="text-[11px] text-aura-textMuted mt-1 block">Supports <code className="text-aura-purpleLight">{'{author}'}</code></span>
        </div>
      </div>
    </div>
  );
}
