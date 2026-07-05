import axios from 'axios';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { Platform } from 'react-native';

const BASE_URL = 'https://api.tazqapp.com';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'X-App-Signature': 'tazq-expo-frontend',
    'Content-Type': 'application/json',
  },
});

// Inject token into every request — skip if caller already set Authorization (e.g. login flow)
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const RETRY_STATUS_CODES = [502, 503, 504];
const MAX_RETRIES = 2;

function isLikelyConnectivityError(error: any): boolean {
  if (error.response) return false;

  const code = String(error.code ?? '').toUpperCase();
  const message = String(error.message ?? '').toLowerCase();

  // Timeouts often mean the API is slow, not that the device has no internet.
  if (code === 'ECONNABORTED' || message.includes('timeout')) return false;

  return (
    code === 'ERR_NETWORK' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    message.includes('network error') ||
    message.includes('network request failed') ||
    message.includes('internet connection appears to be offline')
  );
}

// Tek seferlik token yenileme — JWT 60 dk'da doluyor; eşzamanlı 401'lerde
// tek bir refresh isteği paylaşılır (deduplication).
let refreshPromise: Promise<string | null> | null = null;
async function tryRefreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) return null;
      // api instance'ı değil ham axios — interceptor döngüsüne girmesin
      const res = await axios.post(`${BASE_URL}/api/users/refresh`, { refreshToken }, {
        headers: { 'X-App-Signature': 'tazq-expo-frontend' },
        timeout: 15000,
      });
      const newToken = res.data?.token as string | undefined;
      const newRefresh = res.data?.refreshToken as string | undefined;
      if (newToken) {
        // Rotasyon: yeni access + yeni refresh token'ı sakla
        useAuthStore.setState({ token: newToken, ...(newRefresh ? { refreshToken: newRefresh } : {}) });
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    useNetworkStore.getState().setOnline(true);
    return response;
  },
  async (error) => {
    const config = error.config as typeof error.config & { _retryCount?: number; _retriedAuth?: boolean };

    // Only mark offline for likely device connectivity failures. Server/API
    // timeouts should not show a misleading "no internet" banner.
    if (isLikelyConnectivityError(error)) {
      useNetworkStore.getState().setOnline(false);
    } else if (error.response) {
      useNetworkStore.getState().setOnline(true);
    }

    if (error.response?.status === 401) {
      const { isLoggedIn, _hasHydrated } = useAuthStore.getState();
      const url: string = config?.url ?? '';
      const isRefreshCall = url.includes('/refresh-session');

      // Süresi dolmuş JWT → önce sessizce yenilemeyi dene, sonra isteği tekrarla.
      // Sadece gerçek oturum varsa, refresh çağrısının kendisi değilse ve daha önce
      // denenmediyse. Böylece her açılışta gereksiz logout olmaz.
      if (isLoggedIn && _hasHydrated && config && !config._retriedAuth && !isRefreshCall) {
        config._retriedAuth = true;
        const newToken = await tryRefreshToken();
        if (newToken) {
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${newToken}`;
          return api(config);
        }
      }

      // Yenileme başarısız (token gerçekten geçersiz) → ancak o zaman çıkış yap.
      if (isLoggedIn && _hasHydrated) {
        useAuthStore.getState().logout();
      }
      return Promise.reject(error);
    }

    const retryCount = config?._retryCount ?? 0;
    const shouldRetry =
      config &&
      retryCount < MAX_RETRIES &&
      (RETRY_STATUS_CODES.includes(error.response?.status) || error.code === 'ECONNABORTED');

    if (shouldRetry) {
      config._retryCount = retryCount + 1;
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
  googleLogin: async (idToken: string) => {
    const response = await api.post('/api/users/google-login', { idToken });
    return response.data;
  },
  appleLogin: async (identityToken: string, firstName?: string, lastName?: string) => {
    const response = await api.post('/api/users/apple-login', { identityToken, firstName, lastName });
    return response.data;
  },
  register: async (userData: any) => {
    const response = await api.post('/api/users/register', userData);
    return response.data;
  },
  verifyEmail: async (email: string, code: string) => {
    const response = await api.post('/api/users/verify-email', { email, code });
    return response.data;
  },
  resendVerification: async (email: string) => {
    const response = await api.post('/api/users/resend-verification', { email });
    return response.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/api/users/change-password', { currentPassword, newPassword });
    return response.data;
  },
  getCurrentUser: async (manualToken?: string) => {
    const config = manualToken ? { headers: { Authorization: `Bearer ${manualToken}` } } : {};
    const response = await api.get('/api/users/me', config);
    const data = response.data;
    // Map backend profilePicture field to frontend avatar field
    return { ...data, avatar: data.profilePicture ?? data.avatar };
  },
  updateProfile: async (data: { name?: string, avatar?: string, motto?: string, avatarBorderColor?: string, preferences?: string }) => {
    const response = await api.put('/api/users/profile', data);
    return response.data;
  },
  forgotPassword: async (email: string) => {
    const response = await api.post('/api/users/forgot-password', { email });
    return response.data;
  },
  // Refresh token'ı sunucuda iptal et (logout) — best-effort
  logout: async (refreshToken: string) => {
    try { await axios.post(`${BASE_URL}/api/users/logout`, { refreshToken }, { headers: { 'X-App-Signature': 'tazq-expo-frontend' }, timeout: 8000 }); } catch {}
  },
  // Hesabı sil — best-effort
  deleteAccount: async () => {
    try { await api.delete('/api/users/me'); } catch {}
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
  /**
   * İstemci-tarafı idempotency anahtarı (deterministik). Plan/günlük görevler için
   * set edilir; backend aynı kullanıcıda tamamlanmamış aynı clientKey'li görev varsa
   * yenisini oluşturmaz. Ağ kopması/timeout sonrası tekrar denemelerde çift kaydı önler.
   */
  clientKey?: string;
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
  lastWeekFocusMinutes?: number;
}

export const TaskService = {
  getTasks: async () => {
    const response = await api.get('/api/tasks', { params: { pageSize: 200 } });
    return response.data.items ?? response.data;
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
  reorderTasks: async (orderedIds: number[]) => {
    const response = await api.post('/api/tasks/reorder', orderedIds);
    return response.data;
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

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isBanned?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  deletedAt?: string | null;
  profilePicture?: string;
  taskCount: number;
  completedTasks: number;
  focusMinutes: number;
  lastActivityAt?: string;
  lastLoginIp?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalTasks: number;
  completedTasks: number;
  totalFocusMinutes: number;
  activeToday: number;
  activeThisWeek: number;
  sessionsToday: number;
  dailyTrend: { day: string; minutes: number }[];
}

export interface AdminUsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail {
  email: string;
  phoneNumber?: string | null;
  motto?: string | null;
  isEmailVerified: boolean;
  lastLoginIp?: string | null;
  recentTasks: { id: number; title: string; isCompleted: boolean; dueDate?: string | null; priority: string }[];
  recentSessions: { id: number; taskName: string; durationMinutes: number; startedAt: string; completed: boolean }[];
  devices: { createdAt: string; expiresAt: string; revokedAt?: string | null }[];
}

export interface AdminAuditItem {
  id: number;
  adminName?: string | null;
  action: string;
  targetType?: string | null;
  targetUserId?: number | null;
  targetName?: string | null;
  details?: string | null;
  createdAt: string;
}

export const AdminService = {
  getUsers: async (opts?: { page?: number; pageSize?: number; search?: string; sort?: string; asc?: boolean }): Promise<AdminUsersPage> => {
    const r = await api.get('/api/admin/users', { params: opts });
    return r.data;
  },
  getStats: async (): Promise<AdminStats> => {
    const r = await api.get('/api/admin/stats');
    return r.data;
  },
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/api/admin/users/${id}`);
  },
  setRole: async (id: number, role: string): Promise<void> => {
    await api.patch(`/api/admin/users/${id}/role`, { role });
  },
  setBan: async (id: number, banned: boolean, durationDays?: number | null, reason?: string | null): Promise<void> => {
    await api.patch(`/api/admin/users/${id}/ban`, { banned, durationDays: durationDays ?? null, reason: reason ?? null });
  },
  getBanHistory: async (id: number): Promise<BanHistoryItem[]> => {
    const r = await api.get(`/api/admin/users/${id}/ban-history`);
    return r.data;
  },
  getUserDetail: async (id: number): Promise<AdminUserDetail> => {
    const r = await api.get(`/api/admin/users/${id}/detail`);
    return r.data;
  },
  exportUser: async (id: number): Promise<any> => {
    const r = await api.get(`/api/admin/users/${id}/export`);
    return r.data;
  },
  getAuditLog: async (take = 100): Promise<AdminAuditItem[]> => {
    const r = await api.get('/api/admin/audit', { params: { take } });
    return r.data;
  },
};

export interface BanHistoryItem {
  id: number;
  action: 'ban' | 'unban';
  reason?: string | null;
  durationDays?: number | null;
  bannedUntil?: string | null;
  adminName?: string | null;
  createdAt: string;
}

export interface SupportMessageItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  adminReply?: string | null;
  repliedAt?: string | null;
}

