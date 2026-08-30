/**
 * Haftanın gün adları — indeks `Date.getDay()` ile AYNI (0 = Pazar … 6 = Cumartesi).
 *
 * NEDEN PAYLAŞILAN: aynı tablo kod tabanında üç ayrı biçimde duruyordu — biri
 * 'Mon'→'Pazartesi' sözlüğü (StatusHubModal), biri iki yönlü çeviri haritası
 * (systemTaskTranslator), biri de dizinin kendisi. Üçü de aynı yedi kelimeyi
 * tekrarlıyor ve biri düzeltildiğinde diğerleri geride kalıyordu.
 *
 * SIFIR = PAZAR, çünkü tüketiciler `Date.getDay()` sonucunu doğrudan indeksliyor.
 * Haftaya pazartesi başlayan GÖRÜNÜMLER (haftalık merkez) kendi sıralamasını kurar;
 * bu tablo bir takvim değil, ad karşılığıdır.
 */
export const WEEKDAY_NAMES = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

/** Gün numarasını (0-6) verilen dilde adlandırır. Aralık dışında boş string döner. */
export function weekdayName(day: number, lang: 'tr' | 'en'): string {
  return WEEKDAY_NAMES[lang][day] ?? '';
}
