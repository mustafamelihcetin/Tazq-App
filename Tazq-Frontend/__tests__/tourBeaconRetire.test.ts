/**
 * "Bu sayfayı tanı" teklifi her girişte çıkıyordu; kapatmanın tek yolu ×'ti.
 * Kullanıcı kararı (2026-10-29): teklifi gören ama dokunmadan ayrılan istemiyor olabilir.
 * Kural: teklif ≥ 3 sn göründükten sonra dokunulmadan ayrılınca emekliye ayrılır;
 * daha kısa (sekmeler arası hızlı geçiş) görüldüyse bir şans daha verilir.
 */
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

import { shouldRetireBeacon, BEACON_SEEN_MS } from '@/features/onboarding/utils/firstRun';

describe('tur teklifi — kendiliğinden emeklilik', () => {
  it('yeterince göründü, dokunulmadı, ayrıldı → bir daha çıkmaz', () => {
    expect(shouldRetireBeacon({ visibleMs: BEACON_SEEN_MS, started: false })).toBe(true);
    expect(shouldRetireBeacon({ visibleMs: 60_000, started: false })).toBe(true);
  });

  it('hızlı geçişte (fark edilmemiş olabilir) bir şans daha', () => {
    expect(shouldRetireBeacon({ visibleMs: BEACON_SEEN_MS - 1, started: false })).toBe(false);
  });

  it('tur başladıysa bu yol karar vermez (turun kendi bitişi sayar)', () => {
    expect(shouldRetireBeacon({ visibleMs: 60_000, started: true })).toBe(false);
  });

  it('eşik: 3 saniye', () => {
    expect(BEACON_SEEN_MS).toBe(3000);
  });
});
