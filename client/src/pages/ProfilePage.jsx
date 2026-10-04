import React, { useState, useEffect } from 'react';
import { 
  UserCircle, 
  Laptop, 
  Database, 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { useDevice } from '../hooks/useDevice';
import db from '../db/dexieDb';
import syncManager from '../services/syncManager';

export function ProfilePage() {
  const { activeDevice, currentUser, knownDevices, switchDevice } = useDevice();
  const [stats, setStats] = useState({
    tasksCount: 0,
    checklistsCount: 0,
    outboxCount: 0,
    conflictsCount: 0
  });
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadStats = async () => {
    try {
      const t = await db.tasks.count();
      const c = await db.checklists.count();
      const o = await db.outbox.count();
      const conf = await db.conflicts.count();
      setStats({
        tasksCount: t,
        checklistsCount: c,
        outboxCount: o,
        conflictsCount: conf
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    if (!window.confirm('Clear all local IndexedDB cached records and reload fresh copy from server?')) {
      return;
    }
    setClearing(true);
    try {
      await db.tasks.clear();
      await db.checklists.clear();
      await db.outbox.clear();
      await db.conflicts.clear();
      await syncManager.pullServerState();
      setFeedback('Local IndexedDB storage cleared and refreshed from server.');
      loadStats();
    } catch (err) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setClearing(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Operator & Offline Storage Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Device credentials, IndexedDB cache storage diagnostics, and terminal identity.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-sky-950/60 border border-sky-500/50 text-sky-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* User / Operator Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {currentUser.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {currentUser.fullName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{currentUser.role}</span>
              <span>•</span>
              <span className="font-mono text-sky-400">username: {currentUser.username}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Switch Simulated Terminal Identity
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {knownDevices.map((d) => (
              <button
                key={d.id}
                onClick={() => switchDevice(d.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activeDevice.id === d.id
                    ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm shadow-sky-950/40'
                    : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-sky-400" />
                  <span>{d.name.split('—')[0]}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {d.user.fullName}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* IndexedDB Cache Storage Diagnostics */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            Client-Side IndexedDB Storage (Dexie.js)
          </h2>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
            Healthy
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Cached Tasks</span>
            <div className="text-lg font-bold text-white mt-1">{stats.tasksCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Checklists</span>
            <div className="text-lg font-bold text-white mt-1">{stats.checklistsCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Outbox Queue</span>
            <div className="text-lg font-bold text-amber-400 mt-1">{stats.outboxCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
            <span className="text-slate-400">Cached Conflicts</span>
            <div className="text-lg font-bold text-rose-400 mt-1">{stats.conflictsCount}</div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearing ? 'Clearing Storage...' : 'Purge IndexedDB Cache & Re-pull'}</span>
          </button>
        </div>
      </div>

      {/* PWA & Service Worker Status */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          Progressive Web App (PWA) Capabilities
        </h2>
        <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Service Worker installed with Cache API asset caching</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>IndexedDB persistent offline store (Dexie.js)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Works seamlessly on mobile (320px+ viewport) and desktop</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
