import { toDateKey } from '@/shared/utils/dateKey';
import { CATEGORY_TAGS, LEXICON, type CategoryId } from './lexicon';
import { matchesEn, matchesTr, NOMINAL_SUFFIXES } from './morph';

/**
 * ANLAMA MOTORU — "yarın 15:00 toplantı" → tarih, saat, etiket.
 *
 * Sıfır maliyet, cihazda, ağsız ve DETERMİNİSTİK: aynı cümle her zaman aynı sonucu
 * verir, her sonuç test edilebilir. Kural seti bu dosyada okunabilir hâlde durur;
 * sözlük ayrı (lexicon.ts), Türkçe ek bilgisi ayrı (morph.ts).
 *
 * ── ÜÇ İLKE ───────────────────────────────────────────────────────────────────
 *  1. HER KELİME TEK ANLAMA GİDER. Çıkarıcılar sırayla çalışır ve kullandıkları
 *     metni "tüketir": "3 gün sonra" tarihe ait olduğu için içindeki "sonra"
 *     artık "düşük öncelik" sayılmaz; "her ayın 15'i" tekrara ait olduğu için
 *     "15" saat sayılmaz. Eski ayrıştırıcıda her kural bütün metne bakıyordu.
 *  2. YALNIZ AÇIK KANIT. Öncelik yalnız söylenirse değişir ("acil", "acelesi
 *     yok"); konudan tahmin EDİLMEZ (eskiden "toplantı" → düşük öncelik).
 *     Etiket en fazla BİR kategori: sözlükte kelimesi olan, cümlede ilk geçen.
 *  3. BELİRSİZSE DOKUNMA. Para ("12.50 TL") saat değildir; "pazara git" pazar
 *     günü değildir; "acil değil" acil değildir.
 *
 * Saat kuralı (belirsiz saat): dönem sözcüğü yoksa 1–6 arası saat ÖĞLEDEN SONRA
 * sayılır ("3'te toplantı" → 15:00) — takvim uygulamalarının yerleşik kuralı.
 * "05:30" gibi başında sıfır olan yazım ve "sabah 6" olduğu gibi kalır.
 */

export type Lang = 'tr' | 'en';
export type NlpPriority = 'Low' | 'Medium' | 'High';
export type NlpRecurrence = 'None' | 'Daily' | 'Weekly' | 'Monthly';

export interface Fact {
  kind: 'recurrence' | 'date' | 'time' | 'priority' | 'reminder' | 'note' | 'category';
  /** Kanıt: normalize edilmiş metinde bu sonucu doğuran kısım. */
  text: string;
}

