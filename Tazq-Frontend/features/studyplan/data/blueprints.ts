import { findExamCurriculum, type ExamCurriculum } from '@/shared/utils/curriculum';
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
  /** Ders ağırlığı (verilmezse curriculum weight). */
  subjectQ?: Record<string, number>;
  /** Konu ağırlığı (verilmezse konu weight, ders içinde). */
  topicQ?: Record<string, number>;
  /** Konu saati (verilmezse totalHours ağırlığa göre bölünür). */
  hours?: Record<string, number>;
  totalHours?: number;
  ezberSubjects?: string[];
}

const NET = (penalty = 0.25): ScoreModel => ({ kind: 'net', penalty });

export const EXAM_META: Record<string, ExamMeta> = {
  kpss: {
    mockMin: 130, score: NET(),
    subjectQ: { kpss_turkce: 30, kpss_matematik: 30, kpss_tarih: 27, kpss_cografya: 18, kpss_vatandaslik: 9, kpss_guncel: 6 },
    topicQ: { kpss_turkce_paragraf: 14, kpss_turkce_sozcukte: 4, kpss_turkce_cumlede: 4, kpss_turkce_yazim: 3, kpss_turkce_dilbilgisi: 3, kpss_turkce_anlatim: 2, kpss_mat_islemler: 9, kpss_mat_rasyonel: 6, kpss_mat_oran: 5, kpss_mat_sayilar: 4, kpss_mat_bolme: 3, kpss_mat_geometri: 2, kpss_mat_veri: 1 },
    hours: { kpss_turkce_paragraf: 30, kpss_turkce_sozcukte: 8, kpss_turkce_cumlede: 8, kpss_turkce_yazim: 6, kpss_turkce_dilbilgisi: 12, kpss_turkce_anlatim: 4, kpss_mat_islemler: 36, kpss_mat_rasyonel: 16, kpss_mat_oran: 10, kpss_mat_sayilar: 14, kpss_mat_bolme: 10, kpss_mat_geometri: 18, kpss_mat_veri: 4 },
    totalHours: 340,
    ezberSubjects: ['kpss_tarih', 'kpss_cografya', 'kpss_vatandaslik', 'kpss_guncel'],
  },
  dgs: {
    mockMin: 135, score: NET(),
    subjectQ: { dgs_sozel: 50, dgs_sayisal: 50 },
    topicQ: { dgs_sozel_anlam: 14, dgs_sozel_paragraf: 24, dgs_sozel_mantik: 12, dgs_sayisal_islemler: 12, dgs_sayisal_problem: 20, dgs_sayisal_geometri: 12, dgs_sayisal_veri: 6 },
    hours: { dgs_sozel_anlam: 16, dgs_sozel_paragraf: 28, dgs_sozel_mantik: 18, dgs_sayisal_islemler: 34, dgs_sayisal_problem: 44, dgs_sayisal_geometri: 36, dgs_sayisal_veri: 8 },
  },
  yks: { mockMin: 165, score: NET(), subjectQ: { yks_turkce: 40, yks_matematik: 40, yks_fen: 20, yks_sosyal: 20 }, totalHours: 600, ezberSubjects: ['yks_sosyal'] },
  ales: { mockMin: 150, score: NET(), subjectQ: { ales_sozel: 50, ales_sayisal: 50 }, totalHours: 150 },
  lgs: { mockMin: 155, score: NET(1 / 3), subjectQ: { lgs_turkce: 20, lgs_matematik: 20, lgs_fen: 20, lgs_inkilap: 10, lgs_din: 10, lgs_ingilizce: 10 }, totalHours: 400, ezberSubjects: ['lgs_inkilap', 'lgs_din'] },
  yds: { mockMin: 180, score: NET(0), totalHours: 200 },
  ielts: { mockMin: 165, score: { kind: 'band', min: 0, max: 9, step: 0.5 }, totalHours: 120 },
  toefl: { mockMin: 120, score: { kind: 'scaled', min: 0, max: 120 }, totalHours: 120 },
  pte: { mockMin: 120, score: { kind: 'scaled', min: 10, max: 90 }, totalHours: 100 },
  det: { mockMin: 60, score: { kind: 'scaled', min: 10, max: 160 }, totalHours: 60 },
  gre: { mockMin: 118, score: { kind: 'scaled', min: 260, max: 340 }, totalHours: 120 },
  gmat: { mockMin: 135, score: { kind: 'scaled', min: 205, max: 805 }, totalHours: 120 },
  sat: { mockMin: 134, score: { kind: 'scaled', min: 400, max: 1600 }, subjectQ: { sat_rw: 54, sat_math: 44 }, totalHours: 120 },
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
  const totalQ = cur.subjects.reduce((a, s) => a + (meta.subjectQ?.[s.id] ?? s.weight ?? 1), 0) || 1;
  const totalHours = meta.totalHours ?? CATEGORY_HOURS[preset?.category ?? 'other'];
  const topics: PlanTopic[] = [];
  const labels: ExamBlueprint['labels'] = {};
  for (const s of cur.subjects) {
    const subjectShare = (meta.subjectQ?.[s.id] ?? s.weight ?? 1) / totalQ;
    const list = s.topics?.length ? s.topics : [{ id: s.id, tr: s.tr, en: s.en }];
    const weightOf = (t: { id: string; weight?: number }) => meta.topicQ?.[t.id] ?? t.weight ?? 1;
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
