import { parseDateKey } from '@/shared/utils/dateKey';

/**
 * PLANIN UZUN YOLU — "ne kadar kaldı" değil, "ne kadar yol aldım".
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * 60 günlük sınav planının 25. günündeki kullanıcı bu ekranda yalnızca "35 GÜN"
 * ve "bugün 2/3" görüyordu. Yani sadece ne kadar AZ vakti kaldığını. 25 gündür ne
 * yaptığı hiçbir yerde yazmıyordu; ekran her açılışta kaygı üretiyor, güven
 * üretmiyordu. Bağlılık biriken emekten doğar — birikim görünmüyorsa yoktur.
 *
 * ── ÖLÇÜ NEDEN ALIŞKANLIK GÜNLERİ ──────────────────────────────────────────
 * "Kaç görev bitirdim" sayılamaz: günlük görevleri motor her gün yeniden üretiyor
 * ve eskiler emekliye ayrılıyor — geçmiş, görev listesinde durmuyor. Planın
 * alışkanlıklarının `completedDates`i ise kalıcı. Bu yüzden ölçü "kaç gününde
 * gerçekten çalıştın": insanın kendi emeğini tanıdığı sayı da zaten budur.
 *
 * Saf tutuluyor — store/tema/dil bilmez, gün anahtarlarıyla çalışır.
 */

export interface PlanArc {
  /** Plan başlayalı kaç gün oldu (bugün dahil, en az 1). */
  elapsedDays: number;
  /** Baştan hedefe toplam kaç gün. Hedef tarihi yoksa null. */
  totalDays: number | null;
  /** Yolun yüzdesi (0–100). Hedef tarihi yoksa null. */
  pct: number | null;
  /** Bu sürenin kaç gününde plana ait bir alışkanlık tamamlanmış. */
  effortDays: number;
}

const dayDiff = (aKey: string, bKey: string): number =>
  Math.round((parseDateKey(bKey).getTime() - parseDateKey(aKey).getTime()) / 86400000);

export function planArcFor(opts: {
  /** Planın damgalandığı gün ('YYYY-MM-DD'). Eski planlarda olmayabilir. */
  startKey: string | null | undefined;
  /** Hedef tarihi. Süresiz hedeflerde null. */
  targetKey: string | null | undefined;
  todayKey: string;
  /** Plana ait her alışkanlığın tamamlanan gün anahtarları. */
  habitCompletions: Array<string[] | undefined>;
}): PlanArc | null {
  const { startKey, targetKey, todayKey, habitCompletions } = opts;
  if (!startKey) return null;                 // eski plan: uydurma sayı göstermektense hiç gösterme
  if (startKey > todayKey) return null;       // saat/zaman dilimi kayması — sessizce çık

  const elapsedDays = dayDiff(startKey, todayKey) + 1;

  let totalDays: number | null = null;
  let pct: number | null = null;
  if (targetKey && targetKey >= startKey) {
    totalDays = dayDiff(startKey, targetKey) + 1;
    pct = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100))) : null;
  }

  const worked = new Set<string>();
  for (const dates of habitCompletions) {
    if (!dates) continue;
    for (const k of dates) {
      // Aralık dışı günler sayılmaz: aynı alışkanlık önceki bir plandan kalmış olabilir.
      if (k >= startKey && k <= todayKey) worked.add(k);
    }
  }

  return { elapsedDays, totalDays, pct, effortDays: Math.min(worked.size, elapsedDays) };
}
