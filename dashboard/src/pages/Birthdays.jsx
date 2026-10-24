import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Cake, Save, CheckCircle2 } from 'lucide-react';

export default function Birthdays() {
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
        birthdays: settings.birthdays
      });
      setToast('Birthday settings updated successfully!');
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
            <Cake className="w-7 h-7 text-aura-purpleLight" />
            Birthday Celebrations
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Configure automated birthday wishes, announcement channels, and special birthday roles.
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
          <h3 className="font-bold text-lg text-white">General Birthday Settings</h3>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Wish Announcement Channel</label>
            <select
              value={settings.birthdays?.wishChannelId || settings.birthdays?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                birthdays: {
                  ...settings.birthdays,
                  wishChannelId: e.target.value || null,
                  channelId: e.target.value || null
                }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Select Wish Channel...</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <span className="text-[11px] text-aura-textMuted mt-1 block">Where the bot publicly sends birthday celebrations and pings celebrants.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Member Registration Channel (DD/MM/YYYY)</label>
            <select
              value={settings.birthdays?.setChannelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                birthdays: {
                  ...settings.birthdays,
                  setChannelId: e.target.value || null
                }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Select Input Channel (Optional)...</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <span className="text-[11px] text-aura-textMuted mt-1 block">Members type their birthdate in DD/MM/YYYY format here. The bot deletes their message immediately and DMs confirmation!</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Special Birthday Role (Optional)</label>
            <select
              value={settings.birthdays?.roleId || ''}
              onChange={(e) => setSettings({
                ...settings,
                birthdays: { ...settings.birthdays, roleId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">None</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>@{r.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Server Timezone</label>
              <select
                value={settings.birthdays?.timezone || 'UTC'}
                onChange={(e) => setSettings({
                  ...settings,
                  birthdays: { ...settings.birthdays, timezone: e.target.value }
                })}
                className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST (New York)</option>
                <option value="America/Los_Angeles">PST (Los Angeles)</option>
                <option value="Europe/London">GMT (London)</option>
                <option value="Europe/Berlin">CET (Berlin)</option>
                <option value="Asia/Kolkata">IST (India)</option>
                <option value="Asia/Tokyo">JST (Tokyo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Leap-Year Birthday Policy</label>
              <select
                value={settings.birthdays?.leapDayPolicy || 'Feb28'}
                onChange={(e) => setSettings({
                  ...settings,
                  birthdays: { ...settings.birthdays, leapDayPolicy: e.target.value }
                })}
                className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
              >
                <option value="Feb28">Wish on Feb 28th</option>
                <option value="Mar1">Wish on Mar 1st</option>
              </select>
            </div>
          </div>
        </div>

        {/* Wish Message Template */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <h3 className="font-bold text-lg text-white">Birthday Wish Message</h3>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Custom Message Template</label>
            <textarea
              rows={4}
              value={settings.birthdays?.message || ''}
              onChange={(e) => setSettings({
                ...settings,
                birthdays: { ...settings.birthdays, message: e.target.value }
              })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            />
            <span className="text-[11px] text-aura-textMuted mt-1 block">
              Available tags: <code className="text-aura-purpleLight">{'{user}'}</code> and <code className="text-aura-purpleLight">{'{username}'}</code>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-aura-darker/70 border border-aura-border">
            <span className="text-[10px] uppercase font-bold tracking-wider text-aura-textMuted block mb-1">Live Preview</span>
            <p className="text-xs text-white">
              {(settings.birthdays?.message || '')
                .replace(/{user}/g, '@AuraMember')
                .replace(/{username}/g, 'AuraMember')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
