import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import {
  Tag,
  ShieldCheck,
  ShieldAlert,
  Users,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Clock,
  Lock
} from 'lucide-react';

function formatSyncTime(value) {
  if (!value) return 'Never synchronized';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function ServerTagRole() {
  const { guildId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [roles, setRoles] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [moduleEnabled, setModuleEnabled] = useState(true);
  const [tagInfo, setTagInfo] = useState(null);
  const [botCapabilities, setBotCapabilities] = useState({ manageRoles: true, highestRolePosition: 0, highestRoleName: null });
  const [roleValidation, setRoleValidation] = useState(null);

  const [enabled, setEnabled] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [includeBots, setIncludeBots] = useState(false);
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState('never');
  const [lastSyncMessage, setLastSyncMessage] = useState('');

  const [notice, setNotice] = useState(null);

  const applyPayload = useCallback((payload) => {
    const cfg = payload?.config || {};
    setModuleEnabled(payload?.moduleEnabled !== false);
    setCanManage(Boolean(payload?.canManage ?? true));
    setTagInfo(payload?.tagInfo || null);
    setBotCapabilities(payload?.botCapabilities || { manageRoles: false, highestRolePosition: -1, highestRoleName: null });
    setRoleValidation(payload?.roleValidation || null);

    setEnabled(Boolean(cfg.enabled));
    setRoleId(cfg.roleId || '');
    setIncludeBots(Boolean(cfg.includeBots));
    setActiveMemberCount(cfg.activeMemberCount || 0);
    setLastSyncAt(cfg.lastSyncAt || null);
    setLastSyncStatus(cfg.lastSyncStatus || 'never');
    setLastSyncMessage(cfg.lastSyncMessage || '');
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, rolesRes] = await Promise.all([
        api.get(`/api/guilds/${guildId}/server-tag-role`),
        api.get(`/api/guilds/${guildId}/roles`)
      ]);
      applyPayload(configRes.data);
      setRoles(rolesRes.data?.roles || []);
      if (rolesRes.data?.botCapabilities) {
        setBotCapabilities(rolesRes.data.botCapabilities);
      }
    } catch (err) {
      setNotice({
        type: 'error',
        text: err.response?.data?.error || 'Failed to load Server Tag Auto Role configuration.'
      });
    } finally {
      setLoading(false);
    }
  }, [guildId, applyPayload]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    if (enabled && !roleId) {
      setNotice({
        type: 'error',
        text: 'Select a target role before enabling Server Tag Auto Role.'
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const res = await api.put(`/api/guilds/${guildId}/server-tag-role`, {
        enabled,
        roleId: roleId || null,
        includeBots
      });
      applyPayload({ ...res.data, canManage: true });
      setNotice({
        type: 'success',
        text: enabled
          ? 'Server Tag Auto Role saved and synchronized across server members.'
          : 'Server Tag Auto Role configuration saved.'
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: err.response?.data?.error || 'Failed to save configuration.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!canManage) return;
    setSyncing(true);
    setNotice(null);
    try {
      const res = await api.post(`/api/guilds/${guildId}/server-tag-role/sync`);
      applyPayload({ ...res.data, canManage: true });
      setNotice({
        type: 'success',
        text: res.data?.syncResult?.message || 'Synchronization completed successfully.'
      });
    } catch (err) {
      if (err.response?.data?.config) {
        applyPayload({ ...err.response.data, canManage: true });
      }
      setNotice({
        type: 'error',
        text: err.response?.data?.error || 'Failed to synchronize members.'
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-aura-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === roleId);
  const selectedRoleInvalid = Boolean(selectedRole && !selectedRole.assignable);
  const permissionIssue =
    !botCapabilities.manageRoles
      ? 'AURA lacks the "Manage Roles" permission in this server. Grant Manage Roles to the bot role to assign or remove tag roles.'
      : roleValidation && !roleValidation.valid
      ? roleValidation.error
      : null;

  const statusBadge = !moduleEnabled
    ? { label: 'Module Disabled', cls: 'bg-red-500/10 text-red-400 border-red-500/30' }
    : enabled && roleId && !permissionIssue
    ? { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
    : enabled && permissionIssue
    ? { label: 'Attention Required', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
    : { label: 'Disabled', cls: 'bg-gray-500/10 text-gray-300 border-gray-500/30' };

  const syncStatusBadge =
    lastSyncStatus === 'success'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : lastSyncStatus === 'partial'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : lastSyncStatus === 'error'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : 'bg-gray-500/10 text-gray-400 border-gray-500/30';

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-aura-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <Tag className="w-7 h-7 sm:w-8 sm:h-8 text-aura-purple shrink-0" />
            <span>Server Tag Auto Role</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Automatically grant and revoke a role when members adopt or remove this server&apos;s official Discord Server Tag.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={!canManage || syncing || !enabled || !roleId}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-aura-card border border-aura-border hover:border-aura-purple/60 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 text-aura-purple ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Synchronizing...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Notices */}
      {!canManage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3">
          <Lock className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Read-Only View</p>
            <p className="text-amber-300/80 text-xs mt-0.5">
              Only authorized server administrators can change Server Tag Auto Role settings or trigger manual synchronization.
            </p>
          </div>
        </div>
      )}

      {permissionIssue && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-aura-red shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Permission or Role Hierarchy Issue</p>
            <p className="text-red-300/80 text-xs mt-0.5">{permissionIssue}</p>
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{notice.text}</span>
        </div>
      )}

      {/* Status & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Configuration Status */}
        <div className="bg-aura-card border border-aura-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Configuration Status
            </span>
            <ShieldCheck className="w-4 h-4 text-aura-purple" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">
            {selectedRole ? (
              <span className="inline-flex items-center gap-1.5 text-gray-200 font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: selectedRole.color && selectedRole.color !== '#000000' ? selectedRole.color : '#9333ea' }}
                />
                @{selectedRole.name}
              </span>
            ) : roleId ? (
              <span className="text-red-400">Configured role deleted ({roleId})</span>
            ) : (
              'No role configured'
            )}
          </p>
        </div>

        {/* Server Tag Information */}
        <div className="bg-aura-card border border-aura-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Server Tag Info
            </span>
            <Tag className="w-4 h-4 text-aura-red" />
          </div>
          <div className="flex items-center gap-2.5">
            {tagInfo?.badgeUrl && (
              <img
                src={tagInfo.badgeUrl}
                alt="Server Tag Badge"
                className="w-6 h-6 rounded object-contain shrink-0"
              />
            )}
            <span className="text-lg font-bold text-white truncate">
              {tagInfo?.tag ? tagInfo.tag : tagInfo?.supportsGuildTags ? 'Tag Active (Unadopted)' : 'Not Detected'}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">
            Tag Guild ID: <span className="font-mono text-gray-300">{tagInfo?.serverTagId || guildId}</span>
          </p>
        </div>

        {/* Members Receiving Role */}
        <div className="bg-aura-card border border-aura-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Members With Role
            </span>
            <Users className="w-4 h-4 text-aura-purple" />
          </div>
          <div className="text-2xl font-black text-white">{activeMemberCount}</div>
          <p className="text-xs text-gray-400">
            {tagInfo?.adoptersInCache ?? 0} verified tag wearer(s) in cache
          </p>
        </div>

        {/* Last Synchronization Status */}
        <div className="bg-aura-card border border-aura-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Last Sync Status
            </span>
            <Clock className="w-4 h-4 text-aura-purple" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase border ${syncStatusBadge}`}>
              {lastSyncStatus}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate" title={lastSyncMessage || formatSyncTime(lastSyncAt)}>
            {formatSyncTime(lastSyncAt)}
          </p>
        </div>
      </div>

      {/* Main Configuration Card */}
      <form
        onSubmit={handleSave}
        className="bg-aura-card border border-aura-border rounded-2xl p-5 sm:p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-aura-border">
          <div>
            <h2 className="text-lg font-bold text-white">Role Assignment Configuration</h2>
            <p className="text-xs text-gray-400 mt-1">
              Uses Discord&apos;s official <code className="text-aura-purple">primary_guild</code> identity verification. Members wearing another server&apos;s tag or removing yours will automatically lose only this role.
            </p>
          </div>

          {/* Enable/Disable Toggle Switch */}
          <label className="inline-flex items-center gap-3 cursor-pointer select-none shrink-0">
            <span className="text-sm font-semibold text-gray-300">
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={!canManage}
              onClick={() => canManage && setEnabled(!enabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer disabled:opacity-50 ${
                enabled ? 'bg-aura-purple justify-end' : 'bg-gray-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 bg-white rounded-full shadow" />
            </button>
          </label>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="tag-role-select" className="block text-sm font-semibold text-gray-200">
              Tag Reward Role
            </label>
            <select
              id="tag-role-select"
              value={roleId}
              disabled={!canManage}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/50 border border-aura-border text-white text-sm focus:outline-none focus:border-aura-purple transition-colors disabled:opacity-50"
            >
              <option value="">-- Select a server role --</option>
              {roles.map((r) => {
                const suffix = r.managed
                  ? ' (Managed integration — unassignable)'
                  : !botCapabilities.manageRoles
                  ? ' (Missing Manage Roles)'
                  : !r.assignable
                  ? ' (Above bot role)'
                  : '';
                return (
                  <option key={r.id} value={r.id} disabled={!r.assignable}>
                    @{r.name}{suffix}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-gray-400">
              Managed roles and roles positioned above AURA&apos;s highest role ({botCapabilities.highestRoleName || 'Bot Role'}) are disabled to prevent hierarchy errors.
            </p>
            {selectedRoleInvalid && (
              <p className="text-xs text-red-400">
                The currently selected role is not assignable by the bot. Choose a role below AURA&apos;s highest role.
              </p>
            )}
          </div>

          {/* Bot Exclusion Toggle & Verification Note */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/40 border border-aura-border flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <Bot className="w-4 h-4 text-aura-purple" />
                  <span>Include Bot Accounts</span>
                </div>
                <p className="text-xs text-gray-400">
                  By default, bot accounts are skipped even if they display a primary guild tag. Enable only if bots should receive this role.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={includeBots}
                disabled={!canManage}
                onClick={() => canManage && setIncludeBots(!includeBots)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                  includeBots ? 'bg-aura-purple justify-end' : 'bg-gray-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full shadow" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-aura-purple/5 border border-aura-purple/20 text-xs text-gray-300 space-y-1">
              <p className="font-semibold text-aura-purple">Safe Verification Guarantee</p>
              <p className="text-gray-400">
                If Discord temporarily omits or fails to return a member&apos;s <code className="text-gray-200">primary_guild</code> data, AURA verifies via REST API first and never removes an existing tag role without confirmed verification.
              </p>
            </div>
          </div>
        </div>

        {/* Last Sync Summary Line & Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-aura-border">
          <div className="text-xs text-gray-400">
            {lastSyncMessage ? (
              <span>
                Last sync details: <span className="text-gray-200">{lastSyncMessage}</span>
              </span>
            ) : (
              <span>Background synchronization runs automatically on reconnect and every 15 minutes.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canManage || saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-90 text-white font-bold text-sm transition-all shadow-lg shadow-aura-purple/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer w-full sm:w-auto"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
