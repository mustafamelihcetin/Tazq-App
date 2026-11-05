import type { ScoreModel } from '../data/blueprints';
import type { TopicState, UnitState } from './scheduler';

/*
  DENEME KAYDI (2026-11-05). "Net" evrensel değil: her sınav kendi puan modeliyle kaydedilir. Plana etkisi iki yolla:
  geride kalan ders daha çok süre alır, yanlış nedeni doğru eyleme döner.
*/
export type MissReason = 'bilmiyordum' | 'unuttum' | 'dikkat' | 'sure';

export interface MockSection { correct?: number; wrong?: number; score?: number; }
export interface MockRecord {
  id: string;
  day: string;
  unitId: string;
  /** Ders başına sonuç. */
  sections: Record<string, MockSection>;
  /** Toplam puan (ölçekli/bant/yüzde). */
  total?: number;
  misses?: { topicId: string; reason: MissReason }[];
}

export const netOf = (correct: number, wrong: number, penalty: number) => Math.round((correct - wrong * penalty) * 100) / 100;

/** 0-1 arası başarı: dersleri kıyaslamak için ortak ölçek. */
export function sectionRatio(s: MockSection, score: ScoreModel): number | null {
  if (score.kind === 'net') {
    const c = s.correct ?? 0, w = s.wrong ?? 0;
    if (c + w <= 0) return null;
    return Math.max(0, netOf(c, w, score.penalty) / (c + w));
  }
  if (s.score == null) return null;
  if (score.kind === 'percent') return Math.max(0, Math.min(1, s.score / 100));
  return Math.max(0, Math.min(1, (s.score - score.min) / (score.max - score.min)));
}

export function mockTotal(rec: MockRecord, score: ScoreModel): number | null {
  if (rec.total != null) return rec.total;
  const list = Object.values(rec.sections);
  if (!list.length) return null;
  if (score.kind === 'net') return Math.round(list.reduce((a, s) => a + netOf(s.correct ?? 0, s.wrong ?? 0, score.penalty), 0) * 100) / 100;
  const vals = list.map(s => s.score).filter((v): v is number => v != null);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

export function validScore(v: number, score: ScoreModel): boolean {
  if (!Number.isFinite(v) || v < 0) return false;
  if (score.kind === 'percent') return v <= 100;
  if (score.kind === 'net') return true;
  return v >= score.min && v <= score.max;
}

/** Ortalamanın 10 puan altındaki ders daha çok süre alır; bir sonraki denemede düzelirse çarpan kalkar. */
export function boostsFrom(rec: MockRecord, score: ScoreModel): Record<string, number> {
  const ratios = Object.entries(rec.sections)
    .map(([k, s]) => [k, sectionRatio(s, score)] as const)
    .filter((x): x is readonly [string, number] => x[1] != null);
  if (ratios.length < 2) return {};
  const mean = ratios.reduce((a, [, r]) => a + r, 0) / ratios.length;
  const out: Record<string, number> = {};
  for (const [k, r] of ratios) if (r < mean - 0.1) out[k] = r < mean - 0.25 ? 1.5 : 1.25;
  return out;
}

/** Deneme sonucunu plana işler. Yanlış nedeni: bilmiyordum→yeniden çalış, unuttum→tekrarı öne çek, dikkat/süre→süreli pratik. */
export function applyMock(st: UnitState, rec: MockRecord, score: ScoreModel, day: number, at: number): UnitState {
  const topics: Record<string, TopicState> = { ...st.topics };
  let practice = st.practice;
  for (const m of rec.misses ?? []) {
    const s = topics[m.topicId];
    if (!s) continue;
    if (m.reason === 'bilmiyordum') topics[m.topicId] = { ...s, cov: Math.max(0, Math.min(s.cov, 0.7)), weak: true, due: null, step: 0, at };
    else if (m.reason === 'unuttum') topics[m.topicId] = { ...s, due: day, at };
    else if (!practice.includes(m.topicId)) practice = [...practice, m.topicId];
  }
  return { ...st, topics, practice, boost: boostsFrom(rec, score), lastMock: Math.max(st.lastMock ?? -Infinity, day) };
}
