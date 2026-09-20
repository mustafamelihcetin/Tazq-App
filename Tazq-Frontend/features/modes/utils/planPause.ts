import { parseDateKey, toDateKey } from '@/shared/utils/dateKey';

/**
 * PLANI DURAKLATMA — saf kural katmanı.
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * Sayfanın adı "Yaşam Modları" ama hayatın araya girmesi için hiçbir yer yoktu.
 * Hasta olan, seyahate çıkan ya da bir haftası tıkabasa dolu olan kullanıcının iki
 * seçeneği vardı: ya görevler her sabah gelmeye devam etsin ve yapamadıkları
 * birikmiş bir suçluluğa dönüşsün, ya da modu kapatıp planı tamamen emekliye
 * ayırsın. Yani "bu hafta ara vermek istiyorum" demek "hedefinden vazgeç" demekti.
 *
 * ── SINIR TEK BİR GÜN, ARALIK DEĞİL ────────────────────────────────────────
 * Duraklatma `pausedUntil` adlı TEK bir gün anahtarıyla tutulur: o gün DAHİL
 * duraklıdır, ertesi gün plan kendiliğinden devam eder. Başlangıç ayrıca
 * saklanmaz — saklansaydı iki alanın tutarlılığını korumak gerekirdi ve "başlangıç
 * ileri, bitiş geri" gibi imkânsız durumlar yazılabilirdi. Kendiliğinden bitmesi de
 * kasıtlı: kullanıcıdan planı yeniden başlatmasını beklemek, tatil dönüşü unutulan
 * ve sessizce ölen bir plan demekti.
 *
 * Gün anahtarı DIŞARIDAN verilir (`todayKey`). Uygulamada gün, gece kuşları için
 * 3 saatlik tamponla hesaplanıyor (bkz. fmtDateKey); o kuralı burada ikinci kez
 * yazmak, iki kuralın zamanla ayrışması demekti.
 */

/** `days` gün duraklat: bugün dahil, son duraklı günün anahtarını verir. */
export function pauseUntilKey(days: number, todayKey: string): string {
  const n = Math.max(1, Math.floor(days));
  const d = parseDateKey(todayKey);
  d.setDate(d.getDate() + (n - 1));
  return toDateKey(d);
}

/** Verilen gün duraklı mı? ('YYYY-MM-DD' sözlük sırası takvim sırasıyla aynıdır.) */
export function isPausedOn(pausedUntil: string | null | undefined, todayKey: string): boolean {
  if (!pausedUntil) return false;
  return todayKey <= pausedUntil;
}

/** Duraklamanın bitmesine kaç gün kaldı (bugün dahil). Duraklı değilse 0. */
export function pauseDaysLeft(pausedUntil: string | null | undefined, todayKey: string): number {
  if (!isPausedOn(pausedUntil, todayKey)) return 0;
  const end = parseDateKey(pausedUntil!).getTime();
  const now = parseDateKey(todayKey).getTime();
  return Math.max(1, Math.round((end - now) / 86400000) + 1);
}

/** Kullanıcıya sunulan hazır süreler. */
export const PAUSE_CHOICES = [1, 3, 7] as const;

/**
 * Duraklatılabilen plan yuvaları — `PlanMode`un tamamı.
 *
 * Liste burada elle duruyor çünkü `PLAN_MODE_TAGS` bir ETİKET listesi ve içinde
 * yuva olmayan adlar var ('yks', 'kpss' — ikisi de 'exam' yuvasında yaşar). Onu
 * kullanmak, var olmayan yuvaları duraklatmaya çalışmak demekti.
 */
export const PAUSABLE_MODES = [
  'exam', 'exam2', 'exam3', 'tez',
  'mulakat', 'mulakat2', 'mulakat3',
  'spor', 'spor2', 'spor3',
  'ramazan', 'tasarruf', 'birakma',
] as const;
