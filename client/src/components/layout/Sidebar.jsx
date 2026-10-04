import React from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  RefreshCw, 
  AlertTriangle, 
  History, 
  Users, 
  UserCircle,
  FlaskConical,
  WifiOff
} from 'lucide-react';
import { useSync } from '../../hooks/useSync';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function Sidebar({ activeTab, onSelectTab, onOpenDemo }) {
  const { pendingCount, conflictCount } = useSync();
  const { isOnline } = useNetworkStatus();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Field Tasks', icon: CheckSquare },
    { 
      id: 'sync', 
      label: 'Sync Center', 
      icon: RefreshCw,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-amber-500 text-slate-950'
    },
    { 
      id: 'conflicts', 
      label: 'Conflict Center', 
      icon: AlertTriangle,
      badge: conflictCount > 0 ? conflictCount : null,
      badgeColor: 'bg-rose-500 text-white animate-pulse'
    },
    { id: 'activity', label: 'Activity Audit', icon: History },
    { id: 'admin', label: 'Team & Devices', icon: Users },
    { id: 'profile', label: 'Device & Cache', icon: UserCircle },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-4 shrink-0 min-h-[calc(100vh-57px)]">
      {/* Offline Status Callout if offline */}
      {!isOnline && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-200 mb-1">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Operations</span>
          </div>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            All edits are cached locally in IndexedDB and queued in Outbox.
          </p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Demo Lab Banner */}
      <div className="mt-auto pt-4 border-t border-slate-800/80">
        <button
          onClick={onOpenDemo}
          className="w-full p-3 rounded-xl bg-gradient-to-r from-indigo-900/40 to-sky-900/40 border border-indigo-500/30 hover:border-indigo-400/60 text-left transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold tracking-wide uppercase text-indigo-300 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
              Demo Simulator
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
              ALG-WEB-02
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Run the official multi-device offline conflict test scenario.
          </p>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
