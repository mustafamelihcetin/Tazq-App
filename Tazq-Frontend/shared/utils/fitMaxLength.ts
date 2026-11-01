/**
 * METİN ALANININ maxLength'i DEĞERDEN KISA OLAMAZ (2026-11-01, iPhone'da görüldü).
 *
 * Kayıtlı bir değer (eski sınırla yazılmış görev başlığı, plan üreticisinin uzun alışkanlık adı,
 * Google'dan gelen uzun ad) kendi sınırından kısa bir alana yüklenince iOS'un yerel metin alanı
 * uygulamayı KAPATTI. Sınır yeni yazımı keser; eski değeri asla kırpmaz. Kayıttaki asıl sınır
 * (sunucu, form) ayrıca uygulanır.
 */
export function fitMaxLength(limit: number, value: string | null | undefined): number {
  return Math.max(limit, value?.length ?? 0);
}
