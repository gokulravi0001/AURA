import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import {
  Award,
  Mic,
  Ticket,
  Cake,
  Gamepad2,
  Pin,
  Flame,
  MessageSquareShare,
  BarChart3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Modules() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/settings`)
      .then(res => setSettings(res.data.settings))
      .catch(err => console.error(err));
  }, [guildId]);

  const toggleModule = async (moduleKey) => {
    if (!settings) return;

    const updatedModules = {
      ...settings.modules,
      [moduleKey]: !settings.modules[moduleKey]
    };

    setSettings({
      ...settings,
      modules: updatedModules
    });

    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        modules: updatedModules
      });
      setToast({ type: 'success', text: `Module ${moduleKey} updated successfully!` });
    } catch (err) {
      setToast({ type: 'error', text: 'Failed to update module.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const moduleDefinitions = [
    { key: 'leveling', name: 'XP & Leveling System', icon: Award, desc: 'Awards XP for chat messages, ranks members, and grants role rewards.' },
    { key: 'join_to_create', name: 'Join-to-Create Voice Channels', icon: Mic, desc: 'Automatically generates temporary voice lounges when members join a trigger channel.' },
    { key: 'tickets', name: 'Ticket Support Desk', icon: Ticket, desc: 'Interactive support ticket panels, private channels, and complete transcripts.' },
    { key: 'voice_counters', name: 'Server Voice Counters', icon: BarChart3, desc: 'Live statistics voice channels displaying total members, bots, and voice counts.' },
    { key: 'birthdays', name: 'Birthday System', icon: Cake, desc: 'Birthday registration, automatic wishes in channels, and optional birthday roles.' },
    { key: 'sticky_messages', name: 'Sticky Messages', icon: Pin, desc: 'Keeps important rules or notices pinned near the bottom of designated channels.' },
    { key: 'image_threads', name: 'Automatic Image Threads', icon: MessageSquareShare, desc: 'Automatically creates discussion threads on qualifying image posts.' },
    { key: 'minigames', name: 'Interactive Minigames', icon: Gamepad2, desc: 'Counting channels, Word Chain, Rock Paper Scissors, and Trivia.' },
    { key: 'bump_reminder', name: 'Bump Reminder & Automation', icon: Flame, desc: 'Tracks server bump timers and pings your community when it is time to bump.' }
  ];

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Server Modules</h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Toggle features on or off. Disabled modules will not respond to commands or events.
          </p>
        </div>

        {toast && (
          <div className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moduleDefinitions.map((mod) => {
          const Icon = mod.icon;
          const isEnabled = settings.modules?.[mod.key] ?? false;

          return (
            <div
              key={mod.key}
              className={`p-5 rounded-2xl border transition-all duration-300 flex items-start justify-between gap-4 ${
                isEnabled
                  ? 'bg-aura-card border-aura-purple/40 shadow-purple-glow/50'
                  : 'bg-aura-card/60 border-aura-border opacity-70'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl border ${
                  isEnabled
                    ? 'bg-aura-purple/20 border-aura-purple/40 text-aura-purpleLight'
                    : 'bg-aura-darker border-aura-border text-aura-textMuted'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{mod.name}</h3>
                  <p className="text-xs text-aura-textMuted mt-1 leading-relaxed">{mod.desc}</p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                onClick={() => toggleModule(mod.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isEnabled ? 'bg-aura-purple' : 'bg-aura-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
