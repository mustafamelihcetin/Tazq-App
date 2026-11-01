import { TASK_LIMITS } from '@/features/tasks/limits';
import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';
import type { HabitSchedule } from '@/features/habits/utils/habitSchedule';
import type { CategoryId } from './lexicon';
import { matchesEn, matchesTr } from './morph';
import { detectLang, normalize, understand, type Lang, type NlpPriority, type Understanding } from './understand';

/**
 * "AKLINDAKİLERİ YAZ" — serbest metinden görev, alışkanlık ve mod sinyali.
 *
 * Eski plan çıkarıcısı (shared/utils/planExtractor.ts) kelime İÇİNDE arıyordu: "okula git"
 * okuma alışkanlığı, "dilekçe yaz" yazı alışkanlığı oluyor; "pazartesi, çarşamba ve cuma
 * spor" üç ayrı göreve bölünüyordu. Bu dosya aynı işi Anlama Motoru'nun üstünde yapar ve
 * onun üç ilkesini taşır: her kelime tek anlama gider, yalnız açık kanıt, belirsizse dokunma.
 *
 * ── AKIŞ ──────────────────────────────────────────────────────────────────────
 *  1. BÖL: satır, madde işareti, cümle sonu, virgül. "ve/and" yalnız iki tarafta da en az
 *     iki kelime varsa böler ("araba ve ev temizliği" tek iş kalır).
 *  2. BİRLEŞTİR: kendi başına iş olmayan parça ("yarın", "pazartesi") sonrakine eklenir —
 *     "pazartesi, çarşamba ve cuma spor" tek parça olur.
 *  3. ANLA: her parça `understand()`dan geçer; üstüne gün listesi, "haftada 3 kez",
 *     "gün aşırı" ve "düzenli" ipuçları okunur.
 *  4. SINIFLA: yalnız açık tekrar kanıtı ALIŞKANLIK yapar; geri kalan her şey GÖREV.
 *     Konudan tahmin yok ("spor" tek başına görevdir) — önizlemede tek dokunuşla değişir.
 *  5. MOD: sınav/tez/mülakat/kilo/birikim/bırakma/ramazan sinyali. Parça yalnız bir durum
 *     bildiriyorsa ("sınavım 12 aralıkta") madde OLMAZ; tarihi moda gider.
 */

export type CaptureModeId = 'exam' | 'tez' | 'mulakat' | 'spor' | 'tasarruf' | 'birakma' | 'ramazan';

interface CapturedBase {
  title: string;
  /** Maddenin çıktığı ham parça. */
  source: string;
  /** Kararı doğuran kelimeler — önizlemede "neden böyle anladım" diye gösterilir. */
  evidence: string[];
}

export interface CapturedTask extends CapturedBase {
  kind: 'task';
  dueDate?: string;
  /** Yerel saat 'HH:MM' (gösterim için). */
  time?: string;
  /** Kayıt için ISO (understand ile aynı). */
  dueTime?: string;
  priority?: NlpPriority;
  /** Görevde yalnız aylık tekrar kalır: günlük/haftalık tekrar alışkanlıktır. */
  recurrence?: 'Monthly';
  category?: CategoryId;
}

export interface CapturedHabit extends CapturedBase {
  kind: 'habit';
  schedule: HabitSchedule;
  emoji: string | null;
}

export type CapturedItem = CapturedTask | CapturedHabit;

export interface ModeSignal {
  mode: CaptureModeId;
  /** Yalnız durum cümlesinden ("sınavım 12 aralıkta"); görev tarihi moda gitmez. */
  date?: string;
  evidence: string;
}

export interface CaptureResult {
  lang: Lang;
  items: CapturedItem[];
  modes: ModeSignal[];
  /** Madde sınırını (CAPTURE_LIMITS.items) aştığı için alınmayan madde sayısı. */
  dropped: number;
}

/**
 * SINIRLAR — tek yer (2026-11-01, kullanıcı: "mantıklı bir sınır olsun, ucu açık kalmasın").
 *  · inputChars 600 — yazı alanı (ekran da maxLength olarak kullanır)
 *  · items 12       — fazlası alınmaz; DÜŞEN sayı `dropped` ile bildirilir (sessiz değil)
 *  · taskTitle 100  — sunucunun sınırı (TaskDtoValidator); daha uzunu reddedilirdi
 *  · habitTitle 40  — alışkanlık formunun sınırı (NewHabitForm)
 * Başlıklar kelime sınırından kısalır.
 */
