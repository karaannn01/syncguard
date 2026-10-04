import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  GitMerge, 
  Server, 
  Laptop, 
  Check, 
  ArrowRight, 
  ShieldAlert, 
  Split, 
  Clock, 
  Layers,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import syncManager from '../services/syncManager';
import db from '../db/dexieDb';

export function ConflictCenterPage({ initialConflictId, onResolved }) {
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mergeSelections, setMergeSelections] = useState({});
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionSuccess, setResolutionSuccess] = useState(null);

  const loadConflicts = async () => {
    try {
      const res = await api.getConflicts('status=UNRESOLVED');
      const list = res.conflicts || [];
      setConflicts(list);

      if (list.length > 0) {
        if (initialConflictId) {
          const match = list.find(c => c.id === initialConflictId);
          if (match) setSelectedConflict(match);
          else setSelectedConflict(list[0]);
        } else if (!selectedConflict) {
          setSelectedConflict(list[0]);
        }
      } else {
        setSelectedConflict(null);
      }
    } catch (err) {
      console.error('Failed to load conflicts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
    const interval = setInterval(loadConflicts, 2500);
    return () => clearInterval(interval);
  }, [initialConflictId]);

  // When selected conflict changes, initialize default merge selections
  useEffect(() => {
    if (selectedConflict) {
      const defaults = {};
      const fields = selectedConflict.conflicting_fields || [];
      fields.forEach(f => {
        // Default to server value or local
        defaults[f] = 'LOCAL';
      });
      setMergeSelections(defaults);
      setResolutionSuccess(null);
    }
  }, [selectedConflict?.id]);

  const handleResolve = async (strategy) => {
    if (!selectedConflict) return;
    setIsResolving(true);

    try {
      let resolvedValues = {};
      if (strategy === 'KEEP_SERVER') {
        resolvedValues = selectedConflict.server_values;
      } else if (strategy === 'KEEP_LOCAL') {
        resolvedValues = selectedConflict.local_values;
      } else if (strategy === 'MERGE') {
        // Construct composite object from field-level radio choices
        const fields = selectedConflict.conflicting_fields || [];
        fields.forEach(f => {
          if (mergeSelections[f] === 'SERVER') {
            resolvedValues[f] = selectedConflict.server_values[f];
          } else {
            resolvedValues[f] = selectedConflict.local_values[f];
          }
        });
      }

      const res = await api.resolveConflict(selectedConflict.id, {
        resolutionType: strategy,
        resolvedValues
      });

      console.log('Conflict resolved successfully:', res);
      setResolutionSuccess(`Conflict ${selectedConflict.id} resolved via [${strategy}]. New server version is v${res.updatedEntity?.version || 'N/A'}.`);

      // Refresh Dexie local cache and sync manager
      await syncManager.pullServerState();

      // Remove or update locally
      await db.conflicts.delete(selectedConflict.id);
      await db.outbox.where('entityId').equals(selectedConflict.entity_id).delete();

      setTimeout(() => {
        loadConflicts();
        if (onResolved) onResolved();
      }, 1500);
    } catch (err) {
      console.error('Resolution failed:', err);
      alert(`Resolution error: ${err.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Concurrency Arbitrator
          </span>
          <span className="text-xs text-slate-400">Zero Silent Data Loss Policy</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Conflict Resolution Center
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Inspect concurrent offline mutations, analyze version lineage, and execute side-by-side merges.
        </p>
      </div>

      {resolutionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{resolutionSuccess}</span>
        </div>
      )}

      {conflicts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <h2 className="text-base font-bold text-slate-200">
            All Records in Perfect Harmony
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are currently no active version conflicts. Safe non-overlapping edits were automatically merged by the server engine.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Conflict List Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Unresolved Items ({conflicts.length})
            </h2>

            <div className="space-y-2">
              {conflicts.map((c) => {
                const isSelected = selectedConflict?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConflict(c)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-850 border-rose-500 shadow-md shadow-rose-950/20'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-rose-400 font-semibold truncate">
                        {c.id.slice(0, 12)}...
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="font-semibold text-white text-xs sm:text-sm truncate">
                      {c.taskTitle || c.entity_id}
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px]">
                        Base v{c.base_version}
                      </span>
                      <span>→</span>
                      <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 font-mono text-[10px]">
                        Server v{c.server_version}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conflict Diff & Resolution View (8 cols) */}
          {selectedConflict && (
            <div className="lg:col-span-8 space-y-5">
              {/* Conflict Overview Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-rose-400 bg-rose-950/60 border border-rose-900 px-2 py-0.5 rounded">
                      Conflict ID: {selectedConflict.id}
                    </span>
                    <h2 className="text-lg font-bold text-white mt-1.5">
                      {selectedConflict.taskTitle || `Entity ${selectedConflict.entity_id}`}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedConflict.machineName && `${selectedConflict.machineName} • `}
                      Entity Type: {selectedConflict.entity_type}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-800 text-xs font-mono text-slate-300 shrink-0">
                    <div>Base Version: <strong className="text-amber-400">v{selectedConflict.base_version}</strong></div>
                    <div>Server Version: <strong className="text-sky-400">v{selectedConflict.server_version}</strong></div>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="p-3.5 rounded-xl bg-slate-850/80 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                    <span>Why did this conflict occur?</span>
                  </div>
                  <p className="text-slate-400">
                    Two devices modified this entity concurrently while disconnected. Device A synchronized first, moving the server to <strong>v{selectedConflict.server_version}</strong>. Device B then reconnected with <strong>baseVersion {selectedConflict.base_version}</strong>. The server detected conflicting modifications on: <span className="font-mono text-rose-400 font-semibold">{(selectedConflict.conflicting_fields || []).join(', ')}</span>.
                  </p>
                </div>
              </div>

              {/* Side-by-Side Diff Table / Cards */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Split className="w-4 h-4 text-sky-400" />
                    Field-by-Field Value Comparison
                  </h3>
                  <span className="text-xs text-slate-400">
                    Pick strategy per field or choose bulk resolution
                  </span>
                </div>

                <div className="space-y-3">
                  {(selectedConflict.conflicting_fields || []).map((field) => {
                    const serverVal = selectedConflict.server_values?.[field];
                    const localVal = selectedConflict.local_values?.[field];
                    const chosen = mergeSelections[field] || 'LOCAL';

                    return (
                      <div
                        key={field}
                        className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs uppercase tracking-wider text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/60">
                            Field: {field}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Chosen for merge: <strong className="text-sky-400">{chosen}</strong>
                          </span>
                        </div>

                        {/* Two Columns: Server Value vs Local Offline Value */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Server Value Choice */}
                          <label
                            onClick={() => setMergeSelections(prev => ({ ...prev, [field]: 'SERVER' }))}
                            className={`p-3 rounded-xl border cursor-pointer transition-all block ${
                              chosen === 'SERVER'
                                ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/40 ring-1 ring-sky-500'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                                <Server className="w-3.5 h-3.5" />
                                Current Server (v{selectedConflict.server_version})
                              </span>
                              <input
                                type="radio"
                                name={`choice-${field}`}
                                checked={chosen === 'SERVER'}
                                onChange={() => {}}
                                className="accent-sky-500"
                              />
                            </div>
                            <div className="font-mono text-sm font-bold text-white bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                              {String(serverVal ?? 'None')}
                            </div>
                          </label>

                          {/* Local Offline Value Choice */}
                          <label
                            onClick={() => setMergeSelections(prev => ({ ...prev, [field]: 'LOCAL' }))}
                            className={`p-3 rounded-xl border cursor-pointer transition-all block ${
                              chosen === 'LOCAL'
                                ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                                <Laptop className="w-3.5 h-3.5" />
                                Incoming Local (Device B)
                              </span>
                              <input
                                type="radio"
                                name={`choice-${field}`}
                                checked={chosen === 'LOCAL'}
                                onChange={() => {}}
                                className="accent-amber-500"
                              />
                            </div>
                            <div className="font-mono text-sm font-bold text-white bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                              {String(localVal ?? 'None')}
                            </div>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resolution Action Controls */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Apply Resolution Strategy
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Keep Server */}
                  <button
                    onClick={() => handleResolve('KEEP_SERVER')}
                    disabled={isResolving}
                    className="p-3.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-left transition-all group disabled:opacity-50"
                  >
                    <div className="font-bold text-sky-400 text-xs sm:text-sm flex items-center gap-1.5 mb-1">
                      <Server className="w-4 h-4" />
                      <span>Keep Server</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Discard local offline edits. Retain server version v{selectedConflict.server_version}.
                    </p>
                  </button>

                  {/* Keep Local */}
                  <button
                    onClick={() => handleResolve('KEEP_LOCAL')}
                    disabled={isResolving}
                    className="p-3.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-left transition-all group disabled:opacity-50"
                  >
                    <div className="font-bold text-amber-400 text-xs sm:text-sm flex items-center gap-1.5 mb-1">
                      <Laptop className="w-4 h-4" />
                      <span>Keep Local</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Override server with local offline changes. Advances server to v{selectedConflict.server_version + 1}.
                    </p>
                  </button>

                  {/* Custom Merge */}
                  <button
                    onClick={() => handleResolve('MERGE')}
                    disabled={isResolving}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-left transition-all shadow-md shadow-sky-950/40 disabled:opacity-50"
                  >
                    <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5 mb-1">
                      <GitMerge className="w-4 h-4" />
                      <span>Commit Merge</span>
                    </div>
                    <p className="text-[11px] text-sky-100/80 leading-snug">
                      Combine selected field values. Promotes record to v{selectedConflict.server_version + 1}.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConflictCenterPage;