export interface Understanding {
  lang: Lang;
  dueDate?: string;
  dueTime?: string;
  recurrence?: NlpRecurrence;
  recurrenceDay?: number;
  priority?: NlpPriority;
  category?: CategoryId;
  reminder: boolean;
  note: boolean;
  facts: Fact[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Metin
// ─────────────────────────────────────────────────────────────────────────────

/** Türkçe kuralıyla küçük harf: İ → i, (Türkçede) I → ı. Uzunluk korunur. */
export function normalize(text: string, lang: Lang): string {
  const s = text.replace(/[’‘`´]/g, "'").replace(/İ/g, 'i');
  return (lang === 'tr' ? s.replace(/I/g, 'ı') : s).toLowerCase();
}

/** Dil verilmediyse metinden: Türkçe harf ya da Türkçeye özgü sık kelime. */
export function detectLang(text: string): Lang {
  if (/[ıİğĞüÜşŞöÖçÇ]/.test(text)) return 'tr';
  // "her" bilerek YOK: İngilizcede de kelime ("call her").
  return /(^|[^\p{L}])(yarın|bugün|haftaya|için|ile|ve|saat|hatırlat\p{L}*)(?![\p{L}])/iu.test(text) ? 'tr' : 'en';
}

const W = '\\p{L}\\p{N}';
/** Gövdeyi kelime sınırlarıyla sarar. Grup 1 = önceki karakter (başlangıcı hesaplamak için). */
const rx = (body: string) => new RegExp(`(^|[^${W}])(?:${body})(?![${W}])`, 'gu');

interface Hit { start: number; end: number; g: string[] }

function scan(re: RegExp, s: string): Hit[] {
  const out: Hit[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push({ start: m.index + m[1].length, end: m.index + m[0].length, g: m.slice(2) });
    if (re.lastIndex === m.index) re.lastIndex += 1;
  }
  return out;
}

/** Tüketilmiş aralıklar — bir kelime iki çıkarıcıya birden kanıt olamaz. */
class Taken {
  private ranges: Array<[number, number]> = [];
  free(h: Hit) { return this.ranges.every(([a, b]) => h.end <= a || h.start >= b); }
  take(h: Hit) { this.ranges.push([h.start, h.end]); }
  /** Tüketilen yerleri boşlukla örter: sonraki çıkarıcılar onları göremez. */
  mask(s: string) {
    const c = s.split('');
    for (const [a, b] of this.ranges) for (let i = a; i < b; i++) c[i] = ' ';
    return c.join('');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sözcük tabloları
// ─────────────────────────────────────────────────────────────────────────────

const NUM: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1,
};
const NUM_TR = '\\d{1,3}|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on';
const NUM_EN = '\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten';
const toNum = (v: string) => (/^\d+$/.test(v) ? Math.min(parseInt(v, 10), 365) : NUM[v] ?? 1);

const WEEKDAY: Record<string, number> = {
  pazartesi: 1, salı: 2, çarşamba: 3, perşembe: 4, cumartesi: 6, cuma: 5, pazar: 0,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};
// Uzun ad önce: "cumartesi" "cuma"dan, "pazartesi" "pazar"dan önce denenir.
const WD = 'pazartesi|salı|çarşamba|perşembe|cumartesi|cuma|monday|tuesday|wednesday|thursday|friday|saturday|sunday';

const MONTH: Record<string, number> = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MO = Object.keys(MONTH).sort((a, b) => b.length - a.length).join('|');

/** Tarih/saat kelimesine gelebilecek ekler ("cumaya", "yarına", "15'te"). */
const DSFX = "(?:'?(?:ya|ye|a|e|da|de|ta|te|dan|den|tan|ten|ki|kü|ne|nde|nden|na|nda|ndan|ı|i|u|ü))?";
const ORD = '(?:st|nd|rd|th)?';

const UNIT_AFTER = /^\s*(tl|₺|lira|kuruş|krş|\$|usd|dolar|€|eur|euro|avro|kg|kilo|gr|gram|km|metre|mt|lt|litre|ml|adet|tane|sayfa|soru|dk|dakika|sn|saniye|%|puan|numara)(?![\p{L}])/u;
const CURRENCY_BEFORE = /(₺|\$|€)\s*$/;

// ─────────────────────────────────────────────────────────────────────────────
//  Tarih yardımcıları (hepsi YEREL takvim)
// ─────────────────────────────────────────────────────────────────────────────

const plus = (now: Date, days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
const plusMonths = (now: Date, n: number) => new Date(now.getFullYear(), now.getMonth() + n, now.getDate());

/** Bugünden itibaren o haftanın günü (bugün dahil ya da hariç). */
function upcoming(now: Date, wd: number, includeToday: boolean) {
  const diff = (wd - now.getDay() + 7) % 7;
  return plus(now, diff === 0 && !includeToday ? 7 : diff);
}

/** GELECEK takvim haftasındaki gün (hafta pazartesi başlar): "haftaya cuma". */
function inNextWeek(now: Date, wd: number) {
  const toMonday = 7 - ((now.getDay() + 6) % 7);
  return plus(now, toMonday + ((wd + 6) % 7));
}

/** Gün/ay (yıl verilmediyse ve geçmişse gelecek yıl). Geçersiz tarih → null. */
function calendarDate(now: Date, d: number, m: number, y?: number): Date | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const year = y ?? now.getFullYear();
  if (d > new Date(year, m, 0).getDate()) return null;
  const date = new Date(year, m - 1, d);
  if (y == null && date < plus(now, 0)) return new Date(year + 1, m - 1, d);
  return date;
}

/** Ayın n'inci günü: bu ay geçtiyse gelecek ay; ay kısaysa son güne çekilir. */
function monthDay(now: Date, n: number) {
  const clamp = (y: number, m: number) => new Date(y, m, Math.min(n, new Date(y, m + 1, 0).getDate()));
  const thisMonth = clamp(now.getFullYear(), now.getMonth());
  return thisMonth < plus(now, 0) ? clamp(now.getFullYear(), now.getMonth() + 1) : thisMonth;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Çıkarıcılar
// ─────────────────────────────────────────────────────────────────────────────

interface Candidate<T> { hit: Hit; value: T }

/** Adaylardan metinde İLK geçeni seçer; hepsini tüketir (kelimeler başka anlama gitmesin). */
function pick<T>(cands: Candidate<T>[], taken: Taken): Candidate<T> | undefined {
  // Aynı yerde başlayan adaylardan UZUN olan: "yarından sonra" > "yarından".
  const free = cands.filter((c) => taken.free(c.hit))
    .sort((a, b) => a.hit.start - b.hit.start || (b.hit.end - b.hit.start) - (a.hit.end - a.hit.start));
  const chosen: Candidate<T>[] = [];
  for (const c of free) if (chosen.every((x) => c.hit.end <= x.hit.start || c.hit.start >= x.hit.end)) chosen.push(c);
  chosen.forEach((c) => taken.take(c.hit));
  return chosen[0];
}

type Rec = { recurrence: NlpRecurrence; day?: number; date?: Date };

function recurrences(s: string, now: Date): Candidate<Rec>[] {
  const c: Candidate<Rec>[] = [];
  const add = (re: RegExp, f: (g: string[]) => Rec) => scan(re, s).forEach((hit) => c.push({ hit, value: f(hit.g) }));
  // Aralık ("iki günde bir"): zinciri başlıktan tamamlanınca kurulur (bkz. recurrenceInterval) —
  // burada yalnız görev BUGÜNE yazılır ve kelimeler başka anlama gitmesin diye tüketilir.
  add(rx(`(?:her\\s+)?(?:${NUM_TR})\\s+(?:günde|haftada|ayda)\\s+bir`), () => ({ recurrence: 'None', date: now }));
  add(rx(`every\\s+(?:${NUM_EN})\\s+(?:days|weeks|months)|every\\s+other\\s+day|gün\\s+aşırı`), () => ({ recurrence: 'None', date: now }));
  add(rx(`her\\s+ayın\\s+(\\d{1,2})(?:'?\\p{L}+)?`), (g) => ({ recurrence: 'Monthly', date: monthDay(now, +g[0]) }));
  add(rx(`every\\s+month\\s+on\\s+the\\s+(\\d{1,2})${ORD}|(\\d{1,2})${ORD}\\s+of\\s+every\\s+month|every\\s+(\\d{1,2})${ORD}\\s+of\\s+the\\s+month`),
    (g) => ({ recurrence: 'Monthly', date: monthDay(now, +(g[0] ?? g[1] ?? g[2])) }));
  add(rx(`(?:her|every|each)\\s+(${WD}|pazar)s?`), (g) => {
    const day = WEEKDAY[g[0]];
    return { recurrence: 'Weekly', day, date: upcoming(now, day, true) };
  });
  add(rx('her\\s+gün|her\\s+sabah|her\\s+akşam|her\\s+gece|günlük|daily|every\\s*day|every\\s+morning|every\\s+evening|every\\s+night'), () => ({ recurrence: 'Daily' }));
  add(rx('her\\s+hafta|haftalık|weekly|every\\s+week'), () => ({ recurrence: 'Weekly' }));
  add(rx('her\\s+ay|aylık|monthly|every\\s+month'), () => ({ recurrence: 'Monthly' }));
  return c;
}

function dates(s: string, now: Date): Candidate<Date | null>[] {
  const c: Candidate<Date | null>[] = [];
  const add = (re: RegExp, f: (g: string[]) => Date | null) => scan(re, s).forEach((hit) => c.push({ hit, value: f(hit.g) }));
  add(rx('(\\d{4})-(\\d{2})-(\\d{2})'), (g) => calendarDate(now, +g[2], +g[1], +g[0]));
  add(rx('(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?'), (g) => calendarDate(now, +g[0], +g[1], g[2] ? +(g[2].length === 2 ? `20${g[2]}` : g[2]) : undefined));
  add(rx('(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})'), (g) => calendarDate(now, +g[0], +g[1], +g[2]));
  add(rx(`(\\d{1,2})${ORD}\\s+(${MO})${DSFX}(?:\\s+(\\d{4}))?`), (g) => calendarDate(now, +g[0], MONTH[g[1]], g[2] ? +g[2] : undefined));
  add(rx(`(${MO})\\s+(\\d{1,2})${ORD}(?:,?\\s+(\\d{4}))?`), (g) => calendarDate(now, +g[1], MONTH[g[0]], g[2] ? +g[2] : undefined));
  add(rx(`öbür\\s+gün${DSFX}|yarından\\s+sonra|day\\s+after\\s+tomorrow`), () => plus(now, 2));
  add(rx(`(${NUM_TR})\\s+(gün|hafta|ay)\\s+sonra${DSFX}`), (g) => {
    const n = toNum(g[0]);
    return g[1] === 'ay' ? plusMonths(now, n) : plus(now, g[1] === 'hafta' ? n * 7 : n);
  });
  add(rx(`in\\s+(${NUM_EN}|a|an)\\s+(days?|weeks?|months?)`), (g) => {
    const n = toNum(g[0]);
    return g[1].startsWith('month') ? plusMonths(now, n) : plus(now, g[1].startsWith('week') ? n * 7 : n);
  });
  add(rx(`(?:haftaya|gelecek\\s+hafta(?:ya)?|next\\s+week)(?:\\s+(${WD}|pazar)${DSFX})?`),
    (g) => (g[0] ? inNextWeek(now, WEEKDAY[g[0]]) : plus(now, 7)));
  add(rx(`(?:gelecek|önümüzdeki|next)\\s+(${WD}|pazar)${DSFX}`), (g) => upcoming(now, WEEKDAY[g[0]], false));
  add(rx(`(?:bu|this)\\s+(${WD}|pazar)${DSFX}`), (g) => upcoming(now, WEEKDAY[g[0]], true));
  // "bu akşam 8'de": yalnız "bu" tüketilir, "akşam" saate kalır (→ 20:00).
  add(rx(`bugün${DSFX}|today|tonight|bu(?=\\s+(?:akşam|gece|sabah))|this(?=\\s+(?:evening|morning))`), () => plus(now, 0));
  add(rx(`yarın${DSFX}|tomorrow`), () => plus(now, 1));
  add(rx(`(${WD})(?:\\s+günü)?${DSFX}`), (g) => upcoming(now, WEEKDAY[g[0]], true));
  // "pazar" aynı zamanda PAZAR YERİ: "pazara git", "pazardan al" bir tarih değil.
  // Yalnız çekimsiz ya da "pazar günü" biçimi gün sayılır.
  add(rx('pazar(?:\\s+günü' + DSFX + ')?'), () => upcoming(now, 0, true));
  return c;
}

type Clock = { h: number; m: number };

function toClock(rawH: string, rawM: string | undefined, period: string | undefined): Clock | null {
  let h = +rawH;
  const m = rawM ? +rawM : 0;
  if (h > 23 || m > 59) return null;
  switch (period) {
    case 'sabah': if (h > 12) return null; if (h === 12) h = 0; break;
    case 'öğle': case 'öğlen': if (h <= 6) h += 12; break;
    case 'akşam': case 'pm': case 'p.m.': if (h < 12) h += 12; else if (period === 'akşam' && h === 12) h = 0; break;
    case 'gece': if (h >= 6 && h < 12) h += 12; else if (h === 12) h = 0; break;
    case 'am': case 'a.m.': if (h > 12) return null; if (h === 12) h = 0; break;
    default:
      if (period?.startsWith('öğleden')) { if (h < 12) h += 12; break; }
      // Dönem yok: 1–6 öğleden sonra ("3'te" → 15:00); "05:30" gibi sıfırlı yazım olduğu gibi.
      if (h >= 1 && h <= 6 && !rawH.startsWith('0')) h += 12;
  }
  return { h, m };
}

function times(s: string, lang: Lang): Candidate<Clock | null>[] {
  const c: Candidate<Clock | null>[] = [];
  const guarded = (hit: Hit) => UNIT_AFTER.test(s.slice(hit.end)) || CURRENCY_BEFORE.test(s.slice(0, hit.start))
    || /^[.:/]\d/.test(s.slice(hit.end));
  const add = (re: RegExp, f: (g: string[]) => Clock | null) => scan(re, s).forEach((hit) => {
    if (!guarded(hit)) c.push({ hit, value: f(hit.g) });
  });
  const TSFX = "(?:'?(?:de|da|te|ta|e|a|ye|ya|den|dan|ten|tan|ki|deki|daki|teki|taki))?";
  add(rx(`(sabah|öğleden\\s+sonra|öğlen|öğle|akşam|gece)\\s+(?:saat\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?${TSFX}`),
    (g) => toClock(g[1], g[2], g[0].replace(/\s+/g, ' ')));
  add(rx('(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)'), (g) => toClock(g[0], g[1], g[2]));
  add(rx(`saat\\s+(\\d{1,2})(?:[:.](\\d{2}))?${TSFX}`), (g) => toClock(g[0], g[1], undefined));
  add(rx(`(\\d{1,2})[:.](\\d{2})${TSFX}`), (g) => toClock(g[0], g[1], undefined));
  add(rx("(\\d{1,2})'?(?:de|da|te|ta)"), (g) => toClock(g[0], undefined, undefined));
  // "at 9" yalnız İngilizcede: Türkçede "at" bir fiil ("çöpü at 3 kere").
  if (lang === 'en') add(rx('at\\s+(\\d{1,2})(?::(\\d{2}))?'), (g) => toClock(g[0], g[1], undefined));
  add(rx(`öğlen${TSFX}|noon`), () => ({ h: 12, m: 0 }));
  return c;
}

const HIGH = 'acil(?:en)?|hemen|ivedi(?:en)?|kritik|önemli|mühim|en\\s+kısa\\s+sürede|asap|urgent(?:ly)?|important|critical|high\\s+priority|top\\s+priority';
const LOW = 'acelesi\\s+yok|önemsiz|boş\\s+vakit(?:te|imde|inde)|müsait\\s+olunca|bir\\s+ara|fırsat\\s+bulunca|daha\\s+sonra|sonra|later|whenever|no\\s+rush|low\\s+priority';

function priority(s: string): { value: NlpPriority; text: string } | undefined {
  let high: string | undefined;
  let low: string | undefined;
  for (const h of scan(rx(`(${HIGH})`), s)) {
    // Olumsuzluk: "acil değil", "not urgent" → acil DEĞİL, acelesi yok.
    const negated = /^\s+değil/.test(s.slice(h.end)) || /(^|[^\p{L}])not\s+$/u.test(s.slice(0, h.start));
    if (negated) low ??= s.slice(h.start, h.end);
    else high ??= s.slice(h.start, h.end);
  }
  if (/!{2,}/.test(s)) high ??= '!!';
  for (const h of scan(rx(`(${LOW})`), s)) {
    // "yemekten sonra", "işten sonra": zaman bildirir, öncelik değil.
    if (/^(sonra|later)$/.test(h.g[0]) && /(dan|den|tan|ten)\s+$/.test(s.slice(0, h.start))) continue;
    low ??= s.slice(h.start, h.end);
  }
  if (high) return { value: 'High', text: high };
  if (low) return { value: 'Low', text: low };
  return undefined;
}

/** Sözlükten ilk eşleşen kategori (metinde ilk geçen kelime kazanır). */
function category(s: string): { value: CategoryId; text: string } | undefined {
  let best: { value: CategoryId; text: string; at: number } | undefined;
  const offer = (value: CategoryId, text: string, at: number) => { if (!best || at < best.at) best = { value, text, at }; };

  const tokens = [...s.matchAll(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu)];
  for (const [id, entry] of Object.entries(LEXICON) as [CategoryId, typeof LEXICON[CategoryId]][]) {
    for (const t of tokens) {
      const w = t[0];
      if (entry.except?.some((x) => w.startsWith(x))) continue;
      // İngilizce kökler Türkçe normalize edilmiş metinde de tanınsın ("INVOICE" → "ınvoıce").
      const wEn = w.replace(/ı/g, 'i');
      if (entry.exact?.includes(w) || entry.tr.some((l) => matchesTr(w, l)) || entry.en.some((l) => matchesEn(wEn, l))) {
        offer(id, w, t.index ?? 0);
        break;
      }
    }
    for (const phrase of entry.phrases ?? []) {
      // Sözlük ifadeleri harf, boşluk ve tireden ibaret; tire sınıf dışında düz karakterdir.
      const body = phrase.split(/\s+/).join('\\s+');
      for (const h of scan(new RegExp(`(^|[^${W}])${body}('?[\\p{L}]*)(?![${W}])`, 'gu'), s)) {
        const suffix = (h.g[0] ?? '').replace("'", '');
        if (NOMINAL_SUFFIXES.has(suffix)) { offer(id, s.slice(h.start, h.end), h.start); break; }
      }
    }
  }
  return best && { value: best.value, text: best.text };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Giriş noktası
// ─────────────────────────────────────────────────────────────────────────────

export function understand(text: string, preferredLang?: Lang, now: Date = new Date()): Understanding {
  const lang = preferredLang ?? detectLang(text);
  const s = normalize(text, lang);
  const out: Understanding = { lang, reminder: false, note: false, facts: [] };
  if (!s.trim()) return out;
  const taken = new Taken();
  const fact = (kind: Fact['kind'], h: Hit) => out.facts.push({ kind, text: s.slice(h.start, h.end) });

  // 1. Tekrar — önce: "her salı" bir tarih DEĞİL, bir tekrar.
  const rec = pick(recurrences(s, now), taken);
  if (rec) {
    out.recurrence = rec.value.recurrence;
    if (rec.value.day != null) out.recurrenceDay = rec.value.day;
    fact('recurrence', rec.hit);
  }

  // 2. Tarih — açık tarih tekrarın önerdiği tarihten üstündür.
  const date = pick(dates(s, now), taken);
  const due = date?.value ?? rec?.value.date ?? undefined;
  if (date?.value) fact('date', date.hit);
  if (due) out.dueDate = toDateKey(due);

  // 3. Saat
  const time = pick(times(s, lang), taken);
  if (time?.value) {
    const base = due ?? now;
    out.dueTime = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time.value.h, time.value.m).toISOString();
    fact('time', time.hit);
  }

  // Tarih/saat/tekrar kelimeleri artık görünmez: öncelik ve kategori onları okuyamaz.
  const rest = taken.mask(s);

  // 4. Öncelik
  const pr = priority(rest);
  if (pr) { out.priority = pr.value; out.facts.push({ kind: 'priority', text: pr.text }); }

  // 5. Hatırlatma niyeti ve not
  const rem = /(^|[^\p{L}])(hatırlat\p{L}*|unutturma\p{L}*|remind\p{L}*|alarm\p{L}*)/u.exec(rest);
  if (rem) { out.reminder = true; out.facts.push({ kind: 'reminder', text: rem[2] }); }
  if (/^\s*(not|bilgi|note)\s*:/.test(s)) { out.note = true; out.facts.push({ kind: 'note', text: 'not:' }); }

  // 6. Kategori
  const cat = category(rest);
  if (cat) { out.category = cat.value; out.facts.push({ kind: 'category', text: cat.text }); }

  return out;
}

/** Kategori → kaydedilecek etiket (arayüz dilinde). */
export const categoryTag = (id: CategoryId, lang: Lang) => CATEGORY_TAGS[id][lang];
