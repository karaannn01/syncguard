const API_BASE = '/api';

export function getStoredDevice() {
  return localStorage.getItem('syncguard_device_id') || 'dev-alpha-01';
}

export function setStoredDevice(deviceId) {
  localStorage.setItem('syncguard_device_id', deviceId);
}

export function getStoredToken() {
  return localStorage.getItem('syncguard_token') || '';
}

export function setStoredToken(token) {
  if (token) localStorage.setItem('syncguard_token', token);
  else localStorage.removeItem('syncguard_token');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('syncguard_user');
    return raw ? JSON.parse(raw) : {
      id: 'usr-tech-01',
      username: 'tech1',
      role: 'TECHNICIAN',
      fullName: 'Marcus Vance (Senior Field Tech)'
    };
  } catch {
    return { id: 'usr-tech-01', username: 'tech1', role: 'TECHNICIAN', fullName: 'Marcus Vance (Senior Field Tech)' };
  }
}

export function setStoredUser(user) {
  localStorage.setItem('syncguard_user', JSON.stringify(user));
}

export async function request(endpoint, options = {}) {
  // Check if simulated offline mode is activated by the user
  const isSimulatedOffline = localStorage.getItem('syncguard_simulated_offline') === 'true';
  if (isSimulatedOffline) {
    const error = new Error('Client simulated offline mode is enabled');
    error.isOffline = true;
    throw error;
  }

  const token = getStoredToken();
  const deviceId = getStoredDevice();
  const user = getStoredUser();

  const headers = {
    'Content-Type': 'application/json',
    'x-device-id': deviceId,
    'x-user-id': user.id,
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    if (!res.ok) {
      let errData = {};
      try {
        errData = await res.json();
      } catch {
        // Fallback
      }
      const error = new Error(errData.error || `HTTP error ${res.status}`);
      error.status = res.status;
      error.data = errData;
      throw error;
    }
    return await res.json();
  } catch (err) {
    if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.isOffline) {
      err.isNetworkError = true;
    }
    throw err;
  }
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),

  // Tasks
  getTasks: (params = '') => request(`/tasks${params ? `?${params}` : ''}`),
  getTaskById: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTask: (id, data) => request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteTask: (id) => request(`/tasks/${id}`, {
    method: 'DELETE'
  }),
  getTaskHistory: (id) => request(`/tasks/${id}/history`),

  // Sync
  syncBatch: (operations, deviceId) => request('/sync', {
    method: 'POST',
    body: JSON.stringify({ operations, deviceId: deviceId || getStoredDevice() })
  }),
  getSyncStatus: () => request('/sync/status'),

  // Conflicts
  getConflicts: (params = '') => request(`/conflicts${params ? `?${params}` : ''}`),
  getConflictById: (id) => request(`/conflicts/${id}`),
  resolveConflict: (id, data) => request(`/conflicts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Admin & Activity
  getAdminOverview: () => request('/admin/overview'),
  getActivityLogs: (params = '') => request(`/admin/activity${params ? `?${params}` : ''}`),
  resetDemoData: () => request('/admin/reset-demo', { method: 'POST' })
};
