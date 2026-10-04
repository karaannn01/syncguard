import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(() => {
    return localStorage.getItem('syncguard_simulated_offline') === 'true';
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = () => {
    const nextState = !isSimulatedOffline;
    setIsSimulatedOffline(nextState);
    localStorage.setItem('syncguard_simulated_offline', nextState ? 'true' : 'false');
    window.dispatchEvent(new Event('syncguard-network-change'));
  };

  const isEffectiveOnline = browserOnline && !isSimulatedOffline;

  return {
    isOnline: isEffectiveOnline,
    browserOnline,
    isSimulatedOffline,
    toggleSimulatedOffline
  };
}

export default useNetworkStatus;
