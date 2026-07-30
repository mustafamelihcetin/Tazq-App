import { AiService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { usePlanPoolStore, poolKey, type PoolVariant } from '@/features/modes/store/usePlanPoolStore';
import { planPoolKeyFor, type DailyPlanSpec } from '@/features/modes/utils/dailyPlanEngine';
import { swallow } from '@/shared/utils/swallow';

/**
 * Genişletilmiş görev havuzunu ARKA PLANDA doldurur.
 *
 * TASARIM SÖZLEŞMESİ — bu dosyanın hiçbir satırı kullanıcıyı bekletemez:
 *  · asla `await` edilmez (ateşle-unut),
 *  · asla hata fırlatmaz,
 *  · asla kullanıcıya bir şey göstermez,
 *  · çevrimdışıyken hiç denemez,
 *  · plan+faz başına EN FAZLA bir kez (başarısızsa günde bir tekrar).
 *
 * Başarısız olursa `dailyPlanEngine` sabit havuzla devam eder — yani bugünkü
 * davranışın birebir aynısı. Bu yüzden GROQ_API_KEY tanımlı olmasa bile
 * (şu an öyle) hiçbir şey bozulmaz; anahtar eklendiği gün kendiliğinden çalışır.
 */

/** Havuz ne kadar büyütülsün — sabit havuzlar 2-4 görev, hedef ~5 haftalık çeşitlilik. */
const TARGET_COUNT = 14;

/** Aynı oturumda aynı anahtar için iki kez ağa çıkmayı önler. */
const inFlight = new Set<string>();

/** Bu spec için önbellekteki genişletilmiş havuz (yoksa undefined). */
export function getExtraPool(spec: DailyPlanSpec): PoolVariant[] | undefined {
  const { kind, phase } = planPoolKeyFor(spec);
  return usePlanPoolStore.getState().getPool(poolKey(kind, phase));
}

/**
 * Havuz eksikse arka planda doldurmayı dener. Çağıran sonucu BEKLEMEZ.
 * Bugünün görevleri her hâlükârda mevcut havuzla üretilir; genişletilmiş havuz
 * en erken YARIN devreye girer. Bu bilinçli: kullanıcı hiçbir zaman ağ beklemez.
 */
export function ensureExtraPool(spec: DailyPlanSpec): void {
  const { kind, phase } = planPoolKeyFor(spec);
  const key = poolKey(kind, phase);

  if (inFlight.has(key)) return;
  if (!usePlanPoolStore.getState().shouldTry(key)) return;
  if (!useNetworkStore.getState().isOnline) return; // çevrimdışı → hiç deneme

  inFlight.add(key);
  usePlanPoolStore.getState().markAttempt(key);

  AiService.planPool({ kind, phase, name: spec.name, count: TARGET_COUNT })
    .then((variants) => {
      // Sunucu doğrulama yapıyor ama istemci de asla körü körüne güvenmez.
      const clean = (variants ?? []).filter(
        v => v && typeof v.tr === 'string' && typeof v.en === 'string' &&
             v.tr.trim().length > 0 && v.en.trim().length > 0 &&
             v.tr.length <= 120 && v.en.length <= 120
      );
      if (clean.length > 0) usePlanPoolStore.getState().setPool(key, clean);
    })
    .catch((e) => {
      // 503 (anahtar yok) dahil HER hata sessiz. markAttempt zaten yapıldığı için
      // aynı anahtar 24 saat boyunca tekrar denenmez.
      swallow('planPoolSync.fetch', e);
    })
    .finally(() => {
      inFlight.delete(key);
    });
}
