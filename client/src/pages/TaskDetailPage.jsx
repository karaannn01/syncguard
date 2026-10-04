import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Cpu, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Plus, 
  Check, 
  History, 
  Layers, 
  Trash2, 
  Edit3,
  CheckSquare
} from 'lucide-react';
import taskRepository from '../services/taskRepository';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSync } from '../hooks/useSync';

export function TaskDetailPage({ taskId, onBack, onNavigateToConflict }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');
  const [priority, setPriority] = useState('MEDIUM');
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [saveToast, setSaveToast] = useState(null);

  const { isOnline } = useNetworkStatus();
  const { isSyncing } = useSync();

  const loadTask = async () => {
    try {
      const data = await taskRepository.getTaskById(taskId);
      if (data) {
        setTask(data);
        setStatus(data.status);
        setPriority(data.priority);
        setQuantity(data.quantity || 0);
        setNotes(data.notes || '');
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
    const interval = setInterval(loadTask, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleFieldChange = async (fieldName, value) => {
    try {
      let payload = {};
      if (fieldName === 'status') {
        setStatus(value);
        payload.status = value;
      } else if (fieldName === 'priority') {
        setPriority(value);
        payload.priority = value;
      } else if (fieldName === 'quantity') {
        const numVal = Math.max(0, parseInt(value, 10) || 0);
        setQuantity(numVal);
        payload.quantity = numVal;
      } else if (fieldName === 'notes') {
        setNotes(value);
        payload.notes = value;
      }

      await taskRepository.updateTask(taskId, payload);
      setSaveToast(`Field '${fieldName}' updated (${isOnline ? 'Queued & Syncing' : 'Stored in Offline Outbox'})`);
      setTimeout(() => setSaveToast(null), 3000);
      loadTask();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleToggleChecklist = async (checklistId) => {
    try {
      await taskRepository.toggleChecklistItem(checklistId);
      loadTask();
    } catch (err) {
      console.error('Checklist toggle error:', err);
    }
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    try {
      await taskRepository.addChecklistItem(taskId, newChecklistText.trim());
      setNewChecklistText('');
      loadTask();
    } catch (err) {
      console.error('Add checklist error:', err);
    }
  };

  if (loading || !task) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-2" />
        Loading work order...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button & Action bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Work Orders</span>
        </button>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/70 border border-sky-800/80 px-2.5 py-1 rounded-lg">
            Version {task.version}
          </span>
          {task._syncStatus === 'PENDING' ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Offline Outbox
            </span>
          ) : task._syncStatus === 'CONFLICT' ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Version Conflict
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Synced to Server
            </span>
          )}
        </div>
      </div>

      {/* Save feedback toast */}
      {saveToast && (
        <div className="p-3 rounded-xl bg-sky-900/60 border border-sky-500/50 text-sky-200 text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
          <Check className="w-4 h-4 text-sky-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Conflict Alert Banner if active conflict exists */}
      {task.activeConflict && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <h3 className="text-sm font-bold text-rose-200">
                Active Version Conflict on this Task!
              </h3>
              <p className="text-xs text-rose-300/80">
                Another offline device modified this record concurrently. Base v{task.activeConflict.base_version} vs Server v{task.activeConflict.server_version}.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToConflict(task.activeConflict.id)}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 transition-colors shadow-md"
          >
            Open Side-by-Side Resolver
          </button>
        </div>
      )}

      {/* Main Task Header Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-mono">{task.id}</span>
            <span>•</span>
            <span>Updated {new Date(task.updated_at).toLocaleString()}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            {task.title}
          </h1>
          {task.description && (
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Machine & Location Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-850 border border-slate-800">
            <Cpu className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Equipment / Asset</div>
              <div className="text-xs sm:text-sm font-bold text-white">{task.machine_name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-850 border border-slate-800">
            <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Location / Sector</div>
              <div className="text-xs sm:text-sm font-bold text-white">{task.location}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Mutation Controls (Offline CRUD Enabled) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status Selector */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Work Order Status
          </label>
          <select
            value={status}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="PENDING">PENDING</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <span className="text-[10px] text-slate-400 block">
            Changes generate atomic mutation outbox item
          </span>
        </div>

        {/* Priority Selector */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Priority Tier
          </label>
          <select
            value={priority}
            onChange={(e) => handleFieldChange('priority', e.target.value)}
            className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <span className="text-[10px] text-slate-400 block">
            Auto-merges if other fields differ
          </span>
        </div>

        {/* Quantity Stepper (Directly tested in Demo Scenario!) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Quantity / Output Units
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFieldChange('quantity', Math.max(0, quantity - 5))}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono font-bold"
            >
              -5
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleFieldChange('quantity', e.target.value)}
              className="w-full bg-slate-800 text-white font-mono font-bold text-center border border-slate-700 rounded-lg py-1.5 text-sm focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => handleFieldChange('quantity', quantity + 5)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono font-bold"
            >
              +5
            </button>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Current: {quantity} units (Tested in Demo)
          </span>
        </div>
      </div>

      {/* Field Checklist Manager */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-sky-400" />
              Field Checklist Protocol
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Checklist toggles work 100% offline and sync atomically.
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">
            {task.checklists?.filter(c => c.is_completed).length || 0} / {task.checklists?.length || 0} Done
          </span>
        </div>

        {/* Checklist Items List */}
        <div className="space-y-2">
          {(!task.checklists || task.checklists.length === 0) ? (
            <p className="text-xs text-slate-500 py-3 text-center">No checklist items defined yet</p>
          ) : (
            task.checklists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleChecklist(item.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  item.is_completed
                    ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                    : 'bg-slate-850 border-slate-800 text-slate-200 hover:border-sky-500/40'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                  item.is_completed
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-slate-600 bg-slate-800'
                }`}>
                  {item.is_completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <span className={`text-xs sm:text-sm font-medium flex-1 ${item.is_completed ? 'line-through text-slate-500' : ''}`}>
                  {item.item_text}
                </span>
                {item._syncStatus === 'PENDING' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    pending sync
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Checklist Item Input */}
        <form onSubmit={handleAddChecklistItem} className="flex gap-2 pt-2 border-t border-slate-800">
          <input
            type="text"
            placeholder="Add new step or safety requirement..."
            value={newChecklistText}
            onChange={(e) => setNewChecklistText(e.target.value)}
            className="flex-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        </form>
      </div>

      {/* Field Notes Area */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <label className="text-sm font-bold text-white uppercase tracking-wider block">
          Technician Field Notes & Diagnostics
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => handleFieldChange('notes', notes)}
          placeholder="Record temperature readings, oil samples, bearing play, or inspection findings..."
          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Notes auto-save locally on blur.</span>
          <button
            onClick={() => handleFieldChange('notes', notes)}
            className="text-sky-400 hover:text-sky-300 font-semibold"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailPage;
