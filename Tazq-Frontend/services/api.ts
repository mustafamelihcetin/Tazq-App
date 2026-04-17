import axios from 'axios';
// Using the same URL logic from the MAUI project
const BASE_URL = 'http://localhost:5200'; 

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-App-Signature': 'tazq-expo-frontend',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  // We'll add JWT token logic here once Auth is ready
  return config;
});

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