export const CAPTURE_LIMITS = { inputChars: 600, items: 12, taskTitle: TASK_LIMITS.title, habitTitle: 40 } as const;
export const CAPTURE_MAX_ITEMS = CAPTURE_LIMITS.items;

/** Başlığı kelime sınırından `max` karaktere kısaltır (kelime ortasından kesmez). */
export function clampTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.5 ? cut.slice(0, at) : title.slice(0, max)).replace(/[\s,;:.\-–—]+$/u, '');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sözcük tabloları
// ─────────────────────────────────────────────────────────────────────────────

const W = '\\p{L}\\p{N}';
const rx = (body: string) => new RegExp(`(^|[^${W}])(?:${body})(?![${W}])`, 'gu');

interface Span { a: number; b: number }
interface Hit extends Span { g: string[] }

function scan(re: RegExp, s: string): Hit[] {
  const out: Hit[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push({ a: m.index + m[1].length, b: m.index + m[0].length, g: m.slice(2) });
    if (re.lastIndex === m.index) re.lastIndex += 1;
  }
  return out;
}

/** 0 = Pazartesi (HabitSchedule ile aynı). */
const WEEKDAY: Record<string, number> = {
  pazartesi: 0, salı: 1, çarşamba: 2, perşembe: 3, cuma: 4, cumartesi: 5, pazar: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};
// Uzun ad önce ("cumartesi" > "cuma"). "pazar" yalnız çekimsiz/çoğul: "pazara git" gün değildir.
const WEEKDAY_LIST = rx('(pazartesi|salı|çarşamba|perşembe|cumartesi|cuma|pazar|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(s|ları|leri)?(\\s+günleri)?');

const NUM: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, once: 1, twice: 2,
};
const toNum = (v: string) => (/^\d+$/.test(v) ? parseInt(v, 10) : NUM[v] ?? 1);

const WEEKLY_TIMES = [
  rx('haftada\\s+(\\d|bir|iki|üç|dört|beş|altı)\\s+(?:gün|kez|kere|defa|sefer)'),
  rx('(\\d|one|two|three|four|five|six|once|twice)\\s*(?:times?\\s+)?(?:a|per)\\s+week'),
];

/** "düzenli", "rutin": tekrar kanıtı (her gün). */
const HABIT_CUE = rx('düzenli(?:\\s+olarak)?|rutin|alışkanlık\\p{L}*|regularly|routinely|as\\s+a\\s+habit');

interface SignalRule { mode: CaptureModeId; tr?: string[]; en?: string[]; phrases?: string[] }

const SIGNALS: SignalRule[] = [
  { mode: 'exam', tr: ['sınav', 'kpss', 'yks', 'tyt', 'ayt', 'ales', 'lgs', 'dgs', 'tus', 'yds', 'yökdil'], en: ['exam', 'toefl', 'ielts', 'gre', 'gmat'] },
  { mode: 'tez', tr: ['tez'], en: ['thesis', 'dissertation'] },
  { mode: 'mulakat', tr: ['mülakat'], en: ['interview'], phrases: ['iş\\s+görüşme\\p{L}*', 'job\\s+interview\\p{L}*'] },
  { mode: 'spor', phrases: ['kilo\\s+ver\\p{L}*', 'zayıfla\\p{L}*', 'lose\\s+(?:\\d+\\s*(?:kg|kilos?|pounds|lbs)|weight)'] },
  { mode: 'tasarruf', tr: ['birikim', 'tasarruf'], en: ['savings'], phrases: ['biriktir\\p{L}*', 'save\\s+money', 'saving\\s+money'] },
  {
    mode: 'birakma',
    phrases: ['(?:sigara|tütün|alkol|içki|şeker|kafein|kumar)\\p{L}*\\s+bırak\\p{L}*', 'quit\\s+(?:smoking|drinking|alcohol|sugar|caffeine|gambling)'],
  },
  { mode: 'ramazan', tr: ['ramazan'], en: ['ramadan'] },
];

/** Durum cümlesinin dolgu kelimeleri: yalnız bunlar kalıyorsa parça bir iş değil, bir durumdur. */
const STATEMENT_WORDS = new Set([
  'var', 'yok', 'olacak', 'yaklaşıyor', 'hazırlanıyorum', 'çalışıyorum', 'giriyorum', 'gireceğim', 'istiyorum',
  'için', 'benim', 'bir', 'şu', 'an', 'şimdi', 'de', 'da', 've',
  'i', "i'm", 'im', "i've", 'am', 'have', 'has', 'got', 'a', 'my', 'the', 'is', 'on', 'in', 'for',
  'preparing', 'studying', 'want', 'to', 'will', 'be', 'there', 'coming', 'up', 'and',
]);

