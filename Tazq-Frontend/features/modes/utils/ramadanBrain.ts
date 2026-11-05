/*
  RAMAZAN DÜZENİ (2026-11-05, kullanıcı: "ramazan modu farklı bir mekanik olmalı; spor, sınav, tez açıkken planlar değişebilir ama karmaşayla değil, ortak akılla").
  Ramazan diğer planların yanında bir plan değil, hepsinin üstünde bir düzendir. Tek soruyu burada yanıtlar: oruçluyken bugün ne kadar iş, hangisi günün hangi vaktine.
  Saf: ekran ve depo bilmez. Yalnız hafifletir ve zamanlar, hiçbir planı silmez. Oruç tutmayan kişi (hasta, yolcu, tutmamayı seçen) tek dokunuşla çıkar; sebep sorulmaz.
*/
export type RamadanWindow = 'sahur' | 'day' | 'iftar' | 'night';
export type RamadanPhase = 'none' | 'month' | 'last10' | 'eid';

export interface RamadanFrame {
  /** Düzen bugün çalışıyor mu: mod açık, dönem içinde ve kişi oruçlu. */
  fasting: boolean;
  /** Mod açık ve dönem içinde (oruç tutmasa da). */
  inMonth: boolean;
  phase: RamadanPhase;
}

/** Gün içi toplam iş: Ramazan'da yığılma en çok burada acıtır. */
export const FASTING_BUDGET = 3;
/** Bayram üç gün sürer: oruç yok ama aile ve misafir var. Plan görev yağdırmaz, sınav hariç hiçbir şey kesilmez. */
export const EID_DAYS = 3;
export const EID_BUDGET = 2;
const LAST_TEN = 10;
const STUDY_FACTOR = 0.8;
const STUDY_FACTOR_LAST10 = 0.7;
/** Sınava bu kadar kala süre kısılmaz: sınav Ramazan'ı beklemez. */
export const EXAM_PROTECT_DAYS = 30;

export function ramadanFrame(i: { modeOn: boolean; isActive: boolean; daysRemaining: number; notFasting: boolean; notFastingToday: boolean; isEid?: boolean }): RamadanFrame {
  const inMonth = i.modeOn && i.isActive;
  return {
    inMonth,
    fasting: inMonth && !i.notFasting && !i.notFastingToday,
    phase: i.modeOn && i.isEid ? 'eid' : !inMonth ? 'none' : i.daysRemaining < LAST_TEN ? 'last10' : 'month',
  };
}

/** Bugün bayram mı: dönem bitişinden sonraki üç gün. */
export const isEidDay = (today: string, ranges: { end: string }[], dayNum: (k: string) => number) => ranges.some(r => { const d = dayNum(today) - dayNum(r.end); return d >= 1 && d <= EID_DAYS; });

/** Bugünün toplam plan bütçesi. */
export const budgetFor = (frame: RamadanFrame, base: number) => (frame.phase === 'eid' ? Math.min(EID_BUDGET, base) : frame.fasting ? Math.min(FASTING_BUDGET, base) : base);

/** Sınav bloğunun vakti: yeni konu zihin tazeyken, tekrar gün içinde, deneme hafta sonu sabahı gibi uzun iş sahurdan sonra. */
export const studyBlockWindow = (type: string): RamadanWindow => (type === 'tekrar' || type === 'hafif' ? 'day' : type === 'analiz' ? 'night' : 'sahur');

/** Çalışma süresi çarpanı: sınav yakınsa 1. */
export function studyFactor(phase: RamadanPhase, daysToNearestExam: number | null): number {
  if (phase === 'none' || phase === 'eid') return 1;
  if (daysToNearestExam != null && daysToNearestExam >= 0 && daysToNearestExam <= EXAM_PROTECT_DAYS) return 1;
  return phase === 'last10' ? STUDY_FACTOR_LAST10 : STUDY_FACTOR;
}

const PHYSICAL_KINDS = new Set(['kilo', 'maraton', 'guc', 'genel']);
/** Bedensel plan oruçta bir iş azalır. Zihinsel planın yükü süre ve vakitle ayarlanır. */
export const isPhysicalKind = (kind: string) => PHYSICAL_KINDS.has(kind);

// Oruçluyken gün içinde olamayacak ve akşama da taşınmayacak işler. Öğünü kuran iş ("yarının öğünleri") burada değil, iftarda kalır.
const IMPOSSIBLE = /\b(öğle yemeğ|kahvaltı|ara öğün|sabah kahvesi|gün içinde su|her saat su)|breakfast|lunch|morning coffee|mid-?morning/i;
export const possibleWhileFasting = (tr: string) => !IMPOSSIBLE.test(tr);

const SAHUR_WORDS = /sahur|suhoor/i;
const NIGHT_WORDS = /teravih|taraweeh|kadir|gece|mushaf|kur.?an|dua\b|zikir/i;
const IFTAR_WORDS = /iftar|öğün|tabağ|yemek|ye\b|yiy|iç\b|içecek|su\b|protein|atıştır|sebze|şeker|sadaka/i;
const PHYSICAL_WORDS = /koş|antrenman|egzersiz|yürü|merdiven|esne|yokuş|squat|şınav|plank|kardiyo|ağırlık|set\b|tekrar yap|ısın/i;
const LIGHT_WORDS = /listele|not et|kaydet|kontrol|planla|takvim|gözden geçir|hesapla|gir\b|yaz\b.*(kısa|tek)|ara\b|düzenle/i;
const DEEP_WORDS = /yaz\b|yazdığın|revize|analiz|oku\b|çöz|çalış|konu|tekrar|paragraf|deneme|prova/i;

const BY_TYPE: Record<string, RamadanWindow> = { exam: 'sahur', tez: 'sahur', mulakat: 'day', tasarruf: 'day', birakma: 'iftar', ramazan: 'day', spor: 'iftar' };

/** İşin en uygun vakti. Sıra önemli: "iftardan sonra koş" önce bedensel, "gece kitap oku" önce gece. */
export function windowOf(planType: string, tr: string): RamadanWindow {
  if (SAHUR_WORDS.test(tr)) return 'sahur';
  if (/iftar/i.test(tr)) return 'iftar';
  if (NIGHT_WORDS.test(tr)) return 'night';
  if (PHYSICAL_WORDS.test(tr)) return 'iftar';
  if (IFTAR_WORDS.test(tr)) return 'iftar';
  if (LIGHT_WORDS.test(tr)) return 'day';
  if (DEEP_WORDS.test(tr)) return 'sahur';
  return BY_TYPE[planType] ?? 'day';
}

export const WINDOW_ORDER: RamadanWindow[] = ['sahur', 'day', 'iftar', 'night'];
export const windowRank = (w: RamadanWindow) => WINDOW_ORDER.indexOf(w);

/** Plan süresi kısılacak günler: dönem içi ve sınavdan uzak. Saf, planlayıcı okur. */
export interface StudyRelief { start: string; end: string }

export function reliefFactorFor(dayKey: string, relief: StudyRelief | null | undefined, examDates: string[], dayNum: (k: string) => number): number {
  if (!relief || dayKey < relief.start || dayKey > relief.end) return 1;
  const d = dayNum(dayKey);
  const left = dayNum(relief.end) - d;
  const near = examDates.map(k => dayNum(k) - d).filter(n => n >= 0);
  return studyFactor(left < LAST_TEN ? 'last10' : 'month', near.length ? Math.min(...near) : null);
}
