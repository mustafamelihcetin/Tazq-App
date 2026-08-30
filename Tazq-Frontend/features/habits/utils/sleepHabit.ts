import { compactHabitLabel } from '@/features/habits/utils/habitLabel';

/**
 * "Bu alışkanlık, YETERİNCE UYUYARAK tamamlanmış sayılır mı?"
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Eski kural üç ölçütten HERHANGİ BİRİ tutunca "uyku" diyordu:
 *     healthMetric === 'sleep'  ||  emoji === '😴'  ||  /uyku|sleep/i.test(adlar)
 *
 * Spor planındaki toparlanma alışkanlığı üçünden İKİSİNE birden takılıyordu:
 *     { name: 'Dinlenme', nameTr: 'Toparlanma: uyku + aktif dinlenme', emoji: '😴' }
 *
 * Sonuç: yarışa hazırlanan kullanıcı sadece 7 saat uyuduğu için "Toparlanma: uyku +
 * aktif dinlenme" otomatik işaretleniyordu — aktif dinlenmeyi hiç yapmadan. Seri ve
 * momentum, olmamış bir işi olmuş gösteriyordu. Uygulamanın kullanıcıya söylediği en
 * temel şey (ne yaptın) yalan oluyordu.
 *
 * Aynı gevşek kural KAYIT ANINDA da çalışıyordu (useHabitStore.addHabit) ve
 * `healthMetric: 'sleep'` damgasını kalıcı depoya yazıyordu. Yani yalnız okuma
 * tarafını düzeltmek mevcut kullanıcıları kurtarmazdı — bkz. useHabitStore'daki
 * hidrasyon düzeltmesi.
 *
 * ── KURAL ─────────────────────────────────────────────────────────────────────
 * Ayrım "uyku kelimesi geçiyor mu" değil, "uyku bu alışkanlığın KONUSU mu":
 *
 *  1. Açık damga (`healthMetric === 'sleep'`) kazanır — veri, tahminden üstündür.
 *  2. Ad ÖNCE kimliğine indirgenir (`compactHabitLabel`): parantez içi ve uzun tireli
 *     açıklama atılır. "Düzenli uyku (7–9 saat) — kas onarımı için kritik" → "Düzenli
 *     uyku". Açıklamada geçen kelimeler konu belirlemez.
 *  3. Kimlik BİLEŞİKSE uyku sayılmaz: "A + B", "A ve B", "A and B", "Konu: ..." —
 *     bunlar birden çok iş ister, uyumak tek başına hiçbirini bitirmez.
 *  4. Geriye kalanda uyku kelimesi aranır.
 *
 * ── YANLIŞ TARAFA DÜŞME YÖNÜ: KAPALI ────────────────────────────────────────
 * Kural şüphede kaldığında "uyku değil" der. İki hatanın bedeli eşit değil:
 *   · yanlış NEGATİF → kullanıcı alışkanlığı elle işaretler (küçük zahmet)
 *   · yanlış POZİTİF → uygulama yapılmamış bir işi yapılmış yazar (veri yalanı)
 * İkincisi seriyi, momentumu ve haftalık özeti bozar; birincisi bir dokunuş eder.
 *
 * EMOJİ TEK BAŞINA YETMEZ. 😴 hem "uyku" hem "yorgunluk/dinlenme" için kullanılıyor;
 * bir süsleme, bir sözleşme değil. Emoji ancak metin de destekliyorsa anlam taşır.
 */

export type SleepHabitInput = {
  name?: string | null;
  nameTr?: string | null;
  nameEn?: string | null;
  emoji?: string | null;
  healthMetric?: 'sleep' | null;
};

/** Uykunun kendisini adlandıran kelimeler. */
const SLEEP_WORD = /uyku|sleep/i;

/**
 * BİLEŞİK ad işaretleri — "uyku + aktif dinlenme" gibi çok bileşenli alışkanlıklar.
 *
 * ':' de bileşik sayılır çünkü iki parçalı bir ad kurar ("Toparlanma: uyku + …") ve
 * baştaki parça konuyu belirler; uyku ikinci parçadaysa konu uyku değildir.
 */
const COMPOSITE = /\+|:|\s(?:ve|ile|and|with)\s|&|,/i;

/** Uyku alışkanlığı mı? Tek doğru cevap — kayıt ve senkron aynı fonksiyonu kullanır. */
export function isSleepHabit(h: SleepHabitInput): boolean {
  if (h.healthMetric === 'sleep') return true;
  return inferSleepFromNames(h);
}

/**
 * Adlardan çıkarım — açık damga YOKKEN kullanılır.
 *
 * Kayıt anında (`addHabit`) damgayı BU üretir; okuma anında ise yalnız damgasız eski
 * kayıtlar için devreye girer. İkisinin aynı fonksiyon olması şart: ayrı olduklarında
 * bir alışkanlık kaydedilirken uyku sayılıp okunurken sayılmayabilir.
 */
export function inferSleepFromNames(h: SleepHabitInput): boolean {
  const candidates = [h.name, h.nameTr, h.nameEn].filter((n): n is string => !!n && n.trim().length > 0);
  if (candidates.length === 0) return false;

  // Adlardan HERHANGİ BİRİ uykuyu konu ediniyorsa yeter: kullanıcının dili değiştiğinde
  // görünen ad değişir ama alışkanlık aynı alışkanlıktır.
  return candidates.some(raw => {
    const identity = compactHabitLabel(raw);
    if (!identity) return false;
    if (COMPOSITE.test(identity)) return false;
    return SLEEP_WORD.test(identity);
  });
}
