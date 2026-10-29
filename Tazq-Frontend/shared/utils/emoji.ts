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

/**
 * Metnin HER YERİNDEKİ renkli emojileri gösterim için ayıklar (madde 2).
 * Önceden modlar, mod özeti ve modeHelpers'ta üç ayrı kopyası vardı; o kopyalar
 * ✓ ➔ ★ gibi tipografik işaretleri de siliyordu.
 *
 * Neden gösterimde: modların eskiden ürettiği görev başlıkları kullanıcı verisinde
 * emojiyle kayıtlı ("💪 Güç & Kas"). Veriyi toplu yeniden yazmak geri dönüşsüz ve
 * sunucuya dokunuyor; ekrana çizmemek aynı sonucu risksiz verir. Yeni üretilen
 * metinlerde zaten emoji yok.
 *
 * Tipografik işaretler emoji değildir, korunur: her platformda aynı çizilir ve yazı
 * rengini alır (✓ ✦ ➔ ★ ✔ — kullanıcı kararı 2026-10-29).
 *
 * Yalnız emojiden oluşan metin (ör. kullanıcı bir alışkanlığa yalnız "💧" yazdıysa)
 * DOKUNULMADAN döner: boş başlık, emojili başlıktan kötüdür.
 */
const KEEP = new Set(['✓', '✔', '✦', '➔', '★', '☆', '→', '←']);
// Extended_Pictographic: emoji tabanları; FE0F/FE0E: sunum seçicileri; 200D: ZWJ;
// 1F1E6–1F1FF: bayrak harfleri; 1F3FB–1F3FF: ten rengi; 20E3: tuş kapağı.
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}️︎‍⃣]/gu;

export function stripEmoji(text: string): string {
  if (!text) return '';
  const out = text
    .replace(EMOJI, (ch) => (KEEP.has(ch) ? ch : ' '))
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out || text;
}
