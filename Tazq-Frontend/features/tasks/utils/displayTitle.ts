/**
 * Satırda GÖRÜNECEK başlık: alt satır mod adını zaten yazıyorsa, başlığın başındaki aynı ad düşer.
 *
 * Mod görevleri "${ad} — …" / "${ad}: …" diye üretiliyor (bkz. modes/utils/planAdaptations).
 * Satır tek satıra kısalınca işin kendisi hiç görünmüyordu (cihazda: "DenemeProje — Literatür
 * Taraması: y…"). Yalnız GÖRÜNTÜ içindir: veri ve ekran okuyucu etiketi tam başlığı taşır.
 *
 * Ön ek yalnız arkasından bir AYIRICI geliyorsa düşer — "DenemeProjesi için…" gibi adla başlayan
 * ama ayrı bir kelime olan başlıklara dokunulmaz. Geriye boş kalacaksa başlık aynen döner.
 * Kalan cümle büyük harfle başlar (cihazda "bu hafta ne tamamladın?" küçük harfle kalıyordu) —
 * uygulamanın diliyle: Türkçede i → İ, İngilizcede i → I.
 */
const SEPARATORS = [' — ', ' – ', ' - ', ': ', ' · '];
/** Büyük harf kuralının yereli (metin değil): Türkçede i → İ, İngilizcede i → I. */
const TR_LOCALE = 'tr-TR';
const EN_LOCALE = 'en-US';

export function titleWithoutLabel(title: string, label: string | null | undefined, tr = true): string {
  if (!label) return title;
  const head = title.slice(0, label.length);
  if (head.toLocaleLowerCase('tr') !== label.toLocaleLowerCase('tr')) return title;
  const rest = title.slice(label.length);
  const sep = SEPARATORS.find(s => rest.startsWith(s));
  if (!sep) return title;
  const out = rest.slice(sep.length).trim();
  if (!out) return title;
  return out.charAt(0).toLocaleUpperCase(tr ? TR_LOCALE : EN_LOCALE) + out.slice(1);
}
