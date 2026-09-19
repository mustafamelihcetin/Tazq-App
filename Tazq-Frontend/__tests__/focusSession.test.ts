import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import {
  commitFocusSession, finalizeDueSession, focusAlarmSpec, syncFocusAlarm,
  onAppBackground, onAppForeground, strictBreached, STRICT_GRACE_MS,
  __resetFocusAlarmForTests,
} from '@/features/focus/session';

const mockSave = jest.fn();
jest.mock('@/shared/services/api', () => ({
  FocusService: { saveSession: (...a: unknown[]) => mockSave(...a) },
}));
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('@/shared/utils/notifications', () => ({
  scheduleFocusAlert: (...a: unknown[]) => mockSchedule(...a),
  cancelFocusAlert: (...a: unknown[]) => mockCancel(...a),
  FOCUS_END_ID: 'focus-end',
  FOCUS_STRICT_ID: 'focus-strict',
}));

/**
 * ODAK SEANSI — sayaç, kayıt, alarm ve katı mod.
 *
 * ── ÖLÇÜLEN SORUNLAR ────────────────────────────────────────────────────────
 *  1. Süre iki kez düşülüyordu: 25 dakikalık seansın 10 dakikasını ekranda geçirip
 *     uygulamadan çıkan kullanıcıda seans 16. dakikada "bitti" sayılıyordu.
 *  2. Aynı seans iki kez kaydediliyordu (kat + ekran) → istatistikler şişiyordu.
 *  3. Mola, odak seansı gibi kaydediliyordu.
 *  4. Telefon kilitliyken süre dolunca hiçbir şey haber vermiyordu.
 *  5. Katı mod, ekranın kendiliğinden kilitlenmesini "kaçtın" sayıp 10 puan kesiyordu.
 */

const MIN = 60_000;
let NOW = new Date(2026, 8, 20, 10, 0, 0).getTime();
const at = (ms: number) => { NOW = ms; };

