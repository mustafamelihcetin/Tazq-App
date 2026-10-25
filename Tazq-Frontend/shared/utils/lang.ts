/** Uygulamanın desteklediği arayüz dilleri. */
export const SUPPORTED_LANGS = ['tr', 'en'] as const;

export type AppLang = (typeof SUPPORTED_LANGS)[number];

/**
 * Serbest bir dil değerini DESTEKLENEN bir koda indirger.
 *
 * NEDEN: dil bilgisi uygulamada `string` olarak dolaşıyor (store, prop, cihaz
 * ayarı) ama onu kullanan yardımcıların çoğu `'tr' | 'en'` bekliyor. Her çağrı
 * yerinde `language === 'tr' ? 'tr' : 'en'` yazılıyordu — aynı daraltma onlarca
 * kez, üstelik çeviri borcu sayaçlarını da kirleterek (bkz. i18nRatchet).
 *
 * Bu bir METİN seçimi değil, KOD normalleştirmesi: çevrilecek bir cümle yok.
 */
export function langOf(language: string | null | undefined): AppLang {
  return SUPPORTED_LANGS.includes(language as AppLang) ? (language as AppLang) : 'en';
}

/** Dil kodunun `Intl`/takvim yereli — `tr ? 'tr-TR' : 'en-US'` dallanması yerine (bkz. i18nRatchet). */
const LOCALES: Record<AppLang, string> = { tr: 'tr-TR', en: 'en-US' };
export function localeOf(language: string | null | undefined): string {
  return LOCALES[langOf(language)];
}
