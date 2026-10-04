import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Smartphone, 
  Laptop, 
  SlidersHorizontal 
} from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useDevice } from '../../hooks/useDevice';
import { useSync } from '../../hooks/useSync';

export function Navbar({ onOpenDemoModal }) {
  const { isOnline, isSimulatedOffline, toggleSimulatedOffline } = useNetworkStatus();
  const { deviceId, activeDevice, switchDevice, knownDevices } = useDevice();
  const { isSyncing, status, pendingCount, conflictCount, syncNow } = useSync();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold text-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-tight text-base sm:text-lg">SyncGuard</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Conflict-Aware
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">ALG-WEB-02 Offline-First Field Ops</p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !isOnline
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : isSyncing
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse'
              : status === 'CONFLICT'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden xs:inline">OFFLINE</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                <span className="hidden xs:inline">SYNCING</span>
              </>
            ) : status === 'CONFLICT' ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline">CONFLICT</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">ONLINE</span>
              </>
            )}
          </div>

          {/* Device Switcher Dropdown */}
          <div className="relative">
            <select
              value={deviceId}
              onChange={(e) => switchDevice(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 pr-7 appearance-none cursor-pointer hover:bg-slate-750 transition-colors"
            >
              {knownDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Laptop className="w-3 h-3" />
            </div>
          </div>

          {/* Simulate Offline Toggle */}
          <button
            onClick={toggleSimulatedOffline}
            title={isSimulatedOffline ? "Turn Online (Disable Offline Simulation)" : "Simulate Offline Disconnection"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isSimulatedOffline
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-900/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden md:inline">{isSimulatedOffline ? 'Resume Online' : 'Go Offline'}</span>
          </button>

          {/* Sync Now Button */}
          <button
            onClick={() => syncNow()}
            disabled={!isOnline || isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-sm ${
              !isOnline
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : isSyncing
                ? 'bg-sky-700 text-sky-200 cursor-wait'
                : 'bg-sky-600 hover:bg-sky-500 active:scale-95 shadow-sky-900/30'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Now</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Demo Runner Shortcut */}
          {onOpenDemoModal && (
            <button
              onClick={onOpenDemoModal}
              className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Demo Lab</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
