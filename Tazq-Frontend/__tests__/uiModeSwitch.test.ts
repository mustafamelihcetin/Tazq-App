import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { CustomAlert } from '@/shared/components/CustomAlert';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { confirmUiMode, switchUiMode } from '@/features/modes/utils/uiModeSwitch';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/shared/components/CustomAlert', () => ({ CustomAlert: { alert: jest.fn() } }));

const alert = CustomAlert.alert as jest.Mock;
const reload = reloadAppAsync as jest.Mock;

beforeEach(() => {
  alert.mockClear();
  reload.mockClear();
  usePrefsStore.setState({ uiMode: 'pro', liteGoalsPaused: false });
  useFocusStore.setState({ isActive: false });
});

describe('mod geçişi', () => {
  it('onaylanmadan hiçbir şey değişmez', () => {
    confirmUiMode('lite', 'tr');
    expect(usePrefsStore.getState().uiMode).toBe('pro');
    expect(reload).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][1]).toContain('Uygulama yeniden başlar');
  });

  it('hedefi olmayana hedeften söz edilmez', () => {
    confirmUiMode('lite', 'tr');
    expect(alert.mock.calls[0][1]).not.toContain('Hedef');
    expect(alert.mock.calls[0][2]).toHaveLength(2);
  });

  it('hedefi olana geçişte sorulur: görevleri gelsin ya da dursun', async () => {
    const seasonal = usePrefsStore.getState().seasonal;
    usePrefsStore.setState({ seasonal: { ...seasonal, tezMode: true, tezName: 'Tez' } });
    confirmUiMode('lite', 'tr');
    const buttons = alert.mock.calls[0][2];
    expect(buttons.map((b: { text: string }) => b.text)).toEqual(['Görevleri gelsin', 'Şimdilik dursun', 'Vazgeç']);
    await switchUiMode('lite', { pauseGoals: true });
    expect(usePrefsStore.getState().liteGoalsPaused).toBe(true);
    await switchUiMode('pro');
    expect(usePrefsStore.getState().liteGoalsPaused).toBe(false);
    usePrefsStore.setState({ seasonal });
  });

  it('odak seansı sürerken geçilmez', () => {
    useFocusStore.setState({ isActive: true });
    confirmUiMode('lite', 'tr');
    expect(alert.mock.calls[0][0]).toBe('Odak seansın sürüyor');
    expect(alert.mock.calls[0][2]).toHaveLength(1);
  });

  it('seçim diske indikten sonra yeniden başlar', async () => {
    await switchUiMode('lite');
    const saved = JSON.parse((await AsyncStorage.getItem('tazq-prefs-storage')) as string);
    expect(saved.state.uiMode).toBe('lite');
    expect(reload).toHaveBeenCalledTimes(1);
  });

});

describe('Sade mod cihazın seçimi', () => {
  it('buluttaki kopya modu asla değiştirmez', () => {
    usePrefsStore.getState().setUiMode('pro');
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({ uiMode: 'lite', liteGoalsPaused: true }));
    expect(usePrefsStore.getState().uiMode).toBe('pro');
    expect(usePrefsStore.getState().liteGoalsPaused).toBe(false);
  });
});

describe('giriş yapmış kullanıcı misafir olamaz', () => {
  beforeEach(() => { useSessionStore.getState().setGuest(false); useAuthStore.setState({ isLoggedIn: false, user: null }); });
  it('oturum açıkken misafirlik başlamaz', () => {
    useAuthStore.setState({ isLoggedIn: true });
    useAuthStore.getState().startGuest();
    expect(useSessionStore.getState().isGuest).toBe(false);
  });
  it('takılı kalmış bayrak sunucudan kullanıcı gelince onarılır', () => {
    useSessionStore.getState().setGuest(true);
    useAuthStore.getState().setUser({ id: 7 } as never);
    expect(useSessionStore.getState().isGuest).toBe(false);
  });
  it('oturum yokken misafirlik çalışır', () => {
    useAuthStore.getState().startGuest();
    expect(useSessionStore.getState().isGuest).toBe(true);
  });
});
