import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Platform } from 'react-native';

const LOCAL_IP = '192.168.0.122';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? Platform.select({
  android: __DEV__ ? 'http://10.0.2.2:5200' : `http://${LOCAL_IP}:5200`,
  ios: `http://${LOCAL_IP}:5200`,
  default: `http://${LOCAL_IP}:5200`,
});

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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

const RETRY_STATUS_CODES = [502, 503, 504];
const MAX_RETRIES = 2;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as typeof error.config & { _retryCount?: number };

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    const shouldRetry =
      config &&
      !config._retryCount &&
      (RETRY_STATUS_CODES.includes(error.response?.status) || error.code === 'ECONNABORTED');

    if (shouldRetry) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      if (config._retryCount <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 800 * config._retryCount!));
        return api(config);
      }
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
  updateProfile: async (data: { name?: string, avatar?: string }) => {
    const response = await api.put('/api/users/profile', data);
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/api/users/forgot-password', { email });
    return response.data;
  },
};

export type Priority = 'Low' | 'Medium' | 'High';
export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface SubtaskItem {
  text: string;
  done: boolean;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  dueDate?: string | null;
  dueTime?: string | null;
  isCompleted: boolean;
  priority: Priority;
  tags: string[];
  subtasks?: SubtaskItem[];
  recurrence?: RecurrenceType;
  sortOrder?: number;
}

export interface DailyFocusData {
  day: string;
  minutes: number;
  tasksCompleted: number;
}

export interface UserStatsResponse {
  totalFocusHours: number;
  completedTasksCount: number;
  activeStreak: number;
  weeklyFocus: DailyFocusData[];
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

export const FocusService = {
  saveSession: async (taskName: string, durationMinutes: number, completed: boolean) => {
    const response = await api.post('/api/focus/save', { taskName, durationMinutes, completed });
    return response.data;
  },
  getStats: async (): Promise<UserStatsResponse> => {
    const response = await api.get('/api/focus/stats');
    return response.data;
  },
};

export const AiService = {
  parseTasks: async (text: string) => {
    const response = await api.post('/api/ai/parse-tasks', { text });
    return response.data as Array<{
      title: string;
      description: string;
      priority: 'Low' | 'Medium' | 'High';
      dueDate?: string;
      tags: string[];
    }>;
  },
};

