/**
 * ADIM ÖZETİ — spor modundaki günlük hareket satırının metni.
 *
 * ── NE YAPMIYORUZ ───────────────────────────────────────────────────────────────
 * Burada ANTRENÖRLÜK YOK. Kalori, tempo, VO2max, "bugün 2000 adım daha atmalısın" gibi
 * hiçbir şey yok. Üç sebebi var:
 *   1. Doğru değil — adım sayısından kalori ya da form çıkarmak tahmin üstüne tahmindir.
 *   2. Bizim işimiz değil — bu bir alışkanlık ve plan uygulaması, spor koçu değil.
 *      Reçete yazmaya başladığımız an, tutmadığında sorumluluğu da almış oluruz.
 *   3. Sağlık iddiası, uygulama mağazalarında ayrı bir inceleme kategorisidir.
 *
 * ── NE YAPIYORUZ ────────────────────────────────────────────────────────────────
 * Olguyu güzel gösteriyoruz: kaç adım, kaç kilometre, ve günün nasıl geçtiğine dair TEK
 * sıcak kelime. Kullanıcı sayıya baktığında ne yapması gerektiğini zaten bilir; bizim
 * işimiz onu suçlamadan ya da abartmadan göstermek.
 *
 * ── NEDEN SUÇLAMA YOK ───────────────────────────────────────────────────────────
 * Alt bantlar bilerek nötr: "Hafif bir gün" der, "az hareket ettin" demez. Aradaki fark
 * büyük — biri günü tarif eder, öteki kullanıcıyı yargılar. Hareketsiz bir günün sebebi
 * hastalık, iş yoğunluğu ya da yas olabilir; uygulama bunu bilmez. Bilmediği bir şey
 * hakkında hüküm veren bir arayüz, kapatılmayı hak eder.
 */

export type StepBand = 'none' | 'light' | 'moving' | 'good' | 'great';

export interface StepSummary {
  band: StepBand;
  /** "6.240 adım" */
  steps: string;
  /** "4,5 km" — mesafe gerçek veriden gelir, adımdan TAHMİN EDİLMEZ. */
  distance: string | null;
  /** Tek kelimelik sıcak yorum. */
  note: string;
}

/**
 * Bant eşikleri. 10.000 adım TIBBİ bir hedef değil, kültürel bir eşik (1960'larda bir
 * Japon pedometre reklamından kalma) — o yüzden "hedef" diye sunulmuyor, yalnızca en üst
 * bandın adı olarak kullanılıyor. Kullanıcıya "ulaşman gereken sayı" diye bir şey
 * söylenmiyor; kendi günü kendine kıyaslansın diye sayı olduğu gibi duruyor.
 */
const LIGHT = 3000;
const MOVING = 7000;
const GREAT = 10000;

function bandOf(steps: number): StepBand {
  if (!Number.isFinite(steps) || steps <= 0) return 'none';
  if (steps < LIGHT) return 'light';
  if (steps < MOVING) return 'moving';
  if (steps < GREAT) return 'good';
  return 'great';
}

const NOTES: Record<StepBand, { tr: string; en: string }> = {
  none: { tr: 'Henüz veri yok', en: 'No data yet' },
  // "Az hareket ettin" DEĞİL: gün tarif ediliyor, kullanıcı yargılanmıyor.
  light: { tr: 'Hafif bir gün', en: 'A light day' },
  moving: { tr: 'Hareket var', en: 'On the move' },
  good: { tr: 'Güzel bir gün', en: 'A good day' },
  great: { tr: 'Harika bir gün', en: 'A great day' },
};

/**
 * Binlik ayraçlı sayı — `toLocaleString` KULLANILMIYOR.
 *
 * Intl desteği Android/Hermes yapılandırmasına göre değişiyor ve eksik olduğunda sessizce
 * ayraçsız sayı basıyor. Bu projede Türkçe yerel ayarın sessizce yanlış davrandığı bir
 * hata zaten yaşandı; belirsiz bir platform davranışına güvenmek yerine elle biçimliyoruz.
 */
export function formatSteps(n: number, lang: 'tr' | 'en'): string {
  const safe = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const sep = lang === 'tr' ? '.' : ',';
  const grouped = String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return lang === 'tr' ? `${grouped} adım` : `${grouped} steps`;
}

/** Metreyi km'ye çevirir. 100 m altı gösterilmez — "0,0 km" bilgi taşımaz. */
export function formatDistance(meters: number, lang: 'tr' | 'en'): string | null {
  if (!Number.isFinite(meters) || meters < 100) return null;
  const km = meters / 1000;
  const s = km.toFixed(1);
  return lang === 'tr' ? `${s.replace('.', ',')} km` : `${s} km`;
}

export function stepSummary(steps: number, distanceMeters: number, lang: 'tr' | 'en'): StepSummary {
  const band = bandOf(steps);
  return {
    band,
    steps: formatSteps(steps, lang),
    distance: formatDistance(distanceMeters, lang),
    note: NOTES[band][lang],
  };
}
