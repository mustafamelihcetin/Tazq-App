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
  'yks', 'kpss', 'exam', 'tez', 'mulakat', 'spor',
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

const TAG_TRANSLATIONS: Record<string, { tr: string; en: string }> = {
  // Core tag IDs
  work:      { tr: 'iş',        en: 'work'        },
  health:    { tr: 'sağlık',    en: 'health'      },
  shopping:  { tr: 'alışveriş', en: 'shopping'    },
  finance:   { tr: 'finans',    en: 'finance'     },
  social:    { tr: 'sosyal',    en: 'social'      },
  education: { tr: 'eğitim',    en: 'education'   },
  urgent:    { tr: 'acil',      en: 'urgent'      },
  personal:  { tr: 'kişisel',   en: 'personal'    },

  // Reverse mapping for Turkish keyword labels
  'iş':        { tr: 'iş',        en: 'work'        },
  'sağlık':    { tr: 'sağlık',    en: 'health'      },
  'alışveriş': { tr: 'alışveriş', en: 'shopping'    },
  'finans':    { tr: 'finans',    en: 'finance'     },
  'sosyal':    { tr: 'sosyal',    en: 'social'      },
  'eğitim':    { tr: 'eğitim',    en: 'education'   },
  'acil':      { tr: 'acil',      en: 'urgent'      },
  'kişisel':   { tr: 'kişisel',   en: 'personal'    },

  // Specific keywords
  'toplantı':    { tr: 'toplantı',   en: 'meeting'     },
  'meeting':     { tr: 'toplantı',   en: 'meeting'     },
  'geliştirme':  { tr: 'geliştirme', en: 'dev'         },
  'dev':         { tr: 'geliştirme', en: 'dev'         },
  'sınav':       { tr: 'sınav',      en: 'exam'        },
  'exam':        { tr: 'sınav',      en: 'exam'        },
  'ödev':        { tr: 'ödev',       en: 'homework'    },
  'homework':    { tr: 'ödev',       en: 'homework'    },
  'spor':        { tr: 'spor',       en: 'fitness'     },
  'fitness':     { tr: 'spor',       en: 'fitness'     },
  'randevu':     { tr: 'randevu',    en: 'appointment' },
  'appointment': { tr: 'randevu',    en: 'appointment' },
  'study':       { tr: 'eğitim',     en: 'education'   },
  'ramazan':     { tr: 'ramazan',    en: 'ramadan'     },
  'ramadan':     { tr: 'ramazan',    en: 'ramadan'     },
};

export function translateTag(tag: string, lang: 'tr' | 'en'): string {
  if (!tag) return '';
  const normalized = tag.trim().toLowerCase();
  const match = TAG_TRANSLATIONS[normalized];
  if (match) {
    return lang === 'tr' ? match.tr : match.en;
  }
  return tag; // Return original as fallback
}

