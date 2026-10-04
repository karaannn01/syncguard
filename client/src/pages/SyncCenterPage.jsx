import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Database, 
  Layers, 
  Code2, 
  Trash2, 
  SendHorizontal,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import db from '../db/dexieDb';
import syncManager from '../services/syncManager';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSync } from '../hooks/useSync';
import { useDevice } from '../hooks/useDevice';

export function SyncCenterPage({ onNavigateToConflict }) {
  const [outboxItems, setOutboxItems] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [expandedOpId, setExpandedOpId] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetworkStatus();
  const { isSyncing, status, lastSyncTime, pendingCount, conflictCount, syncNow } = useSync();
  const { activeDevice } = useDevice();

  const loadOutboxAndHistory = async () => {
    try {
      const ops = await db.outbox.orderBy('createdAt').reverse().toArray();
      setOutboxItems(ops);

      const logs = await db.activity_logs
        .where('action')
        .anyOf('OPERATION_AUTO_MERGED', 'OPERATION_UPDATE', 'OPERATION_CREATE', 'CONFLICT_DETECTED', 'TASK_UPDATED_LOCAL')
        .reverse()
        .limit(10)
        .toArray();
      setSyncHistory(logs);
    } catch (err) {
      console.error('Failed to load sync center data:', err);
    }
  };

  useEffect(() => {
    loadOutboxAndHistory();
    const interval = setInterval(loadOutboxAndHistory, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const result = await syncManager.syncNow();
    if (result.success) {
      if (result.conflictFound) {
        setSyncFeedback({ type: 'warning', text: 'Sync completed. Concurrent version conflicts detected and flagged for resolution.' });
      } else {
        setSyncFeedback({ type: 'success', text: 'All offline operations synchronized and reconciled successfully!' });
      }
    } else {
      setSyncFeedback({ type: 'error', text: result.error?.message || 'Sync failed: Device is currently offline' });
    }
    loadOutboxAndHistory();
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Synchronization Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Bidirectional Outbox Queue • Idempotent Dispatcher • Concurrency Manager
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Simulate Network Drop / Offline Toggle */}
          <button
            onClick={toggleSimulatedOffline}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              isSimulatedOffline
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {isSimulatedOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
            <span>{isSimulatedOffline ? 'Simulate Reconnect' : 'Simulate Offline Drop'}</span>
          </button>

          {/* Sync Now CTA */}
          <button
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-sky-950/40 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Toast Banner */}
      {syncFeedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-medium animate-fadeIn ${
          syncFeedback.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : syncFeedback.type === 'warning'
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
        }`}>
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>{syncFeedback.text}</span>
        </div>
      )}

      {/* Network Engine Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hardware Status */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Network Channel</span>
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isOnline ? 'Online (REST/JSON)' : 'Disconnected (Offline)'}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {isSimulatedOffline ? 'Simulated field outage active' : 'Live browser connectivity'}
          </p>
        </div>

        {/* Pending Operations Outbox Count */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Outbox</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>{pendingCount}</span>
            <span className="text-xs font-normal text-slate-400">mutations queued</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Guaranteed delivery via IndexedDB
          </p>
        </div>

        {/* Active Conflicts Count */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Version Conflicts</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${conflictCount > 0 ? 'text-rose-400 animate-bounce' : 'text-slate-500'}`} />
          </div>
          <div className={`text-lg font-bold ${conflictCount > 0 ? 'text-rose-300' : 'text-white'}`}>
            {conflictCount}
          </div>
          <p className="text-[11px] text-slate-500">
            {conflictCount > 0 ? 'Requires technician review' : 'No conflicting concurrent writes'}
          </p>
        </div>

        {/* Last Sync Timestamp */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Last Sync</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">
            {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
          </div>
          <p className="text-[11px] text-slate-500">
            Auto-syncs on network re-establishment
          </p>
        </div>
      </div>

      {/* Outbox Operations Table / Card List */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              IndexedDB Operation Outbox
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every offline mutation is serialized with unique operationId, deviceId, baseVersion, and changedFields.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
            {outboxItems.length} Total Records
          </span>
        </div>

        {outboxItems.length === 0 ? (
          <div className="p-10 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
            Outbox is empty. All local operations are in sync with the central server.
          </div>
        ) : (
          <div className="space-y-2.5">
            {outboxItems.map((op) => {
              const isExpanded = expandedOpId === op.operationId;

              return (
                <div
                  key={op.operationId}
                  className="rounded-xl bg-slate-850 border border-slate-800 overflow-hidden text-xs transition-all"
                >
                  <div
                    onClick={() => setExpandedOpId(isExpanded ? null : op.operationId)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        op.status === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : op.status === 'CONFLICT'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono'
                          : op.status === 'SYNCING'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {op.status}
                      </span>

                      <span className="font-mono text-slate-300 font-semibold">
                        {op.operationType.toUpperCase()}
                      </span>

                      <span className="text-slate-400">
                        {op.entityType} <strong className="text-white">{op.entityId}</strong>
                      </span>

                      <span className="font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded text-[10px]">
                        base v{op.baseVersion}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <span className="text-[11px] font-mono">
                        {new Date(op.createdAt).toLocaleTimeString()}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800/80 space-y-3 font-mono text-[11px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                        <div><span className="text-slate-500">operationId:</span> {op.operationId}</div>
                        <div><span className="text-slate-500">deviceId:</span> {op.deviceId}</div>
                        <div><span className="text-slate-500">retryCount:</span> {op.retryCount || 0}</div>
                        <div><span className="text-slate-500">changedFields:</span> {JSON.stringify(op.changedFields)}</div>
                      </div>

                      {op.error && (
                        <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300">
                          <strong>Error/Reason:</strong> {op.error}
                        </div>
                      )}

                      <div>
                        <div className="text-slate-400 mb-1 flex items-center gap-1">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Payload Body:</span>
                        </div>
                        <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-sky-300 overflow-x-auto">
                          {JSON.stringify(op.payload, null, 2)}
                        </pre>
                      </div>

                      {op.status === 'CONFLICT' && (
                        <button
                          onClick={() => onNavigateToConflict(op.conflictId)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-sans text-xs font-semibold"
                        >
                          Resolve in Conflict Center
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SyncCenterPage;
