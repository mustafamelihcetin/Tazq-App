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
  // Belki Bir Gün — TAZQZen'in rafa kaldırdığı görevler (bkz. SOMEDAY_TAG).
  someday:   { tr: 'belki bir gün', en: 'someday' },
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
  'önemli':      { tr: 'önemli',     en: 'important'   },
  'important':   { tr: 'önemli',     en: 'important'   },
  'ev':          { tr: 'ev',         en: 'home'        },
  'home':        { tr: 'ev',         en: 'home'        },
  'tasarruf':    { tr: 'tasarruf',   en: 'savings'     },
  'savings':     { tr: 'tasarruf',   en: 'savings'     },
  'bırakma':     { tr: 'bırakma',    en: 'quit'        },
  'quit':        { tr: 'bırakma',    en: 'quit'        },
  'tez':         { tr: 'tez',        en: 'thesis'      },
  'thesis':      { tr: 'tez',        en: 'thesis'      },
  'mülakat':     { tr: 'mülakat',    en: 'interview'   },
  'interview':   { tr: 'mülakat',    en: 'interview'   },
  'yks':         { tr: 'yks',        en: 'yks'         },
  'kpss':        { tr: 'kpss',       en: 'kpss'        },
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



/**
 * BELKİ BİR GÜN — tarihi bilerek kaldırılmış, rafa alınmış görev.
 *
 * ── NEDEN BİR ETİKET ───────────────────────────────────────────────────────────
 * TAZQZen eski ve sığmayan işleri "Belki Bir Gün"e alıyor. Bu kavram veri modelinde
 * YOKTU: tarih yalnız `null` yapılıyordu. Oysa tarihsiz görev uygulamada "her zaman
 * görünür birikim" demek — ana ekran onu BUGÜNÜN listesinde gösteriyor. Yani rafa
 * kaldırılan iş, kullanıcının önünden hiç çekilmiyordu; "Belki Bir Gün'e alındı"
 * mesajı karşılığı olmayan bir sözdü.
 *
 * Etiket sunucuda zaten saklanan bir alan: yeni bir sütun, göç ya da API değişikliği
 * gerekmiyor. Kural üç satır:
 *   · rafa alınan görev: tarih yok + bu etiket
 *   · ana ekranın bugün listesi onu göstermez; Aksiyon Merkezi gösterir (etiket
 *     "belki bir gün" diye okunur, kullanıcı neden tarihsiz olduğunu bilir)
 *   · göreve yeniden bir TARİH verildiği an etiket kendiliğinden düşer
 *     (bkz. withSomedayResolved) — elle temizlik gerektirmez.
 */
export const SOMEDAY_TAG = 'someday';

/** Görev "Belki Bir Gün"de mi? */
export function isSomeday(task: { tags?: string[] | null } | null | undefined): boolean {
  return !!task?.tags?.includes(SOMEDAY_TAG);
}

/**
 * Tarih verilen görevden "Belki Bir Gün" etiketini düşürür.
 *
 * Rafa alınmış bir görev yeniden planlandığında hâlâ "belki bir gün" diye etiketli
 * kalsaydı, hem bugünün listesinden gizlenir hem de tarihi olan bir işe "belki"
 * denirdi. Tarihin kendisi etiketin anlamını geçersiz kılıyor.
 */
export function withSomedayResolved(
  tags: string[] | null | undefined,
  dueDate: string | null | undefined,
): string[] {
  const list = tags ?? [];
  const hasDate = !!dueDate && !String(dueDate).startsWith('0001');
  return hasDate ? list.filter((t) => t !== SOMEDAY_TAG) : list;
}
