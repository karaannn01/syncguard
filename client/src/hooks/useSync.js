import { useState, useEffect } from 'react';
import syncManager from '../services/syncManager';
import db from '../db/dexieDb';

export function useSync() {
  const [syncState, setSyncState] = useState(syncManager.getState());
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);

  const refreshCounts = async () => {
    try {
      const pCount = await db.outbox.where('status').notEqual('SUCCESS').count();
      const cCount = await db.conflicts.where('status').equals('UNRESOLVED').count();
      setPendingCount(pCount);
      setConflictCount(cCount);
    } catch {
      // Ignore during initial load
    }
  };

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
      refreshCounts();
    });

    refreshCounts();

    const interval = setInterval(refreshCounts, 2000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    ...syncState,
    pendingCount,
    conflictCount,
    syncNow: () => syncManager.syncNow(),
    refreshCounts
  };
}

export default useSync;