/** Kesilen bir kanıtın yanında yetim kalan bağlaçlar. */
const CONNECTORS = new Set(['ve', 'and', 'on', 'every', 'her', 'günleri', 'at', 'saat']);

/*
  SIRALAYICI ("markete git sonra eczaneye uğra"). "daha sonra" düşük önceliktir, "-den sonra" bir
  zamandır ("işten sonra"), "2 gün sonra" bir tarihtir — bunlar bölmez.
*/
const SEQUENCER = /(^|\s)(sonra|ardından|sonrasında|akabinde|bir\s+de|ayrıca|then|afterwards|after\s+that|also)(?=\s)/giu;
const LEAD_SEQUENCER = /^(?:sonra|ardından|sonrasında|akabinde|bir\s+de|ayrıca|then|afterwards|after\s+that|also)\s+/iu;
const LEAD_FIRST = /^(?:önce|ilk\s+olarak|first)\s+/iu;

/*
  EMİR ZİNCİRİ ("kira öde elektrik faturası öde"). Türkçede emir cümle sonundadır: bir emir
  kelimesinden sonra, en az bir kelime ve yine bir emirle biten parça yeni bir iştir. Sözlük
  yalnız yalın emir kökleri; tek kelimelik baş ("yaz tatilini planla" → "yaz" mevsim) bölmez.
*/
const IMPERATIVE_TR = new Set([
  'al', 'ver', 'git', 'gel', 'öde', 'ara', 'yap', 'gönder', 'at', 'yaz', 'oku', 'bitir', 'hazırla', 'getir', 'götür',
  'temizle', 'topla', 'yıka', 'yıkat', 'ütüle', 'uğra', 'çıkar', 'sor', 'bak', 'izle', 'dinle', 'iç', 'ye', 'koş', 'yürü',
  'çalış', 'planla', 'ayarla', 'et', 'düzenle', 'yenile', 'bul', 'seç', 'sat', 'kur', 'değiştir', 'onayla', 'imzala',
  'doldur', 'boşalt', 'paylaş', 'kaydet', 'indir', 'yükle', 'sil', 'söyle', 'konuş', 'tamamla', 'geçir', 'araştır',
  'öğren', 'tekrarla', 'çöz', 'başla', 'bırak', 'as', 'yerleştir', 'sula', 'besle', 'kes', 'pişir', 'kapat', 'aç',
  'iste', 'gör', 'yatır', 'çek', 'tak', 'bağla', 'ekle', 'çiz', 'ölç', 'dök', 'giy', 'sık', 'sar', 'yolla', 'ilet',
]);
/* İngilizcede emir başta: emirle başlayan parçada yeni bir emir (ardından en az bir kelime) yeni iştir. */
const IMPERATIVE_EN = new Set([
  'buy', 'call', 'pay', 'send', 'email', 'finish', 'write', 'read', 'clean', 'book', 'pick', 'take', 'go', 'get', 'fix',
  'check', 'order', 'cancel', 'renew', 'submit', 'print', 'text', 'reply', 'schedule', 'visit', 'return', 'wash', 'cook',
  'make', 'prepare', 'review', 'update', 'sign', 'mail', 'drop', 'bring', 'meet', 'ask', 'water', 'feed', 'walk', 'pack',
]);

// ─────────────────────────────────────────────────────────────────────────────
//  1–2. Bölme ve birleştirme
// ─────────────────────────────────────────────────────────────────────────────

const words = (t: string) => t.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

/** Satır, cümle sonu ve virgül. Ondalık ("12.50", "12,50") ve sıra numarası ("1.") bölünmez. */
function sentenceSpans(text: string): Span[] {
  const out: Span[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = text[i - 1] ?? '';
    const next = text[i + 1] ?? '';
    if (ch === '\n' || ch === ';') { out.push({ a: start, b: i }); start = i + 1; }
    else if ((ch === '!' || ch === '?') && (next === '' || /\s/.test(next))) { out.push({ a: start, b: i + 1 }); start = i + 1; }
    else if (ch === '.' && !/\d/.test(prev) && (next === '' || /\s/.test(next))) { out.push({ a: start, b: i }); start = i + 1; }
    else if (ch === ',' && !(/\d/.test(prev) && /\d/.test(next))) { out.push({ a: start, b: i }); start = i + 1; }
  }
  out.push({ a: start, b: text.length });
  return out;
}

