import React, { useState } from 'react';
import { X, Plus, Trash2, Cpu, MapPin, CheckSquare, Layers } from 'lucide-react';
import taskRepository from '../../services/taskRepository';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function NewTaskModal({ isOpen, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [machineName, setMachineName] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [quantity, setQuantity] = useState(10);
  const [description, setDescription] = useState('');
  const [checklists, setChecklists] = useState(['Perform pre-service isolation', 'Inspect physical wear']);
  const [newChkText, setNewChkText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isOnline } = useNetworkStatus();

  if (!isOpen) return null;

  const handleAddChecklist = (e) => {
    e.preventDefault();
    if (!newChkText.trim()) return;
    setChecklists([...checklists, newChkText.trim()]);
    setNewChkText('');
  };

  const handleRemoveChecklist = (idx) => {
    setChecklists(checklists.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !machineName.trim() || !location.trim()) {
      alert('Please fill out the title, machine name, and location.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newTask = await taskRepository.createTask({
        title: title.trim(),
        machine_name: machineName.trim(),
        location: location.trim(),
        priority,
        status: 'PENDING',
        quantity: parseInt(quantity, 10) || 0,
        description: description.trim(),
        checklists
      });

      console.log('Task created offline-first:', newTask);
      if (onCreated) onCreated(newTask);
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
      alert(`Error creating task: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Create Field Work Order</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                {isOnline ? 'Direct Cloud Sync' : 'Offline Staged in Outbox'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Offline-first local creation with version-safe synchronization.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block text-xs">Work Order Title *</label>
            <input
              type="text"
              required
              placeholder="e.g., CNC Milling Unit #4 - Spindle Bearing Inspection"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Machine & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">Machine / Asset Name *</label>
              <div className="relative">
                <Cpu className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g., Haas VF-4 SS CNC Mill"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">Plant Location / Sector *</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g., Sector 4 - Heavy Fabrication"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Priority & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-xs">Quantity / Units</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block text-xs">Work Description / Objectives</label>
            <textarea
              rows={2}
              placeholder="Scope of work, diagnostic steps, clearance permits required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl p-3 text-xs sm:text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Initial Checklist Items */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-slate-300 font-semibold block text-xs flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Initial Safety & Inspection Checklist</span>
            </label>

            <div className="space-y-1.5">
              {checklists.map((chk, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-850 border border-slate-800 text-xs text-slate-200">
                  <span>{chk}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(i)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add checklist step..."
                value={newChkText}
                onChange={(e) => setNewChkText(e.target.value)}
                className="flex-1 bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700"
              >
                Add
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-950/40 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewTaskModal;
