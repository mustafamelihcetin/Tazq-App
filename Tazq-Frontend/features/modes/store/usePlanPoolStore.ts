import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * GENİŞLETİLMİŞ GÜNLÜK GÖREV HAVUZU — plan+faz başına BİR KEZ üretilir, kalıcı saklanır.
 *
 * SORUN: `dailyPlanEngine` günlük görevleri koda gömülü havuzlardan seçiyor ve havuzlar
 * çok küçük — tıp/tez/mülakat fazlarında yalnız 2 görev. Günde 1 görev üreten bir
 * kullanıcı (dailyMinutes ≤ 60) aynı iki görevi aylarca dönüşümlü görüyor:
 *     Gün 1: Anki tekrarları · Gün 2: Qbank bloğu · Gün 3: Anki tekrarları · …
 * `deepen` fazı sınava 60–270 gün kala sürdüğü için bu ~7 ay demek.
 *
 * NEDEN GÜNLÜK ÜRETİM DEĞİL: uygulama offline-first ve günlük üretim motoru saf/
 * deterministik. Her gün ağ çağrısı yapmak hem bu iki özelliği hem de ücretsiz kota
 * bütçesini yakardı. Bunun yerine havuz plan+faz başına BİR KEZ genişletilir ve
 * burada saklanır; günlük seçim yine çevrimdışı ve deterministik kalır.
 *
 * MALİYET: bir plan ömrü boyunca en fazla 5 faz gördüğü için kullanıcı başına
 * plan başına ≤5 çağrı — günde değil, TOPLAM.
 *
 * BAŞARISIZLIK = SESSİZ. Havuz boşsa/gelmezse motor sabit havuza döner; yani en kötü
 * ihtimalde bugünkü davranışın aynısı olur. Bu yüzden anahtar tanımlı olmasa bile
 * (şu an öyle) hiçbir şey bozulmaz.
 */

export interface PoolVariant { tr: string; en: string }

interface PlanPoolState {
  /** anahtar: `${kind}:${phase}` → üretilmiş görev varyantları */
  pools: Record<string, PoolVariant[]>;
  /** Aynı anahtar için tekrar tekrar denememek üzere son deneme zamanı (ms). */
  attempts: Record<string, number>;
  getPool: (key: string) => PoolVariant[] | undefined;
  setPool: (key: string, variants: PoolVariant[]) => void;
  markAttempt: (key: string) => void;
  shouldTry: (key: string) => boolean;
  clear: () => void;
}

/** Başarısız denemeden sonra tekrar denemeden önce beklenecek süre. */
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

export const usePlanPoolStore = create<PlanPoolState>()(
  persist(
    (set, get) => ({
      pools: {},
      attempts: {},
      getPool: (key) => {
        const p = get().pools[key];
        return p && p.length > 0 ? p : undefined;
      },
      setPool: (key, variants) =>
        set((s) => ({ pools: { ...s.pools, [key]: variants } })),
      markAttempt: (key) =>
        set((s) => ({ attempts: { ...s.attempts, [key]: Date.now() } })),
      shouldTry: (key) => {
        const s = get();
        if (s.pools[key]?.length) return false;          // zaten var
        const last = s.attempts[key];
        if (!last) return true;
        return Date.now() - last > RETRY_AFTER_MS;       // başarısızsa günde 1 dene
      },
      clear: () => set({ pools: {}, attempts: {} }),
    }),
    { name: 'tazq-plan-pools', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Havuz anahtarı — kind + faz. Faz ilerledikçe yeni havuz üretilir. */
export function poolKey(kind: string, phase: string): string {
  return `${kind}:${phase || 'default'}`;
}