/** Baştaki boşluk ve madde işareti ("- ", "• ", "1) ", "2. ") parçaya dahil değil. */
function trimSpan(text: string, sp: Span): Span | null {
  const lead = /^\s*(?:(?:[-*•·–]|\d{1,2}[.)])\s+)?/.exec(text.slice(sp.a, sp.b))?.[0].length ?? 0;
  const a = sp.a + lead;
  let b = sp.b;
  while (b > a && /\s/.test(text[b - 1])) b--;
  return b > a ? { a, b } : null;
}

/** "ve/and" yalnız iki tarafta da en az iki kelime varsa böler. */
function splitConjunctions(text: string, sp: Span): Span[] {
  const piece = text.slice(sp.a, sp.b);
  const conj = [...piece.matchAll(/(^|\s)(ve|and)(?=\s)/giu)].map((m) => ({
    a: sp.a + (m.index ?? 0) + m[1].length,
    b: sp.a + (m.index ?? 0) + m[0].length,
  }));
  const out: Span[] = [];
  let segStart = sp.a;
  conj.forEach((c, k) => {
    const rightEnd = conj[k + 1]?.a ?? sp.b;
    if (words(text.slice(segStart, c.a)) >= 2 && words(text.slice(c.b, rightEnd)) >= 2) {
      out.push({ a: segStart, b: c.a });
      segStart = c.b;
    }
  });
  out.push({ a: segStart, b: sp.b });
  return out;
}

/**
 * NOKTALAMASIZ İKİ İŞ (2026-11-01, kullanıcı cihazda yazdı): "yarın temizlik yapılacak öbür gün toplantı var".
 * İkinci bir TARİH, arada bir iş kelimesi varsa yeni bir işin başıdır; parça oradan bölünür.
 * Arada yalnız bağlaç varsa ("pazartesi ve cuma spor") bölünmez — o bir gün listesidir.
 */
function splitByDates(text: string, sp: Span, lang: Lang, now: Date): Span[] {
  const out: Span[] = [];
  let start = sp.a;
  for (let guard = 0; guard < 12; guard++) {
    const piece = text.slice(start, sp.b);
    const first = understand(piece, lang, now).facts.find((f) => f.kind === 'date' && f.at);
    if (!first?.at) break;
    const restAt = first.at[1];
    const second = understand(piece.slice(restAt), lang, now).facts.find((f) => f.kind === 'date' && f.at);
    if (!second?.at) break;
    const between = normalize(piece.slice(restAt, restAt + second.at[0]), lang).match(/[\p{L}\p{N}]+/gu) ?? [];
    const before = normalize(piece.slice(0, first.at[0]), lang).match(/[\p{L}\p{N}]+/gu) ?? [];
    // Bir iş kelimesi tarihlerin arasında ya da ilk tarihten önce olmalı (ör. "rapor pazartesi sunum cuma").
    const hasWork = [...between, ...before].some((w) => !CONNECTORS.has(w) && !STATEMENT_WORDS.has(w));
    if (!hasWork || between.every((w) => CONNECTORS.has(w))) break;
    const cut = start + restAt + second.at[0];
    out.push({ a: start, b: cut });
    start = cut;
  }
  out.push({ a: start, b: sp.b });
  return out;
}

/** understand'ın bulduğu tarih/saat/tekrar aralıkları (mutlak konum): bunların içinde bölünmez. */
function factSpans(text: string, sp: Span, lang: Lang, now: Date): Span[] {
  return understand(text.slice(sp.a, sp.b), lang, now).facts
    .filter((f) => f.at).map((f) => ({ a: sp.a + f.at![0], b: sp.a + f.at![1] }));
}

