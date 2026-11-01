/**
 * Günün değerlendirmesinin (1–5) kayıt anahtarı — yazan (mod bandı) ve okuyan (ana sayfa
 * momentumu) AYNI fonksiyonu kullanır.
 *
 * Yuva anahtarda kalır: exam/exam2/exam3 ayrı değerlendirilir. YKS/KPSS otomatik modları
 * Hedefler ekranında `exam` yuvasında açılır; ana sayfa ise mod tipini (`yks`/`kpss`)
 * biliyor — ikisi burada aynı kayda bağlanır.
 */
export function dayRatingKey(slotOrType: string, dayKey: string): string {
  const slot = slotOrType === 'yks' || slotOrType === 'kpss' ? 'exam' : slotOrType;
  return `tazq_eval_${slot}_${dayKey}`;
}