// Kullanıcının kendi destek mesajı + admin yanıtı (salt-okunur görünüm).
export interface MySupportMessage {
  id: number;
  message: string;
  createdAt: string;
  adminReply?: string | null;
  repliedAt?: string | null;
}

export const SupportService = {
  sendMessage: async (message: string): Promise<{ success: boolean; id: number }> => {
    const r = await api.post('/api/support', { message });
    return r.data;
  },
  // Kullanıcı: kendi mesajları + admin yanıtları (salt-okunur).
  getMyMessages: async (): Promise<{ messages: MySupportMessage[] }> => {
    const r = await api.get('/api/support/mine');
    return r.data;
  },
  // Admin: kullanıcının mesajına yanıt yaz.
  replyMessage: async (id: number, reply: string): Promise<void> => {
    await api.patch(`/api/support/admin/${id}/reply`, { reply });
  },
  getAllMessages: async (): Promise<{ messages: SupportMessageItem[]; unreadCount: number }> => {
    const r = await api.get('/api/support/admin/all');
    return r.data;
  },
  markAsRead: async (id: number): Promise<void> => {
    await api.patch(`/api/support/admin/${id}/read`);
  },
  deleteMessage: async (id: number): Promise<void> => {
    await api.delete(`/api/support/admin/${id}`);
  },
  reportCrash: async (payload: {
    errorMessage: string;
    stackTrace: string;
    deviceName: string;
    platform: string;
    appVersion: string;
  }): Promise<{ success: boolean; id: number }> => {
    const r = await api.post('/api/support/report-crash', payload);
    return r.data;
  },
  getCrashes: async (limit = 50): Promise<{ crashes: any[] }> => {
    const r = await api.get('/api/support/admin/crashes', { params: { limit } });
    return r.data;
  },
  resolveCrash: async (id: number): Promise<void> => {
    await api.patch(`/api/support/admin/crashes/${id}/resolve`);
  },
};

