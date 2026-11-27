import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Pin, Save, CheckCircle2 } from 'lucide-react';

export default function StickyMessages() {
  const { guildId } = useParams();
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [content, setContent] = useState('');
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDesc, setEmbedDesc] = useState('');
  const [embedColor, setEmbedColor] = useState('#9333ea');
  const [cooldown, setCooldown] = useState(4);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get(`/api/guilds/${guildId}/channels`)
      .then(res => {
        const textChans = (res.data.channels || []).filter(c => c.isText);
        setChannels(textChans);
        if (textChans.length > 0) setSelectedChannel(textChans[0].id);
      })
      .catch(console.error);
  }, [guildId]);

  const handleSave = async () => {
    if (!selectedChannel) return;
    setSaving(true);
    try {
      await api.post(`/api/guilds/${guildId}/sticky`, {
        channelId: selectedChannel,
        content,
        embedData: embedTitle || embedDesc ? {
          title: embedTitle,
          description: embedDesc,
          color: embedColor
        } : null,
        cooldownSeconds: cooldown
      });
      setToast('Sticky message created and posted!');
    } catch (err) {
      setToast('Failed to save sticky message.');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Pin className="w-7 h-7 text-aura-purpleLight" />
            Sticky Messages
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Pin custom alerts, rules, or announcements dynamically to the bottom of active chat channels.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 text-white transition flex items-center gap-2 shadow-purple-glow"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Posting...' : 'Save & Post Sticky'}
        </button>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
          <h3 className="font-bold text-lg text-white">Sticky Configuration</h3>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Target Channel</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            >
              {channels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Plain Message Text (Optional)</label>
            <input
              type="text"
              placeholder="e.g. ⚠️ Please read the guidelines below before chatting!"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Embed Title</label>
            <input
              type="text"
              placeholder="e.g. Channel Rules & Info"
              value={embedTitle}
              onChange={(e) => setEmbedTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Embed Description</label>
            <textarea
              rows={3}
              placeholder="e.g. Keep all conversations friendly, no spamming, and respect everyone."
              value={embedDesc}
              onChange={(e) => setEmbedDesc(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Embed Color</label>
              <input
                type="color"
                value={embedColor}
                onChange={(e) => setEmbedColor(e.target.value)}
                className="w-full h-10 p-1 rounded-xl bg-aura-darker border border-aura-border cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Cooldown (Seconds)</label>
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-6 rounded-2xl bg-aura-card border border-aura-border flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white">Live Discord Preview</h3>
            <p className="text-xs text-aura-textMuted">This is exactly how members will see the sticky message in Discord.</p>

            <div className="p-4 rounded-xl bg-[#313338] space-y-3 font-sans">
              {content && <p className="text-sm text-[#dbdee1]">{content}</p>}

              {(embedTitle || embedDesc) && (
                <div
                  className="p-3 rounded-lg bg-[#2b2d31] border-l-4 space-y-1.5"
                  style={{ borderLeftColor: embedColor }}
                >
                  {embedTitle && <h4 className="font-bold text-sm text-white">{embedTitle}</h4>}
                  {embedDesc && <p className="text-xs text-[#dbdee1] leading-relaxed">{embedDesc}</p>}
                </div>
              )}

              {!content && !embedTitle && !embedDesc && (
                <div className="py-8 text-center text-xs text-[#949ba4]">
                  Type content or embed details on the left to see the live preview.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
