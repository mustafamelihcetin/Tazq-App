import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const BASE_URL = 'http://192.168.0.122:5200';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-App-Signature': 'tazq-expo-frontend',
    'Content-Type': 'application/json',
  },
});

// Inject token into every request
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const AuthService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/users/login', { email, password });
    return response.data;
  },
  register: async (userData: any) => {
    const response = await api.post('/api/users/register', userData);
    return response.data;
  },
  getCurrentUser: async (manualToken?: string) => {
    const config = manualToken ? { headers: { Authorization: `Bearer ${manualToken}` } } : {};
    const response = await api.get('/api/users/me', config);
    return response.data;
  },
};

export interface CreateTaskPayload {
  title: string;
  description: string;
  dueDate?: string;
  dueTime?: string;
  isCompleted: boolean;
  priority: 'Low' | 'Medium' | 'High';
  tags: string[];
}

export const TaskService = {
  getTasks: async () => {
    const response = await api.get('/api/tasks');
    return response.data;
  },
  getTask: async (id: number) => {
    const response = await api.get(`/api/tasks/${id}`);
    return response.data;
  },
  createTask: async (payload: CreateTaskPayload) => {
    const response = await api.post('/api/tasks', payload);
    return response.data;
  },
  updateTask: async (id: number, payload: Partial<CreateTaskPayload> & { isCompleted?: boolean }) => {
    const response = await api.put(`/api/tasks/${id}`, payload);
    return response.data;
  },
  deleteTask: async (id: number) => {
    await api.delete(`/api/tasks/${id}`);
  },
};