function splitSequencers(text: string, sp: Span, lang: Lang, now: Date): Span[] {
  const piece = text.slice(sp.a, sp.b);
  const s = normalize(piece, lang);
  const facts = factSpans(text, sp, lang, now);
  const out: Span[] = [];
  let segStart = sp.a;
  for (const m of s.matchAll(SEQUENCER)) {
    const a = sp.a + (m.index ?? 0) + m[1].length;
    const b = sp.a + (m.index ?? 0) + m[0].length;
    const word = m[2].toLowerCase();
    const before = s.slice(0, a - sp.a);
    if (/(?:^|\s)daha\s*$/u.test(before)) continue;                                      // "daha sonra" → öncelik
    if (/^(sonra|ardından|sonrasında)$/.test(word) && /(dan|den|tan|ten)\s*$/u.test(before)) continue; // "işten sonra"
    if (facts.some((f) => a < f.b && b > f.a)) continue;                                 // "2 gün sonra"
    const left = text.slice(segStart, a).replace(LEAD_FIRST, '');
    if (words(left) < 2 || words(text.slice(b, sp.b)) < 1) continue;
    out.push({ a: segStart, b: a });
    segStart = b;
  }
  out.push({ a: segStart, b: sp.b });
  return out;
}

function splitImperatives(text: string, sp: Span, lang: Lang, now: Date): Span[] {
  const s = normalize(text.slice(sp.a, sp.b), lang);
  const facts = factSpans(text, sp, lang, now);
  const toks = [...s.matchAll(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu)]
    .map((m) => ({ w: m[0], a: sp.a + (m.index ?? 0), b: sp.a + (m.index ?? 0) + m[0].length }))
    .filter((t) => !facts.some((f) => t.a < f.b && t.b > f.a));
  const out: Span[] = [];
  let segStart = 0;
  let cutAt = sp.a;
  // Dil parçadan okunur: Türkçe karaktersiz kısa yazım ("kitap oku not al") İngilizce sanılabiliyor.
  if (toks.length && IMPERATIVE_EN.has(toks[0].w)) {
    for (let j = 2; j < toks.length - 1; j++) {
      if (IMPERATIVE_EN.has(toks[j].w) && IMPERATIVE_EN.has(toks[segStart].w) && j - segStart >= 2) {
        out.push({ a: cutAt, b: toks[j].a });
        cutAt = toks[j].a;
        segStart = j;
      }
    }
  } else {
    for (let i = 1; i < toks.length - 2; i++) {
      if (!IMPERATIVE_TR.has(toks[i].w) || i - segStart < 1) continue;
      const nextImp = toks.findIndex((t, k) => k > i + 1 && IMPERATIVE_TR.has(t.w));
      if (nextImp < 0) continue;
      out.push({ a: cutAt, b: toks[i].b });
      cutAt = toks[i].b;
      segStart = i + 1;
    }
  }
  out.push({ a: cutAt, b: sp.b });
  return out;
}

