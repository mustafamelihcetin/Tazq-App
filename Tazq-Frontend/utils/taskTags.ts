/**
 * Görev etiketleri — gösterim politikası (tek kaynak).
 *
 * Görev `tags` alanı iki amaca hizmet ediyor:
 *  1. İçsel kontrol etiketleri (plan motoru, adaptasyon, mod tipi) — UI'da GÖSTERİLMEZ.
 *  2. Kullanıcıya anlamlı etiketler (kategori, hatırlatıcı vb.).
 *
 * Daha önce #weight_entry, #kilo_adapt gibi içsel/İngilizce teknik etiketler
 * son kullanıcıya sızıyordu. Bu modül neyin gizleneceğini tek yerden belirler.
 */

// İkon olarak gösterilen, metin chip'i olarak tekrar GÖSTERİLMEYEN etiketler
export const ICON_TAGS = ['hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note', 'weight_entry'];

// Plan/mod/sistem etiketleri — kullanıcıya hiçbir biçimde gösterilmez
const SYSTEM_TAGS = new Set<string>([
  // mod tipleri
  'ramazan', 'yks', 'kpss', 'exam', 'tez', 'mulakat', 'spor',
  // günlük plan motoru türleri
  'kilo', 'maraton', 'guc', 'genel', 'daily',
  // taslak/yer tutucu
  'draft',
]);

/**
 * İçsel (kullanıcıya gösterilmeyecek) etiket mi?
 * - Bilinen sistem/mod etiketleri, veya
 * - snake_case teknik etiketler (kilo_adapt, weight_entry, sinav_week, maraton_taper ...).
 *   Tüm adaptasyon/sistem etiketleri snake_case; kullanıcı etiketleri tek kelimedir.
 */
export function isInternalTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  if (!t) return true;
  if (SYSTEM_TAGS.has(t)) return true;
  if (t.includes('_')) return true;
  return false;
}

/** Görevde kullanıcıya gösterilecek metin etiketleri (içsel + ikon etiketleri elenir). */
export function visibleTextTags(tags?: string[] | null): string[] {
  return (tags ?? []).filter(tag => !isInternalTag(tag) && !ICON_TAGS.includes(tag));
}
