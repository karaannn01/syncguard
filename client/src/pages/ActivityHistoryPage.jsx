import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Laptop, 
  User, 
  Tag, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  GitMerge, 
  RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import db from '../db/dexieDb';

export function ActivityHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    try {
      // First try fetching server activity logs
      let serverLogs = [];
      try {
        const res = await api.getActivityLogs('limit=60');
        serverLogs = res.activity || [];
      } catch {
        // Fallback to local IndexedDB logs
      }

      const localLogs = await db.activity_logs.orderBy('timestamp').reverse().limit(30).toArray();

      // Combine and deduplicate
      const combined = [...serverLogs];
      localLogs.forEach(loc => {
        if (!combined.some(s => s.id === loc.id)) {
          combined.push({
            id: loc.id,
            timestamp: loc.timestamp,
            action: loc.action,
            entity_type: loc.entity_type,
            entity_id: loc.entity_id,
            user_name: loc.user_name || 'Field Tech',
            device_id: loc.device_id || 'local-device',
            details: loc.details || {}
          });
        }
      });

      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(combined);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.entity_id?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.device_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Activity & Mutation Audit History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Immutable log recording who changed what, when, and from which device.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, task ID, technician, or device identifier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Audit Log Timeline Feed */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Event Log ({filteredLogs.length} entries)
          </h2>
          <span className="text-[11px] font-mono text-slate-500">
            Real-Time Audit Pipeline
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">No activity records found</p>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const isConflict = log.action.includes('CONFLICT');
              const isMerge = log.action.includes('MERGE');
              const isCreate = log.action.includes('CREATE');

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-slate-850 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isConflict
                        ? 'bg-rose-500/15 text-rose-400'
                        : isMerge
                        ? 'bg-purple-500/15 text-purple-400'
                        : isCreate
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-sky-500/15 text-sky-400'
                    }`}>
                      {isConflict ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isMerge ? (
                        <GitMerge className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isConflict
                            ? 'bg-rose-500/20 text-rose-300'
                            : isMerge
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-slate-800 text-slate-200'
                        }`}>
                          {log.action}
                        </span>

                        <span className="font-mono text-sky-300 font-semibold">
                          {log.entity_type} #{log.entity_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <strong className="text-slate-300 font-normal">{log.user_name}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Laptop className="w-3 h-3 text-slate-500" />
                          {log.device_id}
                        </span>
                      </div>

                      {log.details && (
                        <div className="text-[11px] font-mono text-slate-500 mt-1 bg-slate-900/60 p-1.5 rounded max-w-xl truncate">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0 text-slate-500 font-mono text-[11px]">
                    <Clock className="w-3 h-3 inline mr-1 text-slate-600" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityHistoryPage;
