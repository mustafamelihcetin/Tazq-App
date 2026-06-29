/**
 * Hesaplar arası yerel veri izolasyonu.
 * Çıkışta ve farklı hesapla girişte önceki kullanıcının cihazdaki verisi sızmamalı.
 */
import { useAuthStore } from '../store/useAuthStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';

const userA = { id: 1, email: 'a@x.com', name: 'A' } as any;
const userB = { id: 2, email: 'b@x.com', name: 'B' } as any;

function seedUserData() {
  usePrefsStore.getState().setSeasonalPref('examMode', true);
  usePrefsStore.getState().setSeasonalPref('examName', 'KPSS');
  usePrefsStore.getState().setPlanIds('exam', ['h1'], [101]);
  useTaskStore.setState({ tasks: [{ id: 101, title: 't', priority: 'Medium', isCompleted: false } as any] });
  useHabitStore.setState({ habits: [{ id: 'h1', name: 'x', completedDates: [] } as any] });
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null, isLoggedIn: false, lastUserId: null });
  usePrefsStore.getState().resetUserData();
  useTaskStore.setState({ tasks: [] });
  useHabitStore.setState({ habits: [] });
});

describe('account isolation', () => {
  it('logout wipes all user-scoped local data', () => {
    seedUserData();
    expect(usePrefsStore.getState().seasonal.examMode).toBe(true);

    useAuthStore.getState().logout();

    expect(usePrefsStore.getState().seasonal.examMode).toBe(false);
    expect(usePrefsStore.getState().seasonal.examName).toBe('');
    expect(usePrefsStore.getState().examPlanTaskIds).toEqual([]);
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useHabitStore.getState().habits).toEqual([]);
  });

  it('logging in as a DIFFERENT account clears leftover data even without logout', () => {
    useAuthStore.getState().setAuth(userA, 'tokenA', null);
    seedUserData();
    expect(usePrefsStore.getState().seasonal.examMode).toBe(true);

    // Farklı hesap giriş yapıyor (logout çalışmamış olsa bile).
    useAuthStore.getState().setAuth(userB, 'tokenB', null);

    expect(usePrefsStore.getState().seasonal.examMode).toBe(false);
    expect(usePrefsStore.getState().examPlanTaskIds).toEqual([]);
    expect(useAuthStore.getState().lastUserId).toBe(2);
  });

  it('same account logging back in does NOT wipe data', () => {
    useAuthStore.getState().setAuth(userA, 'tokenA', null);
    seedUserData();

    // Aynı kullanıcı tekrar giriş → veri korunur.
    useAuthStore.getState().setAuth(userA, 'tokenA2', null);

    expect(usePrefsStore.getState().seasonal.examMode).toBe(true);
  });
});
