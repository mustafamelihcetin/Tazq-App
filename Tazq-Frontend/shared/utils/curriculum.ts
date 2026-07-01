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
 */

import { detectExamFromInput, matchExamName } from './examPresets';

export interface Subject {
  id: string;
  tr: string;
  en: string;
  /** Göreli ağırlık (sınavdaki yoğunluk). Varsayılan 1. */
  weight?: number;
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
  version: 1,
  exams: [
    {
      id: 'kpss',
      subjects: [
        { id: 'kpss_turkce', tr: 'Türkçe', en: 'Turkish', weight: 2 },
        { id: 'kpss_matematik', tr: 'Matematik', en: 'Math', weight: 2 },
        { id: 'kpss_tarih', tr: 'Tarih', en: 'History', weight: 1 },
        { id: 'kpss_cografya', tr: 'Coğrafya', en: 'Geography', weight: 1 },
        { id: 'kpss_vatandaslik', tr: 'Vatandaşlık', en: 'Citizenship', weight: 1 },
        { id: 'kpss_guncel', tr: 'Güncel Bilgiler', en: 'Current Affairs', weight: 1 },
      ],
    },
    {
      id: 'yks',
      subjects: [
        { id: 'yks_turkce', tr: 'Türkçe', en: 'Turkish', weight: 2 },
        { id: 'yks_matematik', tr: 'Matematik', en: 'Math', weight: 2 },
        { id: 'yks_fen', tr: 'Fen Bilimleri', en: 'Science', weight: 1 },
        { id: 'yks_sosyal', tr: 'Sosyal Bilimler', en: 'Social Sciences', weight: 1 },
      ],
    },
  ],
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
  const preset = detectExamFromInput(examName) ?? matchExamName(examName)[0];
  if (!preset) return null;
  return activeManifest.exams.find(e => e.id === preset.id) ?? null;
}

/**
 * Bugünün konusunu seç — aralıklı tekrar mantığı:
 * 1) En uzun süredir çalışılmayan (hiç çalışılmamış = en öncelikli) konu.
 * 2) Eşitlikte ağırlığa göre deterministik tur (dayIndex ile) — yoğun dersler
 *    daha sık döner ama her ders kapsanır.
 *
 * Saf fonksiyon: aynı girdi → aynı çıktı (test edilebilir).
 */
export function pickSubject(
  exam: ExamCurriculum,
  progress: Record<string, SubjectProgress>,
  dayIndex: number,
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

  // Ağırlıklı deterministik tur: ağırlık kadar tekrarlanan diziden dayIndex ile seç.
  const expanded: Subject[] = [];
  for (const s of candidates) {
    const w = Math.max(1, Math.round(s.weight ?? 1));
    for (let i = 0; i < w; i++) expanded.push(s);
  }
  if (!expanded.length) return candidates[0];
  return expanded[((dayIndex % expanded.length) + expanded.length) % expanded.length];
}

/** Konuyu görev başlığına yerleştir: "KPSS — Türkçe: ..." */
export function subjectExamLabel(examName: string, subject: Subject, lang: 'tr' | 'en'): string {
  const name = examName.trim();
  const subj = lang === 'tr' ? subject.tr : subject.en;
  return name ? `${name} — ${subj}` : subj;
}