/** Bölünmüş parçaların başındaki yetim sıralayıcı ("ve sonra kuaför" → "kuaför"), ilkinde "önce". */
function stripLeads(text: string, parts: Span[]): Span[] {
  return parts.map((p, k) => {
    const piece = text.slice(p.a, p.b);
    const re = k > 0 ? LEAD_SEQUENCER : parts.length > 1 ? LEAD_FIRST : null;
    const m = re?.exec(piece);
    return m ? { a: p.a + m[0].length, b: p.b } : p;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Parçayı anlama
// ─────────────────────────────────────────────────────────────────────────────

interface Analysis {
  u: Understanding;
  /** Başlıktan çıkacak yerler: tarih, saat, tekrar, gün listesi, sıklık, açık yüksek öncelik. */
  cuts: Span[];
  evidence: string[];
  days: number[];
  /** Gün listesi tekrar mı bildiriyor (iki+ gün ya da "cumaları")? */
  daysRepeat: boolean;
  weeklyTimes?: number;
  intervalDays?: number;
  cue: boolean;
  signals: Array<{ mode: CaptureModeId; text: string }>;
  /** Hiçbir kanıta, sinyale ya da bağlaca ait olmayan kelimeler. */
  residue: string[];
  /** Başka parçaya aktarılabilecek zamanlama: tarih, tekrar, gün listesi, sıklık (saat ve öncelik DEĞİL). */
  timing: string[];
  /** Yalnız tarih kelimeleri (saat-only parça bunu devralır). */
  dateText?: string;
  hasTime: boolean;
}

function analyze(piece: string, lang: Lang, now: Date): Analysis {
  const s = normalize(piece, lang);
  const u = understand(piece, lang, now);
  const cuts: Span[] = [];
  const evidence: string[] = [];
  const timing: string[] = [];
  const cover = (sp: Span, transferable = false) => {
    cuts.push(sp);
    evidence.push(s.slice(sp.a, sp.b));
    if (transferable) timing.push(s.slice(sp.a, sp.b));
  };

  for (const f of u.facts) {
    if (!f.at) continue;
    if (f.kind === 'date' || f.kind === 'time' || f.kind === 'recurrence' || (f.kind === 'priority' && u.priority === 'High')) {
      cover({ a: f.at[0], b: f.at[1] }, f.kind === 'date' || f.kind === 'recurrence');
    }
  }
  const dateFact = u.facts.find((f) => f.kind === 'date' && f.at);

  const days = new Set<number>();
  let daysRepeat = false;
  for (const h of scan(WEEKDAY_LIST, s)) {
    days.add(WEEKDAY[h.g[0]]);
    if (h.g[1] || h.g[2]) daysRepeat = true;
    if (!cuts.some((c) => h.a >= c.a && h.b <= c.b)) cover(h, true);
  }
  if (u.recurrence === 'Weekly' && u.recurrenceDay != null) {
    days.add((u.recurrenceDay + 6) % 7);
    daysRepeat = true;
  }
  if (days.size >= 2) daysRepeat = true;

  let weeklyTimes: number | undefined;
  for (const re of WEEKLY_TIMES) {
    const [h] = scan(re, s);
    if (h && weeklyTimes == null) { weeklyTimes = Math.min(7, toNum(h.g[0])); cover(h, true); }
  }

  // Aralık ("gün aşırı", "iki günde bir"): understand tekrar olarak tüketir ama tekrar türü 'None'.
  let intervalDays: number | undefined;
  const rec = u.facts.find((f) => f.kind === 'recurrence');
  if (rec && u.recurrence === 'None') {
    if (/gün\s+aşırı|every\s+other\s+day/.test(rec.text)) intervalDays = 2;
    else {
      const m = /(\S+)\s+günde\s+bir|every\s+(\S+)\s+days/.exec(rec.text);
      if (m) intervalDays = toNum(m[1] ?? m[2]);
    }
  }

  const cueHits = scan(HABIT_CUE, s);
  cueHits.forEach((h) => cover(h, true));

  const signalSpans: Span[] = [];
  const signals: Analysis['signals'] = [];
  const tokens = [...s.matchAll(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu)].map((m) => ({ w: m[0], a: m.index ?? 0, b: (m.index ?? 0) + m[0].length }));
  for (const rule of SIGNALS) {
    const hits: Span[] = [];
    for (const t of tokens) {
      const wEn = t.w.replace(/ı/g, 'i');
      if (rule.tr?.some((l) => matchesTr(t.w, l)) || rule.en?.some((l) => matchesEn(wEn, l))) hits.push(t);
    }
    for (const p of rule.phrases ?? []) hits.push(...scan(rx(p), s));
    if (hits.length) {
      signalSpans.push(...hits);
      const first = hits.reduce((x, y) => (y.a < x.a ? y : x));
      signals.push({ mode: rule.mode, text: s.slice(first.a, first.b) });
    }
  }

  const covered = (t: Span) => [...cuts, ...signalSpans].some((c) => t.a < c.b && t.b > c.a);
  const residue = tokens.filter((t) => !covered(t) && !CONNECTORS.has(t.w)).map((t) => t.w);

  return {
    u, cuts, evidence, days: [...days].sort((x, y) => x - y), daysRepeat, weeklyTimes, intervalDays, cue: cueHits.length > 0, signals, residue,
    timing, dateText: dateFact?.text, hasTime: u.facts.some((f) => f.kind === 'time'),
  };
}

/** Kendi başına iş olmayan parça: yalnız tarih/saat/tekrar/gün kelimelerinden ibaret. */
const isSatellite = (an: Analysis) => an.residue.length === 0 && an.signals.length === 0;

/** Yalnız bir durum bildiriyor: sinyal var, geriye dolgu ve sayıdan başka kelime yok. */
const isStatement = (an: Analysis) =>
  an.signals.length > 0 && an.residue.every((w) => STATEMENT_WORDS.has(w) || /^\d+$/.test(w));

// ─────────────────────────────────────────────────────────────────────────────
//  4. Başlık ve sınıflama
// ─────────────────────────────────────────────────────────────────────────────

const MARK = '\u0000';

/** Kanıtları başlıktan çıkarır; yanlarında yetim kalan bağlaç ve virgülü de (titleOf'un genişletilmişi). */
function cutTitle(text: string, cuts: Span[], lang: Lang): string {
  const chars = text.split('');
  for (const c of cuts) for (let i = c.a; i < c.b; i++) chars[i] = i === c.a ? MARK : '';
  let t = chars.join('');
  const before = lang === 'en' ? '(?:and|on|every|at|by)' : '(?:ve|her|saat)';
  const after = lang === 'en' ? '(?:and)' : '(?:ve|günleri)';
  const reBefore = new RegExp(`(^|[\\s,])${before}\\s*${MARK}`, 'giu');
  const reAfter = new RegExp(`${MARK}\\s*${after}(?=$|[\\s,])`, 'giu');
  let prev: string;
  do {
    prev = t;
    t = t.replace(reBefore, `$1${MARK}`)
      .replace(reAfter, MARK)
      .replace(new RegExp(`,\\s*${MARK}`, 'g'), MARK)
      .replace(new RegExp(`${MARK}\\s*,`, 'g'), MARK)
      .replace(new RegExp(`${MARK}\\s*${MARK}`, 'g'), MARK);
  } while (t !== prev);
  t = t.split(MARK).join(' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:\-–—]+|[\s,.;:!?\-–—]+$/g, '')
    .trim();
  return t;
}

const cap = (t: string, lang: Lang) => t.charAt(0).toLocaleUpperCase(lang) + t.slice(1);

function scheduleOf(an: Analysis): HabitSchedule | null {
  if (an.daysRepeat && an.days.length) return { kind: 'days', days: an.days };
  if (an.weeklyTimes != null) return an.weeklyTimes >= 7 ? { kind: 'daily' } : { kind: 'weekly', times: an.weeklyTimes };
  if (an.intervalDays != null) {
    const times = Math.floor(7 / Math.max(1, an.intervalDays));
    return times >= 7 ? { kind: 'daily' } : times >= 1 ? { kind: 'weekly', times } : null;
  }
  if (an.u.recurrence === 'Weekly') return { kind: 'weekly', times: 1 };
  if (an.u.recurrence === 'Daily' || an.cue) return { kind: 'daily' };
  return null;
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Giriş noktası
// ─────────────────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /**
   * false → durum cümlesi ("5 kilo vermek istiyorum") de MADDE olur; mod sinyali yine raporlanır.
   * Bir modun İÇİNDE plan yazılırken (bkz. customPlanDraft) mod zaten seçili: cümle bir iştir.
   */
  statements?: boolean;
}

export function capture(text: string, preferredLang?: Lang, now: Date = new Date(), opts: CaptureOptions = {}): CaptureResult {
  // Yazı alanının ötesi okunmaz (ekran zaten maxLength koyar; bu savunma).
  text = (text ?? '').slice(0, CAPTURE_LIMITS.inputChars);
  const lang = preferredLang ?? detectLang(text);
  const out: CaptureResult = { lang, items: [], modes: [], dropped: 0 };
  if (!text?.trim()) return out;

  // 1. Böl. Aynı cümleden (noktalama arası) çıkan parçalar bir GRUP: bağlamı paylaşır.
  type Piece = { sp: Span; an: Analysis; group: number; line: number };
  const lineOf = (pos: number) => (text.slice(0, pos).match(/\n/g) ?? []).length;
  const raw: Array<{ sp: Span; group: number }> = [];
  sentenceSpans(text).forEach((sp, group) => {
    const t = trimSpan(text, sp);
    if (!t) return;
    const parts = splitConjunctions(text, t)
      .flatMap((x) => splitByDates(text, x, lang, now))
      .flatMap((x) => splitSequencers(text, x, lang, now))
      .flatMap((x) => splitImperatives(text, x, lang, now))
      .map((x) => trimSpan(text, x)).filter((x): x is Span => !!x);
    stripLeads(text, parts).forEach((x) => { if (words(text.slice(x.a, x.b)) > 0) raw.push({ sp: x, group }); });
  });

  // 2. Birleştir: uydu parça sonrakine (son parçaysa öncekine) katılır.
  const pieces: Piece[] = raw.map(({ sp, group }) => ({ sp, group, line: lineOf(sp.a), an: analyze(text.slice(sp.a, sp.b), lang, now) }));
  for (let i = 0; i < pieces.length;) {
    if (pieces.length > 1 && isSatellite(pieces[i].an)) {
      const j = i + 1 < pieces.length ? i + 1 : i - 1;
      const sp = { a: Math.min(pieces[i].sp.a, pieces[j].sp.a), b: Math.max(pieces[i].sp.b, pieces[j].sp.b) };
      pieces[j] = { ...pieces[j], sp, an: analyze(text.slice(sp.a, sp.b), lang, now) };
      pieces.splice(i, 1);
      if (j < i) i = Math.max(0, i - 1);
      continue;
    }
    i++;
  }

  /*
    BAĞLAM (D). Kendi zamanlaması olmayan parça şunları devralır, bu sırayla:
      · satır başlığı: "bugün: market, postane" → başlıktaki zamanlama satırın her maddesine;
      · aynı cümledeki önceki parça: "her gün kitap oku ve yürüyüş yap", "yarın X sonra Y";
      · yalnız saati olan parça önceki parçanın TARİHİNİ: "yarın sabah hastane, öğleden sonra ders".
    Virgülle ayrılmış düz liste bağlam paylaşmaz ("yarın dişçi, kitap oku" → kitap yarın değil).
  */
  const headers = new Map<number, string[]>();
  text.split('\n').forEach((lineText, line) => {
    const m = /^\s*([^:\n]{1,40}?)\s*:(?=\s|$)/.exec(lineText);
    if (!m) return;
    const h = analyze(m[1], lang, now);
    if (isSatellite(h) && h.timing.length) headers.set(line, h.timing);
  });
  const contextOf = (k: number): string[] | null => {
    const { an, group, line } = pieces[k];
    if (an.timing.length) return null;
    const header = headers.get(line);
    if (header) return header;
    for (let p = k - 1; p >= 0 && pieces[p].group === group; p--) if (pieces[p].an.timing.length) return pieces[p].an.timing;
    // Saat-only parça ya da gün parçasıyla başlayan madde ("yarın sabah X, akşam Y") önceki tarihi devralır;
    // devralınca "yarın akşam Y" olarak okunur ve gün parçası saate döner.
    const startsWithPart = /^(sabah|akşam|morning|evening)\s/u.test(normalize(text.slice(pieces[k].sp.a, pieces[k].sp.b), lang));
    if ((an.hasTime || startsWithPart) && !an.dateText) {
      for (let p = k - 1; p >= 0 && pieces[p].line === line; p--) if (pieces[p].an.dateText) return [pieces[p].an.dateText!];
    }
    return null;
  };

  // 3–5. Anla, sınıfla, mod sinyali
  const seen = new Set<string>();
  for (let k = 0; k < pieces.length; k++) {
    const { sp } = pieces[k];
    const source = text.slice(sp.a, sp.b);
    const ctx = contextOf(k);
    // Bağlam devralınırsa parça, bağlamın kelimeleriyle birlikte yeniden okunur; başlıktan yine kesilir.
    const read = ctx ? `${ctx.join(' ')} ${source}` : source;
    const an = ctx ? analyze(read, lang, now) : pieces[k].an;
    const statement = opts.statements !== false && isStatement(an);

    for (const sig of an.signals) {
      const known = out.modes.find((m) => m.mode === sig.mode);
      const date = statement ? an.u.dueDate : undefined;
      if (!known) out.modes.push({ mode: sig.mode, evidence: sig.text, ...(date ? { date } : {}) });
      else if (!known.date && date) known.date = date;
    }
    if (statement || isSatellite(an)) continue;

    const schedule = scheduleOf(an);
    const title = clampTitle(cap(cutTitle(read, an.cuts, lang) || source.trim(), lang), schedule ? CAPTURE_LIMITS.habitTitle : CAPTURE_LIMITS.taskTitle);
    const key = `${schedule ? 'h' : 't'}:${title.toLocaleLowerCase(lang)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Sınır aşıldı: madde alınmaz ama SAYILIR — ekran "gerisini sonra ekle" der (sessiz düşme yok).
    if (out.items.length >= CAPTURE_LIMITS.items) { out.dropped++; continue; }

    if (schedule) {
      out.items.push({ kind: 'habit', title, source, evidence: an.evidence, schedule, emoji: suggestHabitIcon(title, lang) });
    } else {
      const { u } = an;
      out.items.push({
        kind: 'task', title, source, evidence: an.evidence,
        ...(u.dueDate ? { dueDate: u.dueDate } : {}),
        ...(u.dueTime ? { dueTime: u.dueTime, time: hhmm(u.dueTime) } : {}),
        ...(u.priority ? { priority: u.priority } : {}),
        ...(u.recurrence === 'Monthly' ? { recurrence: 'Monthly' as const } : {}),
        ...(u.category ? { category: u.category } : {}),
      });
    }
  }
  return out;
}
