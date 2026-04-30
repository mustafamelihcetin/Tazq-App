import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

// Android emulators use 10.0.2.2 to access localhost of the host machine
const BASE_URL = 'http://192.168.0.122:5200';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-App-Signature': 'tazq-expo-frontend',
    'Content-Type': 'application/json',
  },
});

// Automatically inject token from store into every request
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/users/login', { email, password });
    return response.data; // Expected: { token: string }
  },
  register: async (userData: any) => {
    const response = await api.post('/api/users/register', userData);
    return response.data;
  },
  getCurrentUser: async (manualToken?: string) => {
    const config = manualToken ? { headers: { Authorization: `Bearer ${manualToken}` } } : {};
    const response = await api.get('/api/users/me', config);
    return response.data;
  }
};

export const TaskService = {
  getTasks: async () => {
    const response = await api.get('/api/Task');
    return response.data;
  },
  toggleTask: async (id: number) => {
    const response = await api.put(`/api/Task/${id}/toggle`);
    return response.data;
  },
};
