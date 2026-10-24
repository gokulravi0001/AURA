import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Flame, Save, CheckCircle2, Clock } from 'lucide-react';

export default function BumpSettings() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/settings`)
      .then(res => setSettings(res.data.settings))
      .catch(console.error);

    api.get(`/api/guilds/${guildId}/channels`)
      .then(res => setChannels(res.data.channels || []))
      .catch(console.error);

    api.get(`/api/guilds/${guildId}/roles`)
      .then(res => setRoles(res.data.roles || []))
      .catch(console.error);
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        bumpReminder: settings.bumpReminder
      });
      setToast('Bump reminder settings saved!');
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
            <Flame className="w-7 h-7 text-aura-redLight" />
            Bump Reminders & Automation
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Automate bump reminders to keep your Discord server prominently featured and growing.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <h3 className="font-bold text-lg text-white">Reminder Schedule</h3>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Reminder Channel</label>
            <select
              value={settings.bumpReminder?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                bumpReminder: { ...settings.bumpReminder, channelId: e.target.value || null }
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
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Ping Role (Optional)</label>
            <select
              value={settings.bumpReminder?.reminderRoleId || ''}
              onChange={(e) => setSettings({
                ...settings,
                bumpReminder: { ...settings.bumpReminder, reminderRoleId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            >
              <option value="">@here (Default)</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>@{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Interval (Minutes)</label>
            <input
              type="number"
              value={settings.bumpReminder?.intervalMinutes || 120}
              onChange={(e) => setSettings({
                ...settings,
                bumpReminder: { ...settings.bumpReminder, intervalMinutes: parseInt(e.target.value, 10) }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            />
            <span className="text-[11px] text-aura-textMuted mt-1 block">Default is 120 minutes (2 hours) for Disboard.</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <h3 className="font-bold text-lg text-white">Reminder Message</h3>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Custom Alert Text</label>
            <textarea
              rows={4}
              value={settings.bumpReminder?.reminderMessage || ''}
              onChange={(e) => setSettings({
                ...settings,
                bumpReminder: { ...settings.bumpReminder, reminderMessage: e.target.value }
              })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            />
            <span className="text-[11px] text-aura-textMuted mt-1 block">Use <code className="text-aura-purpleLight">{'{role}'}</code> to mention the designated bump role.</span>
          </div>

          <div className="p-4 rounded-xl bg-aura-darker/70 border border-aura-border space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-aura-textMuted block">Smart Automation</span>
            <p className="text-xs text-aura-textMuted">
              When someone runs <code className="text-white">/bump</code>, AURA detects Disboard's confirmation automatically and resets the countdown timer with zero human effort!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
