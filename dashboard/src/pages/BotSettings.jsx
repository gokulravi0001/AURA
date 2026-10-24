import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export default function BotSettings() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/settings`)
      .then(res => setSettings(res.data.settings))
      .catch(console.error);
  }, [guildId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        prefix: settings.prefix
      });
      setToast('Bot settings saved successfully!');
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-aura-purpleLight" />
            General Bot Settings
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Configure server command prefix and core bot behavior.
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

      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4 max-w-xl">
        <h3 className="font-bold text-lg text-white">Command Prefix</h3>
        <p className="text-xs text-aura-textMuted">
          Set the character or symbol used to trigger text commands on your server.
        </p>

        <div>
          <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Prefix</label>
          <input
            type="text"
            value={settings.prefix || '+'}
            maxLength={5}
            onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
            className="w-32 px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-base font-mono font-bold focus:outline-none focus:border-aura-purple"
          />
          <span className="text-xs text-aura-textMuted mt-2 block">
            Current example: <code className="text-aura-purpleLight font-bold">{settings.prefix || '+'}help</code>
          </span>
        </div>
      </div>
    </div>
  );
}
