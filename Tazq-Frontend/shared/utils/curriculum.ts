/**
 * Müfredat veri katmanı — "içerik = uzaktan güncellenebilir veri" yaklaşımı.
 *
 * TASARIM:
 * - Uygulama gömülü bir BASELINE müfredat taşır (offline/garanti çalışır).
 * - İleride sunucudan (remote config) güncel sürüm çekilip `setCurriculum()` ile
 *   override edilebilir (sürüm yeni ise). Böylece müfredat/sınav değişince
 *   uygulama güncellemesi GEREKMEZ. Marjinal maliyet sıfır (sadece JSON).
 * - Bilinmeyen sınav → null döner; çağıran taraf mevcut JENERİK akışa düşer.
 *
 * GÜVENİLİRLİK: İçerik insan-doğrulamalı (AI uydurması değil). Sınav hazırlığında
 * yanlış müfredat zararlı olduğundan bu bilinçli bir tercihtir.
 *
 * Bu modül SAF + senkron tutulur (kolay test). Sınav adı→preset eşlemesi için
 * mevcut examPresets altyapısı kullanılır.
 *
 * ── İKİ SEVİYE: DERS → KONU ──────────────────────────────────────────────────
 * Eskiden yalnız DERS (Subject) vardı — "KPSS — Türkçe" gibi bir görev etiketi
 * üretiliyordu. Bu, "sanki rehberlik hocası görev veriyor" hissini vermiyordu:
 * tüm Türkçe çalışanlar aynı jenerik "soru çöz" görevini görüyordu. Artık her
 * dersin altında KONU (Topic) listesi var — "KPSS — Türkçe · Paragraf" gibi.
 * Rotasyon mantığı (en uzun süredir çalışılmayan + ağırlıklı tur) AYNI, yalnız
 * ders yerine konu üzerinde çalışıyor (bkz. `pickTopic`).
 *
 * ── DALGA PLANI ───────────────────────────────────────────────────────────────
 * Motor TÜM sınavları (examPresets.ts'teki her id) aynı şekilde destekler — hiçbiri
 * kod değişikliği gerektirmez, yalnız veri eksik/dolu olur. Dalga 1'de KPSS ve YKS
 * tam KONU derinliğinde; geri kalan sınavlar şimdilik yalnız DERS seviyesinde
 * (`topics` boş/kısa) — bu, "hiç içerik yok" ile "yanlış/uydurma içerik" arasında
 * daha güvenli bir ara durum. Sonraki dalgalarda yalnız bu dosyaya veri eklenir.
 */

import { detectExamFromInput, matchExamName } from './examPresets';
import { INTL_CURRICULA } from './curriculumIntl';
import { TR_CURRICULA } from './curriculumTr';

export interface Topic {
  id: string;
  tr: string;
  en: string;
  /** Göreli ağırlık (konunun sınavdaki yoğunluğu). Varsayılan 1. */
  weight?: number;
}

export interface Subject {
  id: string;
  tr: string;
  en: string;
  /** Göreli ağırlık (sınavdaki yoğunluk). Varsayılan 1. */
  weight?: number;
  /** Ders altındaki konular. Boşsa rotasyon ders seviyesinde kalır. */
  topics?: Topic[];
}

export interface ExamCurriculum {
  /** examPresets id'si ile eşleşir (kpss, yks, ...). */
  id: string;
  subjects: Subject[];
}

export interface CurriculumManifest {
  version: number;
  exams: ExamCurriculum[];
}

/** Konu ilerleme kaydı (yerel; bulut-senkron edilebilir). */
export interface SubjectProgress {
  /** En son çalışılan gün (YYYY-MM-DD). Yoksa hiç çalışılmamış. */
  lastStudied?: string;
}

// ── GÖMÜLÜ BASELINE ─────────────────────────────────────────────────────────────
// Yalnızca üst-düzey, evrensel-doğru başlıklar (düşük halüsinasyon/eskime riski).
// Detaylı/değişken konular sunucudaki manifest ile genişletilir.
export const BASELINE_CURRICULUM: CurriculumManifest = {
  version: 4,
  exams: [...TR_CURRICULA, ...INTL_CURRICULA],
};