beforeAll(() => { jest.spyOn(Date, 'now').mockImplementation(() => NOW); });
afterAll(() => { (Date.now as jest.Mock).mockRestore?.(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
  NOW = new Date(2026, 8, 20, 10, 0, 0).getTime();
  __resetFocusAlarmForTests();
  useOfflineQueue.setState({ ops: [] } as never);
  useNetworkStore.setState({ isOnline: true } as never);
  useFocusStore.setState({
    isActive: false, seconds: 1500, totalSeconds: 1500, pausedSeconds: null,
    currentTask: '', currentTaskId: null, lastActiveAt: null, expectedFinishAt: null,
    sessionId: null, sessionKind: 'focus', committedSessionId: null, finishedAt: null,
    dailyFocusMinutes: 0, dailyFocusDate: '2026-09-20', focusPoints: 0,
    pomodoroMode: false, pomodoroPhase: 'work', pomodoroRound: 1, strictMode: false,
  } as never);
});

const s = () => useFocusStore.getState();
const start = (mins = 25) => { s().setDuration(mins); s().setIsActive(true); };

describe('sayaç SAATTEN okunur', () => {
  it('ekranda geçen süre bir kez düşülür — arka plan onu TEKRAR düşmez', () => {
    /*
      Eski hesap "kalan − (şimdi − başlangıç)" idi; başlangıçtan beri geçen süre zaten
      kalandan düşmüştü. 10 dakikası ekranda geçen 25 dakikalık seans, 6 dakika sonra
      dönüldüğünde 16. dakikada bitmiş sayılıyordu.
    */
    start(25);
    at(NOW + 10 * MIN);
    s().tick();
    expect(s().seconds).toBe(15 * 60);

    at(NOW + 6 * MIN); // arka planda hiç tik yok
    s().rehydrateTimer();
    expect(s().seconds).toBe(9 * 60);
    expect(s().isActive).toBe(true);
  });

  it('tik atlansa da sayaç geri kalmaz — kayan saat yok', () => {
    start(25);
    at(NOW + 5000); // JS meşguldü: 5 saniyede tek tik
    s().tick();
    expect(s().seconds).toBe(25 * 60 - 5);
  });

  it('seans tam süresi dolunca biter', () => {
    start(25);
    at(NOW + 25 * MIN);
    s().tick();
    expect(s().seconds).toBe(0);
    expect(s().isActive).toBe(false);
  });

  it('duraklat kalan süreyi dondurur; devam edince kaldığı yerden sürer', () => {
    start(25);
    at(NOW + 4 * MIN);
    s().setIsActive(false);
    expect(s().seconds).toBe(21 * 60);
    at(NOW + 30 * MIN); // duraklamışken geçen süre SAYILMAZ
    s().rehydrateTimer();
    expect(s().seconds).toBe(21 * 60);
    s().setIsActive(true);
    at(NOW + 60_000);
    s().tick();
    expect(s().seconds).toBe(20 * 60);
  });

  it('gece yarısını geçen DURAKLATILMIŞ seans silinmez', () => {
    start(25);
    at(NOW + 4 * MIN);
    s().setIsActive(false);
    useFocusStore.setState({ dailyFocusDate: '2026-09-19' } as never);
    s().rehydrateTimer();
    expect(s().seconds).toBe(21 * 60);
    expect(s().dailyFocusMinutes).toBe(0); // yeni günün sayacı sıfırlanır
  });
});

describe('bir seans BİR kez kaydedilir', () => {
  it('iki ayrı yol aynı seansı ikinci kez kaydedemez', () => {
    start(25);
    at(NOW + 25 * MIN);
    s().tick();
    expect(finalizeDueSession()).toBe('saved');
    expect(commitFocusSession(25, true)).toBe('duplicate'); // ekranın kutlama yolu
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('Focus', 25, true);
    expect(s().dailyFocusMinutes).toBe(25);
  });

  it('yeni seans yeniden kaydedilebilir', () => {
    start(25);
    at(NOW + 25 * MIN);
    s().tick();
    finalizeDueSession();
    s().reset();
    start(15);
    at(NOW + 15 * MIN);
    s().tick();
    expect(finalizeDueSession()).toBe('saved');
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('1 dakikanın altı kaydedilmez', () => {
    start(25);
    expect(commitFocusSession(0, false)).toBe('too-short');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('çevrimdışı seans kuyruğa girer — kaybolmaz', () => {
    useNetworkStore.setState({ isOnline: false } as never);
    start(25);
    at(NOW + 25 * MIN);
    s().tick();
    expect(finalizeDueSession()).toBe('saved');
    expect(mockSave).not.toHaveBeenCalled();
    expect((useOfflineQueue.getState().ops as unknown[]).length).toBe(1);
  });

  it('süresi dolmamış seans kaydedilmez', () => {
    start(25);
    at(NOW + 5 * MIN);
    s().tick();
    expect(finalizeDueSession()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('mola odak DEĞİLDİR', () => {
  it('mola dakikaları odak olarak kaydedilmez', () => {
    s().startBreak(5);
    at(NOW + 5 * MIN);
    s().tick();
    expect(s().seconds).toBe(0);
    expect(finalizeDueSession()).toBeNull();
    expect(commitFocusSession(5, true)).toBe('not-focus');
    expect(mockSave).not.toHaveBeenCalled();
    expect(s().dailyFocusMinutes).toBe(0);
  });

  it('moladan sonra yeni süre seçmek seansı yeniden ODAK yapar', () => {
    s().startBreak(5);
    s().setDuration(25);
    expect(s().sessionKind).toBe('focus');
  });
});

describe('hayalet kayıt olmaz', () => {
  it('kimliği ve bitiş anı olmayan sıfır sayaç KAYDEDİLMEZ', () => {
    /*
      Sürüm yükseltmesinde diskte kalan eski bir "0" durumu, hiç yaşanmamış bir seansı
      kaydettirebilirdi (kilit yeni kimlik üretip onu kaydederdi).
    */
    useFocusStore.setState({ isActive: false, seconds: 0, totalSeconds: 1500, sessionId: null, finishedAt: null, committedSessionId: null } as never);
    expect(finalizeDueSession()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('bitiş alarmı — kilitli telefonda tek haber verme yolu', () => {
  const base = { isActive: true, expectedFinishAt: NOW + 25 * MIN, totalSeconds: 1500, sessionKind: 'focus' as const, pomodoroMode: false, currentTask: 'Rapor yaz' };

  it('çalışan odak seansı için bitiş anına kurulur, görev adıyla', () => {
    const spec = focusAlarmSpec(base, 'tr', false);
    expect(spec?.fireAt).toBe(base.expectedFinishAt);
    expect(spec?.body).toContain('Rapor yaz');
  });

  it('"bildirimde içeriği gizle" açıkken görev adı GEÇMEZ', () => {
    expect(focusAlarmSpec(base, 'tr', true)?.body).not.toContain('Rapor yaz');
  });

  it('mola ve pomodoro turu kendi metnini alır', () => {
    expect(focusAlarmSpec({ ...base, sessionKind: 'break' }, 'tr', false)?.title).toBe('Mola bitti');
    expect(focusAlarmSpec({ ...base, pomodoroMode: true }, 'tr', false)?.title).toBe('Tur tamamlandı');
  });

  it('duraklatılmış seansta alarm YOK', () => {
    expect(focusAlarmSpec({ ...base, isActive: false }, 'tr', false)).toBeNull();
  });

  it('başlatınca kurulur, duraklatınca iptal edilir', () => {
    start(25);
    syncFocusAlarm();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0]).toBe('focus-end');
    s().setIsActive(false);
    syncFocusAlarm();
    expect(mockCancel).toHaveBeenCalledWith('focus-end');
  });

  it('aynı durumda ikinci kez kurulmaz — saniyelik tik bildirim sistemini yormaz', () => {
    start(25);
    syncFocusAlarm();
    at(NOW + 1000);
    s().tick();
    syncFocusAlarm();
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe('katı mod — ceza değil, adil kural', () => {
  it('kısa ayrılık (bildirim çekme) seansı bozmaz', () => {
    useFocusStore.setState({ strictMode: true } as never);
    start(25);
    at(NOW + 2 * MIN);
    onAppBackground();
    at(NOW + 3000);
    expect(onAppForeground()).toBe(false);
    expect(s().isActive).toBe(true);
  });

  it('uzun ayrılıkta seans biter ve AYRILANA KADARKİ dakikalar kaydedilir', () => {
    useFocusStore.setState({ strictMode: true } as never);
    start(25);
    at(NOW + 8 * MIN);
    onAppBackground();
    at(NOW + 30 * MIN); // uzakta geçen süre odak değildir
    expect(onAppForeground()).toBe(true);
    expect(mockSave).toHaveBeenCalledWith('Focus', 8, false);
    expect(s().isActive).toBe(false);
    expect(s().seconds).toBe(s().totalSeconds);
  });

  it('PUAN CEZASI YOK — ayrılmak seansı bitirir, kullanıcıyı cezalandırmaz', () => {
    useFocusStore.setState({ strictMode: true, focusPoints: 40 } as never);
    start(25);
    at(NOW + 8 * MIN);
    onAppBackground();
    at(NOW + 30 * MIN);
    onAppForeground();
    // 8 dk yarım seans ödülü eklenir (2*8 üst sınır 10), hiçbir şey EKSİLMEZ
    expect(s().focusPoints).toBeGreaterThanOrEqual(40);
  });

  it('katı mod kapalıyken ayrılmak hiçbir şey yapmaz', () => {
    start(25);
    at(NOW + 8 * MIN);
    onAppBackground();
    at(NOW + 30 * MIN);
    expect(onAppForeground()).toBe(false);
    expect(s().isActive).toBe(true);
  });

  it('sınır 10 saniye', () => {
    expect(STRICT_GRACE_MS).toBe(10_000);
    expect(strictBreached(0, 9_000)).toBe(false);
    expect(strictBreached(0, 11_000)).toBe(true);
    expect(strictBreached(null, 999_999)).toBe(false);
  });
});
