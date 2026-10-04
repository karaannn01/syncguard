import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  ArrowUpRight, 
  Plus, 
  WifiOff, 
  Cpu, 
  MapPin, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import taskRepository from '../services/taskRepository';
import db from '../db/dexieDb';
import { useSync } from '../hooks/useSync';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useDevice } from '../hooks/useDevice';

export function DashboardPage({ onNavigate, onOpenNewTask, onOpenDemo }) {
  const [tasks, setTasks] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pendingCount, conflictCount, isSyncing, lastSyncTime, syncNow } = useSync();
  const { isOnline } = useNetworkStatus();
  const { activeDevice } = useDevice();

  const loadData = async () => {
    try {
      const allTasks = await taskRepository.getTasks();
      setTasks(allTasks);

      const logs = await db.activity_logs.orderBy('timestamp').reverse().limit(6).toArray();
      setRecentLogs(logs);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, []);

  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pendingTasksCount = tasks.filter(t => t.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Device context */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Active Terminal
            </span>
            <span className="text-xs text-slate-400">{activeDevice.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Field Operations Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Operator: <span className="text-slate-200 font-medium">{activeDevice.user.fullName}</span> • Concurrency Control Engine Active
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={onOpenNewTask}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-sky-900/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
          <button
            onClick={onOpenDemo}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs sm:text-sm font-semibold transition-all"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Demo Scenario</span>
          </button>
        </div>
      </div>

      {/* Critical Conflict Callout if any */}
      {conflictCount > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-300">
                {conflictCount} Version Conflict{conflictCount > 1 ? 's' : ''} Detected
              </h2>
              <p className="text-xs text-rose-400/80">
                Concurrent offline modifications require manual side-by-side resolution.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('conflicts')}
            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            Resolve Now
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <div 
          onClick={() => onNavigate('tasks')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Assigned Tasks</span>
            <CheckSquare className="w-4 h-4 group-hover:text-sky-400 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white">{tasks.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{completedCount} completed</span>
            <span>•</span>
            <span className="text-sky-400 font-medium">{inProgressCount} active</span>
          </div>
        </div>

        {/* Pending Sync */}
        <div 
          onClick={() => onNavigate('sync')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Outbox Queue</span>
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : 'group-hover:text-amber-400'} transition-colors`} />
          </div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            {pendingCount}
            {pendingCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Pending Sync
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {!isOnline ? 'Queued safely in IndexedDB' : 'Ready to synchronize'}
          </div>
        </div>

        {/* Active Conflicts */}
        <div 
          onClick={() => onNavigate('conflicts')}
          className={`p-4 rounded-xl border cursor-pointer transition-all group ${
            conflictCount > 0
              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Unresolved Conflicts</span>
            <AlertTriangle className={`w-4 h-4 ${conflictCount > 0 ? 'text-rose-400 animate-pulse' : ''}`} />
          </div>
          <div className={`text-2xl font-bold ${conflictCount > 0 ? 'text-rose-300' : 'text-white'}`}>
            {conflictCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {conflictCount > 0 ? 'Action required in Conflict Center' : 'Zero version discrepancies'}
          </div>
        </div>

        {/* Connection & Sync Status */}
        <div 
          onClick={() => onNavigate('sync')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Network Engine</span>
            <Clock className="w-4 h-4 group-hover:text-sky-400 transition-colors" />
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-ping'}`} />
            <span>{isOnline ? 'Connected' : 'Offline Mode'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Last sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Tasks + Live Outbox & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Field Tasks (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Priority Work Orders
            </h2>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>View All ({tasks.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {tasks.slice(0, 4).map((task) => {
              const completedChk = task.checklists?.filter(c => c.is_completed).length || 0;
              const totalChk = task.checklists?.length || 0;

              return (
                <div
                  key={task.id}
                  onClick={() => onNavigate(`task-detail-${task.id}`)}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-sky-500/40 cursor-pointer transition-all hover:shadow-md hover:shadow-sky-950/20 group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          v{task.version}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          task.priority === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            : task.priority === 'HIGH'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {task.priority}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          task.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task._syncStatus === 'PENDING' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Offline Edit
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                        {task.title}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 my-2 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 truncate">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{task.machine_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{task.location}</span>
                    </div>
                  </div>

                  {totalChk > 0 && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.round((completedChk / totalChk) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {completedChk}/{totalChk} items
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Outbox & Local Activity Feed (1 col) */}
        <div className="space-y-4">
          {/* Outbox Status Preview */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                Local Outbox
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                {pendingCount} Queued
              </span>
            </div>

            {pendingCount === 0 ? (
              <div className="py-5 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-500/40 mx-auto mb-1.5" />
                All local operations synchronized with server
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  {pendingCount} mutations staged in IndexedDB awaiting upload.
                </p>
                <button
                  onClick={() => syncNow()}
                  disabled={!isOnline || isSyncing}
                  className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSyncing ? 'Synchronizing...' : 'Upload Outbox Now'}
                </button>
              </div>
            )}
          </div>

          {/* Recent Operations Activity Log */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Telemetry & Audit Stream
            </h2>
            <div className="space-y-2.5">
              {recentLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No recent local events</p>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="text-xs pb-2 border-b border-slate-800/60 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-300 truncate max-w-[140px]">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {log.entity_type} {log.entity_id} • {log.user_name || 'Technician'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
