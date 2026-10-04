import { useState, useEffect } from 'react';
import { getStoredDevice, setStoredDevice, getStoredUser, setStoredUser } from '../services/api';

export const KNOWN_DEVICES = [
  {
    id: 'dev-alpha-01',
    name: 'Device A — Toughbook',
    user: {
      id: 'usr-tech-01',
      username: 'tech1',
      role: 'TECHNICIAN',
      fullName: 'Marcus Vance (Tech 1)'
    }
  },
  {
    id: 'dev-beta-02',
    name: 'Device B — Field Tablet',
    user: {
      id: 'usr-tech-02',
      username: 'tech2',
      role: 'TECHNICIAN',
      fullName: 'Elena Rostova (Tech 2)'
    }
  },
  {
    id: 'dev-hq-desk',
    name: 'HQ Console — Admin',
    user: {
      id: 'usr-admin-01',
      username: 'admin',
      role: 'ADMIN',
      fullName: 'Sarah Connor (Admin)'
    }
  }
];

export function useDevice() {
  const [deviceId, setDeviceId] = useState(getStoredDevice);
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const switchDevice = (newDeviceId) => {
    const target = KNOWN_DEVICES.find(d => d.id === newDeviceId) || KNOWN_DEVICES[0];
    setDeviceId(target.id);
    setCurrentUser(target.user);
    setStoredDevice(target.id);
    setStoredUser(target.user);
    window.dispatchEvent(new Event('syncguard-device-change'));
  };

  useEffect(() => {
    const handleDeviceChange = () => {
      setDeviceId(getStoredDevice());
      setCurrentUser(getStoredUser());
    };
    window.addEventListener('syncguard-device-change', handleDeviceChange);
    return () => window.removeEventListener('syncguard-device-change', handleDeviceChange);
  }, []);

  const activeDevice = KNOWN_DEVICES.find(d => d.id === deviceId) || {
    id: deviceId,
    name: `Custom Device (${deviceId})`,
    user: currentUser
  };

  return {
    deviceId,
    activeDevice,
    currentUser,
    switchDevice,
    knownDevices: KNOWN_DEVICES
  };
}

export default useDevice;
