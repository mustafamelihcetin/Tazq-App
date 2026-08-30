/**
 * Metnin BAŞINDAKİ emoji süsünü siler — tek doğru uygulama.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Aynı iş için kod tabanında ÜÇ ayrı uygulama vardı ve biri yanlıştı:
 *
 *   `/^[\p{Emoji}\s]+/u`  ← YANLIŞ
 *
 * Unicode'da `Emoji=Yes` özelliği rakamları (0-9), '#' ve '*' karakterlerini de
 * kapsar — çünkü bunlar tuş-takımı emojilerinin (1️⃣, #️⃣) taban karakteridir.
 * Sonuç, node ile doğrulandı:
 *
 *   '5K Koşu Programı'.replace(/^[\p{Emoji}\s]+/u, '')  →  'K Koşu Programı'
 *
 * Yani spor hedefini "5K Koşusu" ya da "10K hazırlık" yazan kullanıcının adının ilk
 * karakteri mod başlığında, mod özetinde ve plan önizlemesinde yeniyordu.
 *
 * DOĞRUSU `\p{Extended_Pictographic}`: yalnız resimsel karakterleri kapsar, rakamları
 * kapsamaz. Yanına eklenen ikisi emojinin parçalarıdır ve tek başlarına bu sınıfa
 * girmezler: U+FE0F (varyasyon seçici — renkli çizim isteği) ve U+200D (zero-width
 * joiner — birleşik emojileri bağlar, ör. 👨‍👩‍👧).
 *
 * NEDEN TEK YER: üç kopyadan biri düzeltildiğinde diğer ikisi geride kalmıştı. Aynı
 * soruyu üç ayrı yerde cevaplamak, ikisinin yanlış olmasının en kolay yolu.
 */
const LEADING_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;

/**
 * Baştaki emoji ve boşlukları atar. Geriye anlamlı bir şey kalmazsa girdiyi
 * OLDUĞU GİBİ döndürür — adı tamamen emojiden ibaret olan bir kaydı boşa çevirmek,
 * kullanıcının verisini silmektir.
 */
export function stripLeadingEmoji(value?: string | null): string {
  const raw = value ?? '';
  return raw.replace(LEADING_EMOJI, '').trim() || raw;
}
