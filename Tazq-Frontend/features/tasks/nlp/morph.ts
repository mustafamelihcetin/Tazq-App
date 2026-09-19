/**
 * TÜRKÇE BİÇİMBİLİM — "bu kelime, şu sözcüğün çekimli hâli mi?"
 *
 * ── ESKİ YAKLAŞIMIN KUSURU ────────────────────────────────────────────────────
 * Eski ayrıştırıcı iki kaba yol kullanıyordu ve ikisi de ölçülerek yanlış çıktı:
 *
 *  · KELİME İÇİNDE ARAMA (`includes`): "su" (su iç → sağlık) "SUnum hazırla"da,
 *    "ev" "EVrak"ta, "cuma" "CUMAartesi"de bulunuyordu.
 *  · KÖR KESME (son 1-3 harfi at): "kiraZ" → "kira" → finans; "koşuL" → "koşu" → spor.
 *
 * ── BURADAKİ KURAL ────────────────────────────────────────────────────────────
 * Kelime ya sözcüğün KENDİSİ ya da sözcük + GEÇERLİ bir Türkçe ek dizisidir. Ek dizisi
 * uydurulmuyor, sonlu bir kümeden seçiliyor: çoğul + iyelik + hâl eki. "kiraz"daki
 * "z" bir ek olmadığı için eşleşmez; "faturalarını" (fatura+lar+ı+nı) eşleşir.
 *
 * Sert ünsüz yumuşaması da tanınır: ilaç → ilaCı, kitap → kitaBı, köpek → köpeĞi.
 *
 * Küme bilerek GENİŞ (anlamsız birleşimler de içerir): eşleşme her zaman bir SÖZLÜK
 * sözcüğüne bağlı olduğu için fazladan ek yanlış pozitif üretmez. Üretebildiği tek
 * durum gerçek eş yazımlılardır ("süt+un" = "sütun") — onlar sözlükte adıyla
 * dışlanır (bkz. lexicon → except).
 */

const PLURAL = ['', 'lar', 'ler'];

const POSSESSIVE = [
  '', 'ı', 'i', 'u', 'ü', 'sı', 'si', 'su', 'sü', 'yı', 'yi', 'yu', 'yü',
  'm', 'ım', 'im', 'um', 'üm', 'mız', 'miz', 'muz', 'müz', 'ımız', 'imiz', 'umuz', 'ümüz',
  'n', 'ın', 'in', 'un', 'ün', 'nız', 'niz', 'nuz', 'nüz', 'ınız', 'iniz', 'unuz', 'ünüz',
  'ları', 'leri',
];

const CASE = [
  '', 'a', 'e', 'ya', 'ye', 'na', 'ne',
  'da', 'de', 'ta', 'te', 'nda', 'nde',
  'dan', 'den', 'tan', 'ten', 'ndan', 'nden',
  'la', 'le', 'yla', 'yle',
  'ı', 'i', 'u', 'ü', 'yı', 'yi', 'yu', 'yü', 'nı', 'ni', 'nu', 'nü',
  'ın', 'in', 'un', 'ün', 'nın', 'nin', 'nun', 'nün', 'yın', 'yin', 'yun', 'yün',
  'ki', 'daki', 'deki', 'taki', 'teki', 'ndaki', 'ndeki',
  'ca', 'ce', 'dır', 'dir', 'dur', 'dür', 'tır', 'tir', 'tur', 'tür',
];

/** Bir isim köküne gelebilecek bütün ek dizileri (boş dizi = kökün kendisi). */
export const NOMINAL_SUFFIXES: ReadonlySet<string> = new Set(
  PLURAL.flatMap((p) => POSSESSIVE.flatMap((x) => CASE.map((c) => p + x + c))),
);

const SOFTEN: Record<string, string> = { p: 'b', ç: 'c', t: 'd', k: 'ğ' };
const STARTS_WITH_VOWEL = /^[aeıioöuü]/;

/** Sert ünsüzle biten kökün ünlüyle başlayan ek önündeki yumuşak biçimi. */
function softened(lemma: string): string | null {
  if (lemma.length < 3) return null;
  if (lemma.endsWith('nk')) return `${lemma.slice(0, -1)}g`;
  const soft = SOFTEN[lemma[lemma.length - 1]];
  return soft ? lemma.slice(0, -1) + soft : null;
}

/** Türkçe: kelime, sözcüğün kendisi ya da geçerli bir çekimi mi? */
export function matchesTr(token: string, lemma: string): boolean {
  if (token === lemma) return true;
  // "gym'e", "kyk'ya": kesme işaretinden sonrası ek olmalı
  const apo = token.indexOf("'");
  if (apo > 0) return token.slice(0, apo) === lemma && NOMINAL_SUFFIXES.has(token.slice(apo + 1));
  if (token.startsWith(lemma) && NOMINAL_SUFFIXES.has(token.slice(lemma.length))) return true;
  const soft = softened(lemma);
  if (soft && token.startsWith(soft)) {
    const rest = token.slice(soft.length);
    return STARTS_WITH_VOWEL.test(rest) && NOMINAL_SUFFIXES.has(rest);
  }
  return false;
}

/** İngilizce: sözcüğün kendisi, çoğulu ya da iyelik biçimi. Türkçe ekli yazım da ("gym'e"). */
export function matchesEn(token: string, lemma: string): boolean {
  if (token === lemma || token === `${lemma}s` || token === `${lemma}es` || token === `${lemma}'s`) return true;
  const apo = token.indexOf("'");
  return apo > 0 && token.slice(0, apo) === lemma && NOMINAL_SUFFIXES.has(token.slice(apo + 1));
}
