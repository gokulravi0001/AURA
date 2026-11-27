import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Ticket, Save, CheckCircle2, Shield, Eye, X } from 'lucide-react';

export default function Tickets() {
  const { guildId } = useParams();
  const [settings, setSettings] = useState(null);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeTranscript, setActiveTranscript] = useState(null);
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

    fetchTickets();
  }, [guildId]);

  const fetchTickets = () => {
    api.get(`/api/guilds/${guildId}/tickets`)
      .then(res => setTickets(res.data.tickets || []))
      .catch(console.error);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/settings`, {
        tickets: settings.tickets
      });
      setToast('Ticket settings updated successfully!');
    } catch (err) {
      setToast('Failed to save ticket settings.');
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

  const categories = channels.filter(c => c.isCategory);
  const filteredTickets = tickets.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Ticket className="w-7 h-7 text-aura-purpleLight" />
            Support Desk & Tickets
          </h1>
          <p className="text-sm text-aura-textMuted mt-1">
            Manage ticket categories, staff roles, and inspect complete message transcripts.
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

      {/* Ticket Settings */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
        <h3 className="font-bold text-lg text-white">Ticket System Options</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Ticket Category</label>
            <select
              value={settings.tickets?.categoryId || ''}
              onChange={(e) => setSettings({
                ...settings,
                tickets: { ...settings.tickets, categoryId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">None (Top level channels)</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>📁 {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Support Staff Role</label>
            <select
              value={settings.tickets?.staffRoleId || ''}
              onChange={(e) => setSettings({
                ...settings,
                tickets: { ...settings.tickets, staffRoleId: e.target.value || null }
              })}
              className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
            >
              <option value="">None (Admins only)</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>@{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-aura-textMuted mb-1.5">Welcome Message</label>
          <input
            type="text"
            value={settings.tickets?.welcomeMessage || ''}
            onChange={(e) => setSettings({
              ...settings,
              tickets: { ...settings.tickets, welcomeMessage: e.target.value }
            })}
            className="w-full px-3.5 py-2 rounded-xl bg-aura-darker border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple"
          />
        </div>
      </div>

      {/* Ticket Logs & Transcripts */}
      <div className="p-6 rounded-2xl bg-aura-card border border-aura-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg text-white">Tickets Log & Transcripts</h3>
            <p className="text-xs text-aura-textMuted">Inspect closed tickets and archived conversations</p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-aura-darker p-1 rounded-xl border border-aura-border">
            {['all', 'open', 'claimed', 'closed'].map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                  filter === status
                    ? 'bg-aura-purple text-white shadow-purple-glow'
                    : 'text-aura-textMuted hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-aura-textMuted">
            <thead className="bg-aura-darker/80 text-xs uppercase font-bold text-aura-purpleLight border-b border-aura-border">
              <tr>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Creator</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aura-border">
              {filteredTickets.length ? (
                filteredTickets.map((t) => (
                  <tr key={t._id} className="hover:bg-aura-cardHover transition">
                    <td className="py-3 px-4 font-black text-white font-mono">#{t.ticketNumber}</td>
                    <td className="py-3 px-4 text-white font-medium">{t.username}</td>
                    <td className="py-3 px-4 truncate max-w-[150px]">{t.subject}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        t.status === 'open' ? 'bg-green-500/20 text-green-300' :
                        t.status === 'claimed' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-zinc-500/20 text-zinc-300'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      {t.transcript?.length > 0 && (
                        <button
                          onClick={() => setActiveTranscript(t)}
                          className="px-2.5 py-1 rounded-lg bg-aura-purple/20 text-aura-purpleLight hover:bg-aura-purple/30 text-xs font-bold inline-flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Transcript
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-aura-textMuted">No tickets found for this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transcript Modal */}
      {activeTranscript && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-aura-card border border-aura-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-aura-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Transcript: Ticket #{activeTranscript.ticketNumber}</h3>
                <span className="text-xs text-aura-textMuted">Subject: {activeTranscript.subject}</span>
              </div>
              <button
                onClick={() => setActiveTranscript(null)}
                className="p-1.5 text-aura-textMuted hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 font-mono text-xs">
              {activeTranscript.transcript?.map((m, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-aura-darker/70 border border-aura-border">
                  <div className="flex items-center justify-between text-aura-textMuted text-[10px] mb-1">
                    <span className="font-bold text-white">{m.author} {m.isBot && '(BOT)'}</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white text-xs">{m.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
