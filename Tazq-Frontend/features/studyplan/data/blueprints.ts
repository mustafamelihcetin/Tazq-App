import { findExamCurriculum, type ExamCurriculum } from '@/shared/utils/curriculum';
import { EXAM_TRACKS, type ExamTrack } from '@/shared/utils/curriculumTr';
import { detectExamFromInput, matchExamName, type ExamPreset } from '@/shared/utils/examPresets';
import type { PlanTopic, TopicKind } from '../utils/scheduler';

/*
  SINAV HARİTASI (2026-11-05). Konu listesi curriculum'dan gelir; burası planlayıcının ihtiyacı olan iki şeyi ekler: göreli ağırlık ve
  kaba saat. Bunlar kullanıcıya GÖSTERİLMEZ, yalnız sıralama içindir; simülasyonda saat 2 kat yanlış olsa bile "konu bitti" işareti
  sonucu toparlıyor. Süre ve yanlış katsayısı sınava özgü gerçek bilgidir:
    KPSS 130 dk: ÖSYM 2026 duyurusu. DGS 135 dk ve 4 yanlış 1 doğru: ikincil kaynaklar, kılavuz açılamadı (bkz. docs/sinav-modu-tasarim.md).
*/
export type ScoreModel =
  | { kind: 'net'; penalty: number }
  | { kind: 'scaled'; min: number; max: number }
  | { kind: 'band'; min: number; max: number; step: number }
  | { kind: 'percent' };

export interface ExamMeta {
  mockMin: number;
  score: ScoreModel;
  /** Konu saati (verilmezse totalHours ağırlığa göre bölünür). */
  hours?: Record<string, number>;
  totalHours?: number;
  ezberSubjects?: string[];
}

const NET = (penalty = 0.25): ScoreModel => ({ kind: 'net', penalty });

export const EXAM_META: Record<string, ExamMeta> = {
  kpss: {
    mockMin: 130, score: NET(),
    totalHours: 340,
    hours: { kpss_turkce_paragraf: 30, kpss_mat_problem: 36, kpss_mat_geometri: 16 },
    ezberSubjects: ['kpss_tarih', 'kpss_cografya', 'kpss_vatandaslik', 'kpss_guncel'],
  },
  dgs: {
    mockMin: 135, score: NET(),
    hours: { dgs_sozel_anlam: 16, dgs_sozel_paragraf: 28, dgs_sozel_mantik: 18, dgs_sayisal_islemler: 30, dgs_sayisal_problem: 40, dgs_sayisal_geometri: 32, dgs_sayisal_mantik: 10, dgs_sayisal_veri: 8 },
  },
  yks: { mockMin: 165, score: NET(), totalHours: 1200, ezberSubjects: ['yks_sosyal', 'ayt_tar', 'ayt_cog', 'ayt_fel', 'ayt_din', 'ayt_edb'] },
  ales: { mockMin: 150, score: NET(), totalHours: 150 },
  lgs: { mockMin: 155, score: NET(1 / 3), totalHours: 400, ezberSubjects: ['lgs_inkilap', 'lgs_din'] },
  yds: { mockMin: 180, score: NET(0), totalHours: 200 },
  yokdil: { mockMin: 180, score: NET(0), totalHours: 150 },
  ags: { mockMin: 110, score: NET(), totalHours: 300, ezberSubjects: ['ags_mevzuat', 'ags_tarih', 'ags_cografya'] },
  hmgs: { mockMin: 155, score: NET(), totalHours: 500, ezberSubjects: ['hmgs_kamu', 'hmgs_ozel', 'hmgs_ceza', 'hmgs_usul'] },
  ekpss: { mockMin: 130, score: NET(), totalHours: 150 },
  tus: { mockMin: 300, score: NET(), totalHours: 800, ezberSubjects: ['tus_temel'] },
  ielts: { mockMin: 165, score: { kind: 'band', min: 0, max: 9, step: 0.5 }, totalHours: 120 },
  toefl: { mockMin: 90, score: { kind: 'scaled', min: 0, max: 120 }, totalHours: 120 },
  pte: { mockMin: 120, score: { kind: 'scaled', min: 10, max: 90 }, totalHours: 100 },
  det: { mockMin: 60, score: { kind: 'scaled', min: 10, max: 160 }, totalHours: 60 },
  gre: { mockMin: 118, score: { kind: 'scaled', min: 260, max: 340 }, totalHours: 120 },
  gmat: { mockMin: 135, score: { kind: 'scaled', min: 205, max: 805 }, totalHours: 120 },
  sat: { mockMin: 134, score: { kind: 'scaled', min: 400, max: 1600 }, totalHours: 120 },
  act: { mockMin: 125, score: { kind: 'scaled', min: 1, max: 36 }, totalHours: 100 },
  lsat: { mockMin: 140, score: { kind: 'scaled', min: 120, max: 180 }, totalHours: 200 },
  mcat: { mockMin: 450, score: { kind: 'scaled', min: 472, max: 528 }, totalHours: 400 },
};

