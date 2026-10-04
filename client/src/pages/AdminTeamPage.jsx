import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Laptop, 
  Database, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import syncManager from '../services/syncManager';

export function AdminTeamPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadOverview = async () => {
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all operational data back to the official demo baseline (Task 7701 at version 7)? This clears current conflicting test runs.')) {
      return;
    }

    setResetting(true);
    try {
      const res = await api.resetDemoData();
      await db.outbox.clear();
      await db.conflicts.clear();
      await db.tasks.clear();
      await syncManager.pullServerState();
      setFeedback({ type: 'success', text: res.message || 'Demo data successfully reset to baseline.' });
      loadOverview();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to reset demo data' });
    } finally {
      setResetting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Admin & Fleet Command
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Team & Device Fleet Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Registered field terminals, active technicians, and system telemetry.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 text-amber-400 ${resetting ? 'animate-spin' : ''}`} />
          <span>{resetting ? 'Resetting Baseline...' : 'Reset Demo Baseline'}</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Fleet Devices Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Laptop className="w-4 h-4 text-sky-400" />
          Registered Field Devices
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(overview?.devices || []).map((device) => (
            <div
              key={device.device_id}
              className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-400">
                  {device.device_id}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>
              <div className="font-bold text-white text-sm">
                {device.device_name}
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                Last Sync: {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technicians & Operators */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Field Technicians & Operators
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(overview?.users || []).map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm">
                  {user.full_name}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  user.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-750 text-slate-300'
                }`}>
                  {user.role}
                </span>
              </div>
              <div className="text-xs text-slate-400">{user.email}</div>
              <div className="text-[11px] font-mono text-slate-500">username: {user.username}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Telemetry Metrics */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Sync Engine Telemetry
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Total Devices</span>
            <div className="text-xl font-bold text-white mt-1">{overview?.devices?.length || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Total Operators</span>
            <div className="text-xl font-bold text-white mt-1">{overview?.users?.length || 0}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Unresolved Conflicts</span>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {overview?.conflictSummary?.find(c => c.status === 'UNRESOLVED')?.count || 0}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Operations Processed</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {overview?.operationStats?.reduce((acc, s) => acc + parseInt(s.count, 10), 0) || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminTeamPage;
