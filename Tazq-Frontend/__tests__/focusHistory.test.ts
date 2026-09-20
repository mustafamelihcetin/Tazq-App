import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { weekRange, summarizeWeek } from '@/features/report/weeklyReport';

const mockSessions = jest.fn();
const mockStats = jest.fn();
jest.mock('@/shared/services/api', () => ({
  FocusService: {
    getSessions: (...a: unknown[]) => mockSessions(...a),
    getStats: (...a: unknown[]) => mockStats(...a),
  },
}));

/**
 * ODAK GEÇMİŞİ — rapor için sunucuya bağımlı TEK veri.
 *
 * ── ÖLÇÜLEN SORUNLAR ────────────────────────────────────────────────────────
 *  1. Rapor tamamen sunucudan besleniyordu: bağlantı yokken ekran "Rapor yüklenemedi"
 *     deyip boş kalıyordu (uygulamanın geri kalanı çevrimdışı çalışırken).
 *  2. Seans geçmişi ucu YENİ: sunucu güncellenmeden önce 404 döner. Yedek olmasaydı
 *     odak dakikaları üç ekranda birden sıfırlanırdı — çalışan bir özelliği bozmak.
 */

const err = (status: number) => Object.assign(new Error('x'), { response: { status } });

beforeEach(() => {
  jest.clearAllMocks();
  useFocusHistoryStore.setState({ sessions: [], lastSyncedAt: null, loading: false, neverLoaded: true, usingLegacyFallback: false });
});

describe('geçmiş indirme', () => {
  it('sunucudan gelen satırlar saklanır', async () => {
    mockSessions.mockResolvedValue([{ startedAt: '2026-09-15T09:00:00.000Z', minutes: 25 }]);
    await useFocusHistoryStore.getState().refresh();
    const st = useFocusHistoryStore.getState();
    expect(st.sessions).toEqual([{ startedAt: '2026-09-15T09:00:00.000Z', minutes: 25 }]);
    expect(st.neverLoaded).toBe(false);
    expect(st.usingLegacyFallback).toBe(false);
  });

  it('çevrimdışıyken ELDEKİ geçmiş korunur — ekran boşalmaz', async () => {
    mockSessions.mockResolvedValue([{ startedAt: '2026-09-15T09:00:00.000Z', minutes: 25 }]);
    await useFocusHistoryStore.getState().refresh();

    mockSessions.mockRejectedValue(new Error('network'));
    await useFocusHistoryStore.getState().refresh();

    expect(useFocusHistoryStore.getState().sessions).toHaveLength(1);
    expect(useFocusHistoryStore.getState().neverLoaded).toBe(false);
  });

  it('ESKİ sunucuda (404) bu haftanın dakikaları eski uçtan doldurulur', async () => {
    mockSessions.mockRejectedValue(err(404));
    mockStats.mockResolvedValue({
      weeklyFocus: [{ day: 'Mon', minutes: 30 }, { day: 'Tue', minutes: 0 }, { day: 'Wed', minutes: 45 }],
    });

    await useFocusHistoryStore.getState().refresh();
    const st = useFocusHistoryStore.getState();
    expect(st.usingLegacyFallback).toBe(true);

    // Dakikalar haftanın DOĞRU günlerine düşmeli (yerel gün anahtarıyla).
    const range = weekRange(new Date());
    const summary = summarizeWeek({ sessions: st.sessions, tasks: [], habits: [], range });
    expect(summary.focusPerDay[0]).toBe(30);
    expect(summary.focusPerDay[1]).toBe(0);
    expect(summary.focusPerDay[2]).toBe(45);
    expect(summary.totalFocusMin).toBe(75);
  });

  it('401 yedek yolu TETİKLEMEZ — oturum yenileme akışının işi', async () => {
    mockSessions.mockRejectedValue(err(401));
    await useFocusHistoryStore.getState().refresh();
    expect(mockStats).not.toHaveBeenCalled();
    expect(useFocusHistoryStore.getState().neverLoaded).toBe(true);
  });

  it('çıkışta geçmiş silinir — kişisel veri cihazda kalmaz', async () => {
    mockSessions.mockResolvedValue([{ startedAt: '2026-09-15T09:00:00.000Z', minutes: 25 }]);
    await useFocusHistoryStore.getState().refresh();
    useFocusHistoryStore.getState().clear();
    expect(useFocusHistoryStore.getState().sessions).toEqual([]);
    expect(useFocusHistoryStore.getState().neverLoaded).toBe(true);
  });
});
