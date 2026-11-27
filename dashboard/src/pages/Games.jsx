import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Gamepad2, Save, CheckCircle2, Hash, Link2 } from 'lucide-react';

export default function Games() {
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
        countingGame: settings.countingGame,
        wordChainGame: settings.wordChainGame
      });
      setToast('Minigames configuration saved!');
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
            <Gamepad2 className="w-7 h-7 text-aura-purpleLight" />
            Minigames & Channel Games
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Setup dedicated channels for Counting and Word Chain games with anti-cheat protection.
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
        {/* Counting Game */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-aura-purple/20 text-aura-purpleLight">
                <Hash className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Counting Game</h3>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-aura-darker text-aura-purpleLight border border-aura-border">
              High Score: {settings.countingGame?.highScore || 0}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Designated Counting Channel</label>
            <select
              value={settings.countingGame?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                countingGame: {
                  ...settings.countingGame,
                  enabled: !!e.target.value,
                  channelId: e.target.value || null
                }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Disabled (No Channel)</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-aura-darker/60 border border-aura-border">
            <div>
              <span className="text-sm font-semibold text-white block">Allow Consecutive Turns</span>
              <span className="text-xs text-aura-textMuted">Can the same member count twice in a row?</span>
            </div>
            <button
              type="button"
              onClick={() => setSettings({
                ...settings,
                countingGame: {
                  ...settings.countingGame,
                  allowConsecutive: !settings.countingGame?.allowConsecutive
                }
              })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.countingGame?.allowConsecutive ? 'bg-aura-purple' : 'bg-aura-border'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ease-in-out ${
                  settings.countingGame?.allowConsecutive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Word Chain Game */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-aura-red/20 text-aura-redLight">
                <Link2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-white">Word Chain</h3>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-aura-darker text-aura-redLight border border-aura-border">
              High Streak: {settings.wordChainGame?.highScore || 0}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Designated Word Chain Channel</label>
            <select
              value={settings.wordChainGame?.channelId || ''}
              onChange={(e) => setSettings({
                ...settings,
                wordChainGame: {
                  ...settings.wordChainGame,
                  enabled: !!e.target.value,
                  channelId: e.target.value || null
                }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">Disabled (No Channel)</option>
              {textChannels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-aura-darker/60 border border-aura-border space-y-1">
            <span className="text-xs font-bold text-white block">Rules:</span>
            <p className="text-xs text-aura-textMuted leading-relaxed">
              Every word must begin with the last letter of the previous word. Repeated words in the same chain are rejected automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
