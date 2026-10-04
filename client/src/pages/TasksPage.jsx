import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Cpu, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  Hash,
  Boxes
} from 'lucide-react';
import taskRepository from '../services/taskRepository';

export function TasksPage({ onSelectTask, onOpenNewTask }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const loadTasks = async () => {
    try {
      const data = await taskRepository.getTasks({
        search,
        status: statusFilter,
        priority: priorityFilter
      });
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 2000);
    return () => clearInterval(interval);
  }, [search, statusFilter, priorityFilter]);

  return (
    <div className="space-y-5">
      {/* Header and New Task CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Field Service Tasks
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Local offline storage enabled • Version-concurrency protected
          </p>
        </div>
        <button
          onClick={onOpenNewTask}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-sky-950/30 active:scale-95 w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by work order title, machine name, or plant location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-medium mr-1 text-[11px] uppercase tracking-wider">
            <Filter className="w-3 h-3" />
            Status:
          </span>
          {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Status' : st.replace('_', ' ')}
            </button>
          ))}

          <span className="text-slate-400 flex items-center gap-1 font-medium ml-2 mr-1 text-[11px] uppercase tracking-wider">
            Priority:
          </span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((pr) => (
            <button
              key={pr}
              onClick={() => setPriorityFilter(pr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                priorityFilter === pr
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {pr === 'ALL' ? 'All Priorities' : pr}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            <Boxes className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No matching field tasks found</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing filters or create a new task offline.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const completedCount = task.checklists?.filter(c => c.is_completed).length || 0;
            const totalCount = task.checklists?.length || 0;

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-sky-950/20 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Version Tag */}
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800 px-2 py-0.5 rounded">
                        v{task.version}
                      </span>

                      {/* Sync Status Badge */}
                      {task._syncStatus === 'PENDING' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Offline Unsynced
                        </span>
                      ) : task._syncStatus === 'CONFLICT' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Version Conflict
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Synced
                        </span>
                      )}

                      {/* Priority */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        task.priority === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {task.priority}
                      </span>

                      {/* Status */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        task.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-sky-500/15 text-sky-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                      {task.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="font-semibold text-white">Qty: {task.quantity || 0} units</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(task.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                {/* Machine and Location info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 truncate">
                    <Cpu className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-medium text-slate-300">{task.machine_name}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-400 truncate">{task.location}</span>
                  </div>
                </div>

                {/* Checklist Progress */}
                {totalCount > 0 && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {completedCount}/{totalCount} Checklist Items
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TasksPage;