// ── Admin Sistem Konsolu ─────────────────────────────────────────────────────
export interface SystemHealth {
  status: string; dbOk: boolean; redisOk: boolean | null;
  environment: string; serverTimeUtc: string; uptimeSeconds: number;
  latestMigration: string | null; pendingMigrations: number;
  warnings: number; errors: number;
}
export interface SystemLogEntry { timestamp: string; level: string; category: string; message: string; }
export interface SystemStats { users: number; tasks: number; focusSessions: number; supportMessages: number; supportUnread: number; contentDocuments: number; }
export interface SentryIssue { title: string; count: string | null; level: string | null; lastSeen: string | null; permalink: string | null; }
export interface SentrySummary { configured: boolean; ok?: boolean; count?: number; issues?: SentryIssue[]; dashboard?: string; message?: string; error?: string; status?: number; }

export const AdminSystemService = {
  health: async (): Promise<SystemHealth> => (await api.get('/api/admin/system/health')).data,
  stats: async (): Promise<SystemStats> => (await api.get('/api/admin/system/stats')).data,
  logs: async (lines = 200, level?: string): Promise<{ logs: SystemLogEntry[] }> =>
    (await api.get('/api/admin/system/logs', { params: { lines, ...(level ? { level } : {}) } })).data,
  sentry: async (): Promise<SentrySummary> => (await api.get('/api/admin/system/sentry')).data,
  migrate: async (): Promise<{ success: boolean; applied: string[]; message?: string }> =>
    (await api.post('/api/admin/system/migrate')).data,
  clearCache: async (): Promise<{ success: boolean; message?: string }> =>
    (await api.post('/api/admin/system/clear-cache')).data,
  restart: async (): Promise<{ success: boolean; message?: string }> =>
    (await api.post('/api/admin/system/restart')).data,
};


export interface ContentDoc {
  key: string;
  version: number;
  json: string;
  updatedAt: string;
}

export const ContentService = {
  // İstemci senkronu: güncel içerik belgesi (ör. "curriculum").
  get: async (key: string): Promise<ContentDoc> => {
    const r = await api.get(`/api/content/${key}`);
    return r.data;
  },
  // Admin: içerik oluştur/güncelle.
  update: async (key: string, json: string, version?: number): Promise<ContentDoc> => {
    const r = await api.put(`/api/content/${key}`, { json, version });
    return r.data;
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

