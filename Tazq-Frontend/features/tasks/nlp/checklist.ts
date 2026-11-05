/*
  KONTROL LİSTELİ GÖREV (2026-11-05). Ayrı bir alışveriş bölümü yerine: "süt, yumurta, ekmek al" tek görev + işaretlenebilir
  maddeler olur. Dar kural: en az 3 kısa madde VE alım fiili ya da "market:" gibi önek. "Ali, Ayşe, Veli ile toplantı" gibi
  virgüllü cümleler bozulmaz.
*/
export interface ChecklistDraft { title: string; items: string[] }

const PREFIX = /^(market|alışveriş|alisveris|shopping|groceries|grocery)\s*(listesi|list)?\s*:\s*/iu;
const VERB = /\s+(al|alınacak|alinacak|alacağım|alacagim|lazım|lazim|buy|get)[.!]?$/iu;
const TITLES = { tr: 'Alışveriş', en: 'Shopping' };

export function parseChecklist(text: string, lang: 'tr' | 'en'): ChecklistDraft | null {
  const src = text.trim();
  const hasPrefix = PREFIX.test(src);
  const body = src.replace(PREFIX, '');
  // Tarih cümlesi başta/sonda olabilir; alım fiili yalnız son maddeden sıyrılır.
  const hasVerb = VERB.test(body);
  if (!hasPrefix && !hasVerb) return null;
  const items = body.replace(VERB, '').split(/\s*,\s*|\s+ve\s+|\s+and\s+/iu).map(s => s.trim()).filter(Boolean);
  if (items.length < 3 || items.some(i => i.split(/\s+/).length > 3)) return null;
  return { title: TITLES[lang], items: items.map(i => i.charAt(0).toLocaleUpperCase(lang) + i.slice(1)) };
}