// Aktif manifest (baseline ile başlar; remote override edilebilir).
let activeManifest: CurriculumManifest = BASELINE_CURRICULUM;

/** Remote/güncel manifest'i uygula (yalnız sürüm daha yeniyse). Offline-first override. */
export function setCurriculum(next: CurriculumManifest | null | undefined): boolean {
  if (!next || !Array.isArray(next.exams) || typeof next.version !== 'number') return false;
  if (next.version <= activeManifest.version) return false;
  activeManifest = next;
  return true;
}

export function getActiveCurriculumVersion(): number {
  return activeManifest.version;
}

/** Sınav adından (kullanıcı girdisi) müfredatı bul. Bilinmiyorsa null. */
export function findExamCurriculum(examName: string): ExamCurriculum | null {
  if (!examName || !examName.trim()) return null;
  // Önce tam alias eşleşmesi, sonra fuzzy en iyi eşleşme.
  // Kısa girdide yakın eşleşme yok: "at", SAT sayılmasın (2026-11-05, kısa adlı EN sınavları eklendi).
  const preset = detectExamFromInput(examName) ?? (examName.trim().length >= 3 ? matchExamName(examName)[0] : undefined);
  if (!preset) return null;
  return activeManifest.exams.find(e => e.id === preset.id) ?? null;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Ağırlıklı dizide gün → sıra. Ağırlık artık gerçek soru sayısı (2026-11-05): düz `gün % uzunluk` aynı dersin ağırlığı kadar peş peşe
 * dönerdi (KPSS'de ilk 30 tur Türkçe). Altın orana yakın adım diziyi dağıtır; adım uzunlukla aralarında asal olduğu için her eleman gelir.
 */
function spreadIndex(dayIndex: number, length: number): number {
  let step = Math.max(1, Math.round(length * 0.618));
  while (gcd(step, length) !== 1) step++;
  const day = ((dayIndex % length) + length) % length;
  return (day * step) % length;
}

/**
 * Bugünün konusunu seç — aralıklı tekrar mantığı:
 * 1) En uzun süredir çalışılmayan (hiç çalışılmamış = en öncelikli) konu.
 * 2) Eşitlikte ağırlığa göre deterministik tur (dayIndex ile) — yoğun dersler
 *    daha sık döner ama her ders kapsanır.
 *
 * `weakTopicIds` (opsiyonel): kullanıcının kendi-kendine zayıf işaretlediği KONU
 * id'leri (bkz. `pickTopic`). Bir dersin konularından biri bu listedeyse o ders
 * 2x ağırlık alır — yoksa zayıf konu yalnız "dersin sırası gelince hangi konuya
 * bakılacağını" etkiliyordu, dersin sırasının KENDİSİ hâlâ kör rotasyondaydı.
 * Ağırlık yalnız EŞİT-ESKİLİKTEKİ adaylar arasında tur belirlerken devreye girer
 * (pickTopic'teki aynı ilke) — "en uzun süredir çalışılmayan" adaleti bozulmaz.
 *
 * Saf fonksiyon: aynı girdi → aynı çıktı (test edilebilir).
 */
export function pickSubject(
  exam: ExamCurriculum,
  progress: Record<string, SubjectProgress>,
  dayIndex: number,
  weakTopicIds?: string[] | null,
): Subject | null {
  const subjects = exam.subjects;
  if (!subjects.length) return null;

  // En eski lastStudied'i bul (undefined = en eski/0).
  const lastTime = (s: Subject): number => {
    const ls = progress[s.id]?.lastStudied;
    if (!ls) return 0; // hiç çalışılmamış → en yüksek öncelik
    const t = new Date(ls).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  let oldest = Infinity;
  for (const s of subjects) oldest = Math.min(oldest, lastTime(s));
  // Eşik: en eski zamana "yakın" (aynı gün) olanlar aday.
  const oneDay = 86400000;
  const candidates = subjects.filter(s => lastTime(s) <= oldest + oneDay - 1);

  if (candidates.length === 1) return candidates[0];

  const weakSet = new Set(weakTopicIds ?? []);
  const hasWeakTopic = (s: Subject): boolean => (s.topics ?? []).some(t => weakSet.has(t.id));

  // Ağırlıklı deterministik tur: ağırlık kadar tekrarlanan diziden dayIndex ile seç.
  const expanded: Subject[] = [];
  for (const s of candidates) {
    const base = Math.max(1, Math.round(s.weight ?? 1));
    const w = hasWeakTopic(s) ? base * 2 : base;
    for (let i = 0; i < w; i++) expanded.push(s);
  }
  if (!expanded.length) return candidates[0];
  return expanded[spreadIndex(dayIndex, expanded.length)];
}

/**
 * Seçilen dersin BUGÜNKÜ konusunu seçer — `pickSubject` ile AYNI rotasyon mantığı,
 * bir seviye aşağıda (ders → konu). Dersin `topics` listesi boşsa (henüz derinleştirilmemiş
 * sınav — bkz. dosya başındaki "dalga planı") `null` döner; çağıran taraf ders seviyesinde
 * kalır (`subjectExamLabel` konu olmadan da çalışır) — yani eksik veri hiçbir şeyi bozmaz.
 *
 * `weakTopicIds`: kullanıcının kendi kendine "zayıfım" dediği konular (bkz. ExamCard
 * zayıf-konu seçimi). Bu konuların ağırlığı ikiye katlanır — rehber hocanın "bugün
 * zayıf olduğun konuya bakalım" demesinin karşılığı. Boş/verilmezse salt rotasyon.
 */
export function pickTopic(
  subject: Subject,
  progress: Record<string, SubjectProgress>,
  dayIndex: number,
  weakTopicIds?: string[] | null,
): Topic | null {
  const topics = subject.topics;
  if (!topics || !topics.length) return null;

  const weakSet = new Set(weakTopicIds ?? []);
  const lastTime = (t: Topic): number => {
    const ls = progress[t.id]?.lastStudied;
    if (!ls) return 0;
    const parsed = new Date(ls).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  let oldest = Infinity;
  for (const t of topics) oldest = Math.min(oldest, lastTime(t));
  const oneDay = 86400000;
  const candidates = topics.filter(t => lastTime(t) <= oldest + oneDay - 1);

  if (candidates.length === 1) return candidates[0];

  const expanded: Topic[] = [];
  for (const t of candidates) {
    const base = Math.max(1, Math.round(t.weight ?? 1));
    const w = weakSet.has(t.id) ? base * 2 : base;
    for (let i = 0; i < w; i++) expanded.push(t);
  }
  if (!expanded.length) return candidates[0];
  return expanded[spreadIndex(dayIndex, expanded.length)];
}

/**
 * Konuyu görev başlığına yerleştir: "KPSS — Türkçe" ya da (konu varsa)
 * "KPSS — Türkçe · Paragraf". `topic` opsiyonel — çağıran taraf `pickTopic`
 * `null` dönerse (henüz derinleştirilmemiş sınav) eski (ders-seviyesi) davranışı korur.
 */
/** UI için düzleştirilmiş konu listesi — zayıf-konu seçim ekranının tek veri kaynağı. */
export interface FlatTopic {
  id: string;
  tr: string;
  en: string;
  subjectTr: string;
  subjectEn: string;
}

export function listTopics(exam: ExamCurriculum): FlatTopic[] {
  const out: FlatTopic[] = [];
  for (const s of exam.subjects) {
    for (const t of s.topics ?? []) {
      out.push({ id: t.id, tr: t.tr, en: t.en, subjectTr: s.tr, subjectEn: s.en });
    }
  }
  return out;
}

export function subjectExamLabel(examName: string, subject: Subject, lang: 'tr' | 'en', topic?: Topic | null): string {
  const name = examName.trim();
  const subj = lang === 'tr' ? subject.tr : subject.en;
  const base = name ? `${name} — ${subj}` : subj;
  if (!topic) return base;
  const top = lang === 'tr' ? topic.tr : topic.en;
  return `${base} · ${top}`;
}