const CATEGORY_HOURS: Record<ExamPreset['category'], number> = { university: 300, public: 200, graduate: 200, highschool: 300, language: 120, medical: 500, other: 120 };
const DEFAULT_MOCK = 120;

export interface ExamBlueprint {
  examId: string;
  topics: PlanTopic[];
  mockMin: number;
  score: ScoreModel;
  subjects: { id: string; tr: string; en: string }[];
  /** topicId → adı */
  labels: Record<string, { tr: string; en: string }>;
}

export function presetFor(name: string): ExamPreset | null {
  const q = name.trim();
  if (!q) return null;
  return detectExamFromInput(q) ?? (q.length >= 3 ? matchExamName(q)[0] ?? null : null);
}

/** Saf: bilinen sınavın planlayıcı girdisi. */
export function blueprintFromCurriculum(cur: ExamCurriculum, preset: ExamPreset | null): ExamBlueprint {
  const meta = EXAM_META[cur.id] ?? { mockMin: DEFAULT_MOCK, score: { kind: 'percent' } as ScoreModel };
  const kindOf = (sub: string): TopicKind => (preset?.category === 'language' ? 'dil' : meta.ezberSubjects?.includes(sub) ? 'ezber' : 'beceri');
  const totalQ = cur.subjects.reduce((a, s) => a + (s.weight ?? 1), 0) || 1;
  const totalHours = meta.totalHours ?? CATEGORY_HOURS[preset?.category ?? 'other'];
  const topics: PlanTopic[] = [];
  const labels: ExamBlueprint['labels'] = {};
  for (const s of cur.subjects) {
    const subjectShare = (s.weight ?? 1) / totalQ;
    const list = s.topics?.length ? s.topics : [{ id: s.id, tr: s.tr, en: s.en }];
    const weightOf = (t: { id: string; weight?: number }) => t.weight ?? 1;
    const inner = list.reduce((a, t) => a + weightOf(t), 0) || 1;
    for (const t of list) {
      const share = subjectShare * (weightOf(t) / inner);
      labels[t.id] = { tr: t.tr, en: t.en };
      topics.push({ id: t.id, subject: s.id, q: Math.round(share * 1000) / 10, hours: meta.hours?.[t.id] ?? Math.max(2, Math.round(totalHours * share)), kind: kindOf(s.id) });
    }
  }
  return { examId: cur.id, topics, mockMin: meta.mockMin, score: meta.score, subjects: cur.subjects.map(s => ({ id: s.id, tr: s.tr, en: s.en })), labels };
}

/** Konu listesi yoksa null: kullanıcı kendi konularını yazar. */
export function blueprintFor(name: string): ExamBlueprint | null {
  const cur = findExamCurriculum(name);
  return cur ? blueprintFromCurriculum(cur, presetFor(name)) : null;
}

/** Sınavın alanları (YKS: Sayısal, Eşit Ağırlık...). Alan yoksa boş. */
export const tracksFor = (examId: string): ExamTrack[] => EXAM_TRACKS[examId] ?? [];

/** Şu an seçili alan: planda kalan dersler tam olarak o alanın dersleriyse. Kullanıcı ders ekleyip çıkardıysa alan seçili sayılmaz. */
export function currentTrack(tracks: ExamTrack[], subjectIds: string[], excluded: string[]): string | null {
  const kept = subjectIds.filter(id => !excluded.includes(id));
  return tracks.find(t => t.keep.length === kept.length && t.keep.every(id => kept.includes(id)))?.id ?? null;
}

/** Alan seçilince yalnız değişmesi gereken dersler. Konu düzeyinde çıkarılanlara dokunulmaz. */
export function trackChanges(track: ExamTrack, subjectIds: string[], excluded: string[]): { id: string; excluded: boolean }[] {
  return subjectIds
    .map(id => ({ id, excluded: !track.keep.includes(id) }))
    .filter(c => excluded.includes(c.id) !== c.excluded);
}
