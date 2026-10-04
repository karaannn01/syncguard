import React from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  RefreshCw, 
  AlertTriangle, 
  UserCircle 
} from 'lucide-react';
import { useSync } from '../../hooks/useSync';

export function BottomNav({ activeTab, onSelectTab }) {
  const { pendingCount, conflictCount, isSyncing } = useSync();

  const mobileTabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { 
      id: 'sync', 
      label: 'Sync', 
      icon: RefreshCw,
      badge: pendingCount > 0 ? pendingCount : null,
      spin: isSyncing
    },
    { 
      id: 'conflicts', 
      label: 'Conflicts', 
      icon: AlertTriangle,
      badge: conflictCount > 0 ? conflictCount : null,
      badgeColor: 'bg-rose-500'
    },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-1.5 px-2">
      <div className="flex items-center justify-around">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 px-2 rounded-xl relative transition-all ${
                isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${tab.spin ? 'animate-spin' : ''}`} />
                {tab.badge && (
                  <span className={`absolute -top-1.5 -right-2 px-1.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${tab.badgeColor || 'bg-amber-500'}`}>
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
