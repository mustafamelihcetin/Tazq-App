import type { CreateTaskPayload } from '@/shared/services/api';
import { blueprintFor } from '../data/blueprints';
import type { PlanRecord, StudyBlock } from './planCore';
import { parseBlockTag, planOfUnit, StudyCore } from './planCore';

/*
  GÖREV KÖPRÜSÜ (2026-11-05). Plan bloğu, normal bir görev olarak Bugün listesine iner; etiketi bloğun kimliğidir. Biten görev bloğu
  işaretler. Dünden kalan plan görevi "gecikmiş" olmaz, kaldırılır: iş yığılmaz, plan kendini yeniden kurar.
*/
type L = 'tr' | 'en';

const VERB: Record<L, Record<StudyBlock['type'], string>> = {
  tr: { yeni: 'çalış', tekrar: 'tekrar', pratik: 'süreli pratik', deneme: 'deneme', analiz: 'deneme analizi', hafif: 'hafif tekrar' },
  en: { yeni: 'study', tekrar: 'review', pratik: 'timed practice', deneme: 'practice test', analiz: 'test review', hafif: 'light review' },
};
const MIN_UNIT: Record<L, string> = { tr: 'dk', en: 'min' };

export function topicName(plan: PlanRecord | undefined, topicId: string | undefined, lang: L): string {
  if (!plan || !topicId) return '';
  const label = blueprintFor(plan.name)?.labels[topicId];
  if (label) return label[lang];
  for (const c of plan.courses ?? []) { const t = c.topics.find(x => x.id === topicId); if (t) return t.name; }
  return '';
}

export function courseOfUnit(plan: PlanRecord | undefined, unitId: string): string | null {
  return plan?.courses?.find(c => unitId.endsWith(`__${c.id}`))?.name ?? null;
}

export function blockTitle(b: Pick<StudyBlock, 'type' | 'topicId' | 'min' | 'unitId'>, plan: PlanRecord | undefined, lang: L): string {
  const owner = courseOfUnit(plan, b.unitId) ?? plan?.name ?? '';
  const topic = topicName(plan, b.topicId, lang);
  const verb = VERB[lang][b.type];
  const what = topic ? `${topic} ${verb}` : verb;
  return `${owner} · ${what} · ${Math.round(b.min)} ${MIN_UNIT[lang]}`;
}

const todayAt9 = (today: string) => `${today}T09:00:00`;

/** Bugünün açık blokları görev olur. Bütçe kadarı listeye iner; kalanı plan ekranında durur. */
export function blocksToTasks(blocks: StudyBlock[], core: StudyCore, today: string, slot: string, cap: number, lang: L = 'tr'): CreateTaskPayload[] {
  return blocks.filter(b => !b.done && !b.skipped).slice(0, cap).map((b, i) => {
    const plan = planOfUnit(core, b.unitId);
    const titleTr = blockTitle(b, plan, 'tr');
    const titleEn = blockTitle(b, plan, 'en');
    return { title: lang === 'tr' ? titleTr : titleEn, titleTr, titleEn, description: JSON.stringify({ tr: titleTr, en: titleEn }), priority: i === 0 ? 'High' : 'Medium', dueDate: new Date(todayAt9(today)).toISOString(), isCompleted: false, tags: [slot, 'daily', 'education', b.id] } as unknown as CreateTaskPayload;
  });
}

export const isStudyTask = (t: { tags?: string[] | null }) => (t.tags ?? []).some(x => x.startsWith('sb_'));

/** Dünden kalan ve bitmemiş plan görevleri: sessizce kaldırılır, gecikmişe düşmez. */
export function staleStudyTaskIds(tasks: { id: number; tags?: string[] | null; isCompleted?: boolean }[], today: string): number[] {
  return tasks.filter(t => {
    if (t.isCompleted) return false;
    const tag = (t.tags ?? []).find(x => x.startsWith('sb_'));
    const parsed = tag ? parseBlockTag(tag) : null;
    return !!parsed && parsed.day < today;
  }).map(t => t.id);
}

/** Plan değişince bugünün artık planda olmayan görevleri. Yapılmış görev kalır. */
export function orphanTodayTaskIds(tasks: { id: number; tags?: string[] | null; isCompleted?: boolean }[], blocks: StudyBlock[], today: string): number[] {
  const live = new Set(blocks.filter(b => !b.skipped).map(b => b.id));
  return tasks.filter(t => {
    if (t.isCompleted) return false;
    const tag = (t.tags ?? []).find(x => x.startsWith('sb_'));
    const parsed = tag ? parseBlockTag(tag) : null;
    return !!parsed && parsed.day === today && !live.has(tag as string);
  }).map(t => t.id);
}
