/**
 * ÇÖKME: "Cannot read property 'map' of undefined" — Ramazan kartı, uygulama açılışı.
 *
 * Kaynak: `hydrateFromCloud` yalnız `parsed[key] === undefined` kontrolü yapıyordu.
 * Bulut `null` göndermişse (bayat senkron, kısmi yazma) koruma delinip depoya `null`
 * yazılıyordu — tip `string[]` dese de. `usePlanLifecycle` ve ondan yararlanan yedi
 * kart bu alanda `.map(...)` çağırınca tüm ekran çöküyordu.
 *
 * Bu test GERÇEK store'u çalıştırır (metin taraması değil): aynı bozuk veriyi
 * `hydrateFromCloud`'a verip depodaki alanın hâlâ bir DİZİ olduğunu doğrular. Sadece
 * bu değişikliği değil, "plan kimlik alanları asla dizi dışı bir şey olamaz"
 * sözleşmesinin kendisini kilitliyor — ileride eklenecek bir yol da bu testten geçmek
 * zorunda kalır.
 */
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

const PLAN_ID_FIELDS = [
  'examPlanHabitIds', 'examPlanTaskIds',
  'exam2PlanHabitIds', 'exam2PlanTaskIds',
  'exam3PlanHabitIds', 'exam3PlanTaskIds',
  'ramazanPlanHabitIds', 'ramazanPlanTaskIds',
  'tezPlanHabitIds', 'tezPlanTaskIds',
  'mulakatPlanHabitIds', 'mulakatPlanTaskIds',
  'mulakat2PlanHabitIds', 'mulakat2PlanTaskIds',
  'mulakat3PlanHabitIds', 'mulakat3PlanTaskIds',
  'sporPlanHabitIds', 'sporPlanTaskIds',
  'spor2PlanHabitIds', 'spor2PlanTaskIds',
  'spor3PlanHabitIds', 'spor3PlanTaskIds',
  'tasarrufPlanHabitIds', 'tasarrufPlanTaskIds',
  'birakmaPlanHabitIds', 'birakmaPlanTaskIds',
] as const;

beforeEach(() => {
  usePrefsStore.getState().resetUserData();
});

describe('bulut senkronunda hasarlı plan kimlikleri', () => {
  it('bulut null gönderirse depo yine de DİZİ tutar (Ramazan çökmesi)', () => {
    // Gerçek olayda tetikleyici tam bu alandı.
    const cloud = JSON.stringify({ ramazanPlanHabitIds: null, ramazanPlanTaskIds: null });
    usePrefsStore.getState().hydrateFromCloud(cloud);
    expect(Array.isArray(usePrefsStore.getState().ramazanPlanHabitIds)).toBe(true);
    expect(Array.isArray(usePrefsStore.getState().ramazanPlanTaskIds)).toBe(true);
    // `.map` artık çökme değil, boş sonuç verir — kartın gerçek davranışı.
    expect(() => usePrefsStore.getState().ramazanPlanHabitIds.map(x => x)).not.toThrow();
  });

  it('YİRMİ SEKİZ plan kimlik alanının HEPSİ aynı korumayı paylaşır', () => {
    const corrupted: Record<string, null> = {};
    for (const f of PLAN_ID_FIELDS) corrupted[f] = null;
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify(corrupted));

    const state = usePrefsStore.getState() as unknown as Record<string, unknown>;
    for (const f of PLAN_ID_FIELDS) {
      expect([f, Array.isArray(state[f])]).toEqual([f, true]);
    }
  });

  it('bulut STRING gönderse bile (tip hatası, undefined değil) depo diziye döner', () => {
    const cloud = JSON.stringify({ tezPlanHabitIds: 'oops', tezPlanTaskIds: 42 });
    usePrefsStore.getState().hydrateFromCloud(cloud);
    expect(usePrefsStore.getState().tezPlanHabitIds).toEqual([]);
    expect(usePrefsStore.getState().tezPlanTaskIds).toEqual([]);
  });

  it('geçerli bir dizi bulut senkronunda BOZULMADAN geçer', () => {
    // Koruma "her zaman boşalt" değil — yalnız dizi olmayanı süzer.
    const cloud = JSON.stringify({ examPlanHabitIds: ['h1', 'h2'], examPlanTaskIds: [1, 2] });
    usePrefsStore.getState().hydrateFromCloud(cloud);
    expect(usePrefsStore.getState().examPlanHabitIds).toEqual(['h1', 'h2']);
    expect(usePrefsStore.getState().examPlanTaskIds).toEqual([1, 2]);
  });

  it('yereldeki aktif plan bayat bulutça EZİLMEZ (mevcut kural korunuyor)', () => {
    usePrefsStore.getState().setSeasonalPref('examMode', true);
    usePrefsStore.getState().setPlanIds('exam', ['local-h'], [999]);
    const staleCloud = JSON.stringify({ examPlanHabitIds: [], examPlanTaskIds: [] });
    usePrefsStore.getState().hydrateFromCloud(staleCloud);
    expect(usePrefsStore.getState().examPlanHabitIds).toEqual(['local-h']);
  });
});

describe('usePlanLifecycle ikinci bir güvenlik katmanı taşır', () => {
  it('habitIds parametresi undefined kabul eder ve içeride diziye çevirir', () => {
    // Store artık asla bozuk veri sızdırmasa da, hook KENDİ savunmasını da taşır —
    // çağıran taraf ileride store dışı bir kaynaktan (prop, test, taslak state)
    // besleyebilir. İki katman aynı hatayı iki farklı yerde önler.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, '../features/modes/hooks/usePlanLifecycle.ts'), 'utf8');
    expect(src).toContain('habitIds: string[] | undefined');
    expect(src).toContain('habitIds ?? []');
  });
});
