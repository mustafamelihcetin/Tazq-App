import { reliefFactorFor, type StudyRelief } from '@/features/modes/utils/ramadanBrain';
import { blueprintFor } from '../data/blueprints';
import {
  applyBlock, assessFit, Block, CapFn, coverage, dayKeyOf, dayNum, emptyUnitState, ensureTopics, ExamUnit, FitStatus, planAll, PlanTopic, project, splitShares, Projection, StartLevel, UnitState,
} from './scheduler';
import type { MockRecord } from './mockScore';

/*
  PLAN DURUMU (2026-11-05). Saf çekirdek: store yalnız bunu saklar. Sıra hep aynı: görevlerden işaretleri al → biten günleri kapat →
  gerekirse yeniden kur → 7 günü sabitle.

  BUGÜN GERİ ALINABİLİR: bir günün işaretleri o gün kapanana kadar konu durumuna yazılmaz; görevi geri alan kullanıcı planı bozmaz.
  VERİ: tam olay günlüğü değil, konu başına özet; User.Preferences 200 KB ile sınırlı.
*/
export interface StudyBlock extends Block { id: string; planKey: string; done: boolean; skipped?: boolean; }
export interface CourseTopic { id: string; name: string; }
export interface Course { id: string; name: string; date: string; topics: CourseTopic[]; }
/** Elle eklenen konunun ve dersin kaydı. Hazır liste kopyalanmaz: yalnız kullanıcının farkı saklanır, sunucuda çok az yer tutar. */
export type TopicWeight = 'low' | 'mid' | 'high';
export interface CustomTopic { id: string; name: string; subject: string; }
export interface CustomSubject { id: string; name: string; }
export const TOPIC_NAME_MAX = 60;
export const CUSTOM_TOPICS_MAX = 60;
export const CUSTOM_SUBJECTS_MAX = 10;
/** Az soru yarım, çok soru bir buçuk kat pay ve süre alır. */
const WEIGHT_FACTOR: Record<TopicWeight, number> = { low: 0.5, mid: 1, high: 1.5 };

export interface PlanRecord {
  key: string;
  name: string;
  /** Şu an bağlı olduğu slot. null: kapalı ama ilerleme saklı, aynı sınav yeniden kurulursa geri gelir. */
  slot: string | null;
  paused?: boolean;
  examDate: string;
  levels: Record<string, StartLevel>;
  excluded: string[];
  /** Bilerek silinen denemeler: cihazlar arası birleşmede geri dönmesin. */
  removedMocks?: string[];
  courses?: Course[];
  customTopics?: CustomTopic[];
  customSubjects?: CustomSubject[];
  /** Yalnız orta dışındakiler yazılır. */
  weights?: Record<string, TopicWeight>;
  states: Record<string, UnitState>;
  mocks: MockRecord[];
  createdAt: number;
  /** Kurulumda seçilen zayıf konular. */
  weakIds?: string[];
  /** Kurulum kartındaki son süre: oradan değişirse hafta güncellenir. */
  lastDaily?: number | null;
  /** "Bildiklerini işaretle" ipucu yalnız bir kez. */
  reviewed?: boolean;
  at: number;
}

export type StudyNotice = { type: 'return'; days: number } | { type: 'unmarked'; days: number } | { type: 'date'; planKey: string } | null;

export interface StudyCore {
  /** Günlük dakika, JS gün sırası (0: Pazar). null: henüz kurulmadı. */
  week: number[] | null;
  weekAt: number;
  closed: string[];
  plans: Record<string, PlanRecord>;
  committed: Record<string, StudyBlock[]>;
  dayStats: Record<string, [number, number]>;
  lastActive: string | null;
  /** Ramazan düzeni açıkken süresi kısılan dönem. Cihaz başına hesaplanır, buluta gitmez. */
  relief?: StudyRelief | null;
  missed: (StudyBlock & { day: string })[];
  notice: StudyNotice;
  /** Bu gün yeniden bölünecek: yapılanlar durur, kalan süre yeniden planlanır. Yalnız bir hesaplık işaret, saklanmaz. */
  refill?: string;
}

export const emptyCore = (): StudyCore => ({ week: null, weekAt: 0, closed: [], plans: {}, committed: {}, dayStats: {}, lastActive: null, missed: [], notice: null });

export interface SlotInput { slot: string; name: string; date: string; paused?: boolean; dailyMinutes?: number | null; weakTopicIds?: string[]; }

const COMMIT_DAYS = 7;
const RETURN_GAP = 3;
const STATS_KEEP = 120;
const COURSE_TOPIC_HOURS = 6;
const MAX_DAY_MIN = 600;
const COURSE_MOCK_MIN = 60;
export const jsDayOf = (num: number) => (((num + 4) % 7) + 7) % 7;

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export const makeId = (name: string) => hash(name.trim().toLocaleLowerCase('tr'));

export function planKeyFor(name: string): string {
  const bp = blueprintFor(name);
  return bp ? bp.examId : `custom_${makeId(name)}`;
}

export const courseUnitId = (key: string, courseId: string) => `${key}__${courseId}`;

const weighed = (t: PlanTopic, plan: PlanRecord): PlanTopic => {
  const w = plan.weights?.[t.id];
  if (!w || w === 'mid') return t;
  const f = WEIGHT_FACTOR[w];
  return { ...t, q: t.q * f, hours: Math.max(1, Math.round(t.hours * f)) };
};

/** Elle eklenen konu, dersinin ortalamasıyla başlar: tek konu planı bozmaz, ağırlığı sonra değişir. */
function customPlanTopics(plan: PlanRecord, known: PlanTopic[], subjects?: string[]): PlanTopic[] {
  const avg = (list: PlanTopic[], f: (t: PlanTopic) => number, or: number) => (list.length ? list.reduce((a, t) => a + f(t), 0) / list.length : or);
  return (plan.customTopics ?? [])
    .filter(t => !plan.excluded.includes(t.id) && !plan.excluded.includes(t.subject) && (!subjects || subjects.includes(t.subject)))
    .map(t => {
      const same = known.filter(k => k.subject === t.subject);
      const pool = same.length ? same : known;
      return { id: t.id, subject: t.subject, q: avg(pool, k => k.q, 1), hours: Math.max(1, Math.round(avg(pool, k => k.hours, COURSE_TOPIC_HOURS))), kind: 'beceri' as const };
    });
}

export function unitsOfPlan(plan: PlanRecord): ExamUnit[] {
  const bp = blueprintFor(plan.name);
  if (bp) {
    const topics = bp.topics.filter(t => !plan.excluded.includes(t.id) && !plan.excluded.includes(t.subject));
    const all = [...topics, ...customPlanTopics(plan, topics)].map(t => weighed(t, plan));
    return all.length && plan.examDate ? [{ id: plan.key, topics: all, mockMin: bp.mockMin, examDay: dayNum(plan.examDate) }] : [];
  }
  return (plan.courses ?? [])
    .filter(c => c.date)
    .map((c): ExamUnit => {
      const own: PlanTopic[] = c.topics.filter(t => !plan.excluded.includes(t.id)).map(t => ({ id: t.id, subject: c.id, q: 1, hours: COURSE_TOPIC_HOURS, kind: 'beceri' }));
      const topics = [...own, ...customPlanTopics(plan, own, [c.id])].map(t => weighed(t, plan));
      return { id: courseUnitId(plan.key, c.id), topics, mockMin: COURSE_MOCK_MIN, examDay: dayNum(c.date) };
    })
    .filter(u => u.topics.length > 0);
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr');

/** null: eklenemedi (boş ad, aynı ad ya da sınır). */
export function addCustomTopic(plan: PlanRecord, subject: string, name: string, weight: TopicWeight): PlanRecord | null {
  const clean = name.trim().slice(0, TOPIC_NAME_MAX);
  const list = plan.customTopics ?? [];
  if (!clean || list.length >= CUSTOM_TOPICS_MAX) return null;
  if (list.some(t => t.subject === subject && sameName(t.name, clean))) return null;
  const known = blueprintFor(plan.name);
  if (known?.topics.some(t => t.subject === subject && sameName(known.labels[t.id]?.tr ?? '', clean))) return null;
  const id = `c_${makeId(`${subject}/${clean}`)}`;
  const weights = { ...(plan.weights ?? {}) };
  if (weight === 'mid') delete weights[id]; else weights[id] = weight;
  return { ...plan, customTopics: [...list, { id, name: clean, subject }], weights };
}

export function addCustomSubject(plan: PlanRecord, name: string): PlanRecord | null {
  const clean = name.trim().slice(0, TOPIC_NAME_MAX);
  const list = plan.customSubjects ?? [];
  if (!clean || list.length >= CUSTOM_SUBJECTS_MAX || list.some(s => sameName(s.name, clean))) return null;
  if (blueprintFor(plan.name)?.subjects.some(s => sameName(s.tr, clean) || sameName(s.en, clean))) return null;
  return { ...plan, customSubjects: [...list, { id: `s_${makeId(clean)}`, name: clean }] };
}

export function setTopicWeight(plan: PlanRecord, id: string, weight: TopicWeight): PlanRecord {
  const weights = { ...(plan.weights ?? {}) };
  if (weight === 'mid') delete weights[id]; else weights[id] = weight;
  return { ...plan, weights };
}

/** Konu izsiz gider: ağırlığı ve durumu da silinir, buluta artık taşınmaz. */
export function removeCustomTopic(plan: PlanRecord, id: string): PlanRecord {
  const weights = { ...(plan.weights ?? {}) };
  delete weights[id];
  const states = Object.fromEntries(Object.entries(plan.states).map(([k, u]) => {
    if (!u.topics?.[id]) return [k, u];
    const topics = { ...u.topics };
    delete topics[id];
    return [k, { ...u, topics }];
  }));
  return { ...plan, customTopics: (plan.customTopics ?? []).filter(t => t.id !== id), weights, states };
}

/** Konusu yoksa görevler eski motordan gelir; ekran "konularını ekle" der. */
export const planHasContent = (plan: PlanRecord) => unitsOfPlan(plan).length > 0;

function activeUnits(core: StudyCore): { units: ExamUnit[]; states: Record<string, UnitState> } {
  const units: ExamUnit[] = [];
  const states: Record<string, UnitState> = {};
  for (const p of Object.values(core.plans)) {
    if (!p.slot || p.paused) continue;
    for (const u of unitsOfPlan(p)) { units.push(u); states[u.id] = p.states[u.id] ?? emptyUnitState(); }
  }
  return { units, states };
}

export function capOf(core: Pick<StudyCore, 'week' | 'closed'> & Partial<Pick<StudyCore, 'relief' | 'plans'>>): CapFn {
  const closed = new Set(core.closed);
  const week = core.week ?? [90, 90, 90, 90, 90, 90, 90];
  const exams = Object.values(core.plans ?? {}).filter(p => p.slot && p.examDate).map(p => p.examDate as string);
  // Ramazan düzeni: takvim dönemin neresinde ne kadar çalışılacağını baştan bilir; sınav yakınsa kısmaz (bkz. ramadanBrain).
  return (d: number) => (closed.has(dayKeyOf(d)) ? 0 : Math.round(week[jsDayOf(d)] * reliefFactorFor(dayKeyOf(d), core.relief, exams, dayNum)));
}

export function adherenceOf(stats: StudyCore['dayStats']): number {
  const days = Object.keys(stats).sort().slice(-14);
  let p = 0, d = 0;
  for (const k of days) { p += stats[k][0]; d += stats[k][1]; }
  if (p < 180) return 0.75;
  return Math.max(0.3, Math.min(1, d / p));
}

export function planOfUnit(core: StudyCore, unitId: string): PlanRecord | undefined {
  return core.plans[unitId] ?? Object.values(core.plans).find(p => unitId.startsWith(`${p.key}__`));
}

const LETTER: Record<Block['type'], string> = { yeni: 'y', tekrar: 't', pratik: 'p', deneme: 'd', analiz: 'a', hafif: 'h' };
const FROM_LETTER: Record<string, Block['type']> = { y: 'yeni', t: 'tekrar', p: 'pratik', d: 'deneme', a: 'analiz', h: 'hafif' };

/** Bloğun kimliği aynı zamanda görev etiketidir; tüm bilgiyi taşır ki başka cihazda açılan görev de tanınsın. */
export function blockTag(day: string, b: Pick<Block, 'type' | 'topicId' | 'unitId' | 'min'>): string {
  return `sb_${day.replace(/-/g, '')}_${LETTER[b.type]}_${Math.round(b.min)}_${b.topicId ?? b.unitId}`;
}
export function parseBlockTag(tag: string): { day: string; type: Block['type']; min: number; ref: string } | null {
  const m = /^sb_(\d{4})(\d{2})(\d{2})_([ytpdah])_(\d+)_(.+)$/.exec(tag);
  return m ? { day: `${m[1]}-${m[2]}-${m[3]}`, type: FROM_LETTER[m[4]], min: Number(m[5]), ref: m[6] } : null;
}

function withTopics(plan: PlanRecord, unit: ExamUnit, at: number, day: number): UnitState {
  const st = ensureTopics(unit, plan.states[unit.id] ?? emptyUnitState(), t => plan.levels[t.subject] ?? 'yok', at, day);
  const pending = (plan.weakIds ?? []).filter(id => st.topics[id] && !st.topics[id].weak && !st.topics[id].rated);
  if (!pending.length) return st;
  const topics = { ...st.topics };
  for (const id of pending) topics[id] = { ...topics[id], weak: true };
  return { ...st, topics };
}

function applyDone(plan: PlanRecord, unit: ExamUnit, b: Block, day: number, at: number): PlanRecord {
  return { ...plan, states: { ...plan.states, [unit.id]: applyBlock(unit, withTopics(plan, unit, at, day), b, day, at) } };
}

/** Bugünün yapılmışları dahil güncel durum: ekranlar ve geleceğin hesabı bunu okur. */
export function effectiveStates(core: StudyCore, today: string): { units: ExamUnit[]; states: Record<string, UnitState> } {
  const { units } = activeUnits(core);
  const n = dayNum(today);
  const out: Record<string, UnitState> = {};
  for (const u of units) { const p = planOfUnit(core, u.id) as PlanRecord; out[u.id] = withTopics(p, u, 0, n); }
  for (const b of core.committed[today] ?? []) {
    if (!b.done) continue;
    const u = units.find(x => x.id === b.unitId);
    if (u) out[u.id] = applyBlock(u, out[u.id], b, n, 0);
  }
  return { units, states: out };
}

/** Biten günler kapanır: yapılan konuya yazılır, yapılmayan yalnız not edilir; hiçbir iş sonraki güne yığılmaz. */
function settle(core: StudyCore, today: string, now: number): StudyCore {
  const pastDays = Object.keys(core.committed).filter(k => k < today).sort();
  if (!pastDays.length) return core;
  let plans = core.plans;
  const committed = { ...core.committed };
  const dayStats = { ...core.dayStats };
  let lastActive = core.lastActive;
  let missed = core.missed;
  for (const day of pastDays) {
    const blocks = committed[day];
    delete committed[day];
    const n = dayNum(day);
    let planned = 0, done = 0;
    for (const b of blocks) {
      if (b.skipped) continue;
      planned += b.min;
      if (!b.done) { missed = [...missed, { ...b, day }]; continue; }
      done += b.min;
      const plan = plans[b.planKey];
      const unit = plan ? unitsOfPlan(plan).find(u => u.id === b.unitId) : undefined;
      if (plan && unit) plans = { ...plans, [plan.key]: applyDone(plan, unit, b, n, now) };
    }
    if (planned > 0) dayStats[day] = [planned, done];
    if (done > 0) {
      lastActive = !lastActive || day > lastActive ? day : lastActive;
      for (const key of Object.keys(plans)) {
        const states = { ...plans[key].states };
        let touched = false;
        for (const id of Object.keys(states)) if (states[id].returnLeft > 0) { states[id] = { ...states[id], returnLeft: states[id].returnLeft - 1 }; touched = true; }
        if (touched) plans = { ...plans, [key]: { ...plans[key], states } };
      }
    }
  }
  const keepFrom = dayKeyOf(dayNum(today) - 7);
  missed = missed.filter(m => m.day >= keepFrom);
  const statKeys = Object.keys(dayStats).sort();
  for (const k of statKeys.slice(0, Math.max(0, statKeys.length - STATS_KEEP))) delete dayStats[k];
  return { ...core, plans, committed, dayStats, lastActive, missed };
}

/** Eksik günleri sabitler. Var olan gün değişmez. */
/**
 * Aynı gün aynı konunun iki açık bloğu tek satır olur (2026-11-05, cihazda "Harita ve Şema 34 dk" ile "27 dk"). Bitmiş blok dokunulmaz: yapılan iş yapılmış kalır.
 * Süre değişince kimlik de değişir; eski görevi orphanTodayTaskIds kaldırır, yenisi süresiyle gelir.
 */
export function mergeOpenBlocks(list: StudyBlock[], today: string): StudyBlock[] {
  const out: StudyBlock[] = [];
  for (const b of list) {
    const same = !b.done && !b.skipped && b.topicId ? out.find(x => !x.done && !x.skipped && x.type === b.type && x.topicId === b.topicId && x.unitId === b.unitId) : null;
    if (!same) { out.push(b); continue; }
    same.min += b.min;
    same.id = blockTag(today, same);
  }
  return out;
}

function commit(input: StudyCore, today: string): StudyCore {
  const { refill, ...core } = input;
  const { units, states } = effectiveStates(core, today);
  if (!units.length) return core;
  const n = dayNum(today);
  const cap = capOf(core);
  const adh = adherenceOf(core.dayStats);
  let cur = states;
  const committed = { ...core.committed };
  const kept = committed[today];
  // Yapılmış iş varken plan değişti: kalan süre yeni plana gider. "Bugün olmaz" dendiyse üstüne iş eklenmez.
  if (refill === today && kept?.length && !kept.some(b => b.skipped)) {
    const left = cap(n) - kept.reduce((a, b) => a + b.min, 0);
    const taken = new Set(kept.map(b => b.id));
    const extra = left >= 10 ? planAll(units, states, n, d => (d === n ? left : cap(d)), adh) : [];
    committed[today] = mergeOpenBlocks([...kept, ...extra
      .map((b): StudyBlock => ({ ...b, id: blockTag(today, b), planKey: planOfUnit(core, b.unitId)?.key ?? b.unitId, done: false }))
      .filter(b => !taken.has(b.id))], today);
  }
  for (let d = n; d < n + COMMIT_DAYS; d++) {
    const key = dayKeyOf(d);
    if (!committed[key]) {
      const seen = new Set<string>();
      committed[key] = planAll(units, cur, d, cap, adh)
        .map((b): StudyBlock => ({ ...b, id: blockTag(key, b), planKey: planOfUnit(core, b.unitId)?.key ?? b.unitId, done: false }))
        .filter(b => (seen.has(b.id) ? false : (seen.add(b.id), true)));
    }
    const next = { ...cur };
    for (const b of committed[key]) {
      if ((d === n && b.done) || b.skipped) continue; // bugünün yapılmışları effectiveStates'te sayıldı
      const u = units.find(x => x.id === b.unitId);
      if (u) next[u.id] = applyBlock(u, next[u.id], b, d, 0);
    }
    cur = next;
  }
  return { ...core, committed };
}

/** Geleceği sıfırlar. Bugünün yapılmışları durur; bugünün kalanı yalnız `withToday` ise değişir. */
export function invalidate(core: StudyCore, today: string, withToday = false): StudyCore {
  const committed: StudyCore['committed'] = {};
  for (const [k, blocks] of Object.entries(core.committed)) {
    if (k < today) committed[k] = blocks;
    else if (k === today) {
      if (!withToday) committed[k] = blocks;
      else { const keep = blocks.filter(b => b.done || b.skipped); if (keep.length) committed[k] = keep; }
    }
  }
  return { ...core, committed, ...(withToday ? { refill: today } : null) };
}

export function syncCore(input: StudyCore, slots: SlotInput[], today: string, now: number, opts: { replan?: boolean; replanToday?: boolean; relief?: StudyRelief | null } = {}): StudyCore {
  let core = input;
  let replan = !!opts.replan || !!opts.replanToday;
  // Düzen açılınca, kapanınca ya da dönem değişince takvim yeniden kurulur; yapılanlar durur.
  if (opts.relief !== undefined && JSON.stringify(opts.relief) !== JSON.stringify(input.relief ?? null)) { core = { ...core, relief: opts.relief }; replan = true; }
  // Yeni açılan sınav bugünden başlar: gün yeniden bölünür, yapılmış işler durur.
  let replanToday = !!opts.replanToday;
  let notice = core.notice;
  const plans = { ...core.plans };
  const activeKeys = new Set<string>();

  for (const s of slots) {
    if (!s.name.trim() || !s.date) continue;
    const key = planKeyFor(s.name);
    activeKeys.add(key);
    const prev = plans[key];
    if (!prev) {
      plans[key] = { key, name: s.name.trim(), slot: s.slot, paused: !!s.paused, examDate: s.date, levels: {}, excluded: [], states: {}, mocks: [], weakIds: s.weakTopicIds, lastDaily: s.dailyMinutes ?? null, createdAt: now, at: now };
      replan = true;
      replanToday = true;
      continue;
    }
    const dateChanged = prev.examDate !== s.date;
    const pauseChanged = !!prev.paused !== !!s.paused;
    if (dateChanged && prev.slot) notice = { type: 'date', planKey: key };
    const weakChanged = (prev.weakIds ?? []).join() !== (s.weakTopicIds ?? []).join();
    const dailyChanged = s.dailyMinutes != null && prev.lastDaily !== s.dailyMinutes;
    if (dateChanged || pauseChanged || weakChanged || prev.slot !== s.slot) replan = true;
    if (!prev.slot && s.slot) replanToday = true;
    if (dateChanged || pauseChanged || weakChanged || dailyChanged || prev.slot !== s.slot || prev.name !== s.name.trim()) {
      plans[key] = { ...prev, slot: s.slot, paused: !!s.paused, examDate: s.date, name: s.name.trim(), weakIds: s.weakTopicIds, lastDaily: s.dailyMinutes ?? prev.lastDaily, at: now };
    }
  }
  for (const key of Object.keys(plans)) {
    if (!activeKeys.has(key) && plans[key].slot) { plans[key] = { ...plans[key], slot: null, at: now }; replan = true; }
  }
  /*
    Sınav başına seçilen süreler toplanır: DGS 90 dk + IELTS 45 dk seçen günde 135 dk ayırıyor demektir; ikinci sınav birincinin süresini
    yarıya indirmemeli. Kullanıcı süreyi Ayarlar'dan elle değiştirdiyse (toplama artık uymuyor) kurulum kartı ona dokunmaz.
  */
  const sumDaily = (list: Record<string, PlanRecord>) => Object.values(list).filter(p => p.slot).reduce((a, p) => a + (p.lastDaily ?? 0), 0);
  const before = sumDaily(input.plans);
  const after = sumDaily(plans);
  if (!core.week) {
    const m = Math.min(MAX_DAY_MIN, after || 90);
    core = { ...core, week: [m, m, m, m, m, m, m], weekAt: now };
  } else if (after > 0 && after !== before && core.week.every(v => v === before)) {
    const m = Math.min(MAX_DAY_MIN, after);
    core = { ...core, week: [m, m, m, m, m, m, m], weekAt: now };
    replan = true;
  }
  core = { ...core, plans, notice };

  const hadPast = Object.keys(core.committed).some(k => k < today);
  core = settle(core, today, now);

  if (hadPast && core.missed.length > 0 && core.notice?.type !== 'return' && core.notice?.type !== 'unmarked') {
    if (core.lastActive) {
      // Kopuş: en az RETURN_GAP gün hiçbir iş yapılmadı.
      const gap = dayNum(today) - dayNum(core.lastActive) - 1;
      if (gap >= RETURN_GAP) {
        const nextPlans = { ...core.plans };
        for (const p of Object.values(nextPlans)) {
          if (!p.slot) continue;
          const st = { ...p.states };
          for (const u of unitsOfPlan(p)) st[u.id] = { ...(st[u.id] ?? emptyUnitState()), returnLeft: 3 };
          nextPlans[p.key] = { ...p, states: st };
        }
        core = { ...core, plans: nextPlans, notice: { type: 'return', days: gap } };
        replan = true;
      }
    } else {
      // Hiç işaretlemeyen kullanıcı: plan sessizce ilerlemez, sorulur.
      const days = new Set(core.missed.map(m => m.day)).size;
      if (days >= RETURN_GAP) core = { ...core, notice: { type: 'unmarked', days } };
    }
  }

  if (replan) core = invalidate(core, today, replanToday);
  return commit(core, today);
}

/** Görevlerden gelen işaretler. Başka cihazın açtığı görev de tanınır. */
export function reconcileTasks(core: StudyCore, tasks: { tags?: string[] | null; isCompleted?: boolean }[], today: string): StudyCore {
  let changed = false;
  const committed = { ...core.committed };
  for (const t of tasks) {
    for (const tag of t.tags ?? []) {
      if (!tag.startsWith('sb_')) continue;
      const parsed = parseBlockTag(tag);
      if (!parsed) continue;
      const list = committed[parsed.day];
      const i = (list ?? []).findIndex(b => b.id === tag);
      if (i >= 0) {
        if (list[i].done !== !!t.isCompleted) { committed[parsed.day] = list.map((b, k) => (k === i ? { ...b, done: !!t.isCompleted } : b)); changed = true; }
      } else if (parsed.day === today) {
        const adopted = adoptBlock({ ...core, committed }, tag, parsed, !!t.isCompleted, today);
        if (adopted) { committed[today] = [...(committed[today] ?? []), adopted]; changed = true; }
      }
    }
  }
  return changed ? { ...core, committed } : core;
}

function adoptBlock(core: StudyCore, tag: string, p: NonNullable<ReturnType<typeof parseBlockTag>>, done: boolean, today: string): StudyBlock | null {
  const { units } = activeUnits(core);
  const isTopic = p.type === 'yeni' || p.type === 'tekrar' || p.type === 'pratik';
  const unit = isTopic ? units.find(u => u.topics.some(t => t.id === p.ref)) : units.find(u => u.id === p.ref);
  if (!unit) return null;
  const topic = isTopic ? unit.topics.find(t => t.id === p.ref) : undefined;
  // Aynı iş bugün zaten planda (süresi farklı): bu, plan değişmeden önce açılmış eski görevdir, ikinci blok olmaz.
  if ((core.committed[today] ?? []).some(b => b.type === p.type && b.unitId === unit.id && b.topicId === topic?.id)) return null;
  return { id: tag, type: p.type, unitId: unit.id, topicId: topic?.id, subject: topic?.subject, min: p.min, planKey: planOfUnit(core, unit.id)?.key ?? unit.id, done };
}

export function setBlockDone(core: StudyCore, day: string, id: string, done: boolean): StudyCore {
  const list = core.committed[day];
  if (!list) return core;
  return { ...core, committed: { ...core.committed, [day]: list.map(b => (b.id === id ? { ...b, done, skipped: done ? false : b.skipped } : b)) } };
}

export function skipBlock(core: StudyCore, day: string, id: string, skipped = true): StudyCore {
  const list = core.committed[day];
  if (!list) return core;
  return { ...core, committed: { ...core.committed, [day]: list.map(b => (b.id === id ? { ...b, skipped, done: false } : b)) } };
}

/** Erken bitiren için isteğe bağlı bir blok: yük kendiliğinden artmaz, kullanıcı ister. */
export function addExtraBlock(core: StudyCore, today: string): StudyCore {
  const { units, states } = effectiveStates(core, today);
  const n = dayNum(today);
  const taken = new Set((core.committed[today] ?? []).map(b => b.topicId).filter(Boolean));
  for (const u of units) {
    if (u.examDay <= n + 1) continue;
    const rest: ExamUnit = { ...u, topics: u.topics.filter(t => !taken.has(t.id)) };
    const blocks = planAll([rest], { [u.id]: { ...states[u.id], lastMock: n, practice: [] } }, n, () => 50);
    const b = blocks.find(x => x.topicId);
    if (b) {
      const block: StudyBlock = { ...b, id: blockTag(today, b), planKey: planOfUnit(core, u.id)?.key ?? u.id, done: false };
      return { ...core, committed: { ...core.committed, [today]: [...(core.committed[today] ?? []), block] } };
    }
  }
  return core;
}

/** "Son günlerde çalıştım, işaretlemedim." Kaçan bloklar kendi günlerine yazılır. */
export function confirmMissed(core: StudyCore, today: string, now: number): StudyCore {
  let plans = core.plans;
  let lastActive = core.lastActive;
  for (const m of [...core.missed].sort((a, b) => a.day.localeCompare(b.day))) {
    const plan = plans[m.planKey];
    const unit = plan ? unitsOfPlan(plan).find(u => u.id === m.unitId) : undefined;
    if (!plan || !unit) continue;
    const n = dayNum(m.day);
    const applied = applyDone(plan, unit, m, n, now);
    plans = { ...plans, [plan.key]: { ...applied, states: { ...applied.states, [unit.id]: { ...applied.states[unit.id], returnLeft: 0 } } } };
    if (!lastActive || m.day > lastActive) lastActive = m.day;
  }
  return commit(invalidate({ ...core, plans, lastActive, missed: [], notice: null }, today), today);
}

export const dismissNotice = (core: StudyCore): StudyCore => ({ ...core, notice: null, missed: core.notice?.type === 'unmarked' ? [] : core.missed });

export interface PlanView {
  fit: FitStatus;
  outTopics: string[];
  coverage: number;
  projection: Projection;
}

/** Ekran ve takvim için görünüm: yakın gün sabit, uzak gün tahmin. */
export function viewOf(core: StudyCore, today: string): PlanView {
  const { units, states } = effectiveStates(core, today);
  const n = dayNum(today);
  const cap = capOf(core);
  const adh = adherenceOf(core.dayStats);
  const fixed: Record<number, Block[]> = {};
  for (const [k, list] of Object.entries(core.committed)) if (k > today) fixed[dayNum(k)] = list.filter(b => !b.skipped);
  // Bugünün yapılmışları durumda sayıldı; kalanı yapılacak varsayılır.
  fixed[n] = (core.committed[today] ?? []).filter(b => !b.done && !b.skipped);
  const projection = project(units, states, n, cap, fixed, adh);
  // Sığma, planın gerçekten kullandığı payla hesaplanır (bkz. splitShares).
  const shares = splitShares(units, states, n);
  const reports = units.map(u => assessFit(u, states[u.id], n, d => cap(d) * (shares[u.id] ?? 1), adh));
  const fit: FitStatus = reports.some(r => r.status === 'over') ? 'over' : reports.some(r => r.status === 'tight') ? 'tight' : 'fits';
  const total = units.reduce((a, u) => a + u.topics.length, 0) || 1;
  return { fit, outTopics: reports.flatMap(r => r.out), coverage: units.reduce((a, u) => a + coverage(u, states[u.id]) * u.topics.length, 0) / total, projection };
}

/** Bulut kopyası: yalnız kalıcı özet. Takvim cihazda yeniden hesaplanır. */
export interface StudyCloud { week: number[] | null; weekAt: number; closed: string[]; lastActive: string | null; plans: Record<string, Omit<PlanRecord, 'slot' | 'paused'>>; }

/**
 * Deneme kaydı kaybolmaz (2026-11-05, kullanıcı: "kaybolmayacağından emin ol"). Eskiden buluta son 40 gidiyor, yeni cihazda eskiler yok oluyordu.
 * Hepsi gider; 60'tan eskilerin yalnız yanlış nedeni ayrıntısı düşer, puan ve tarih kalır. Boyut sunucu sınırının çok altında kalır (bkz. test).
 */
const MOCK_DETAIL_KEEP = 60;
export function cloudMocks(mocks: MockRecord[]): MockRecord[] {
  const cut = mocks.length - MOCK_DETAIL_KEEP;
  return mocks.map((m, i) => (i < cut ? { ...m, misses: undefined } : m));
}

export function toCloud(core: StudyCore): StudyCloud {
  const plans: StudyCloud['plans'] = {};
  for (const p of Object.values(core.plans)) {
    const { slot: _s, paused: _p, ...rest } = p;
    const states: Record<string, UnitState> = {};
    for (const [k, s] of Object.entries(p.states)) states[k] = { ...s, hist: {} };
    plans[p.key] = { ...rest, states, mocks: cloudMocks(p.mocks) };
  }
  return { week: core.week, weekAt: core.weekAt, closed: core.closed, lastActive: core.lastActive, plans };
}

function mergeUnit(a: UnitState | undefined, b: UnitState): UnitState {
  if (!a) return b;
  const topics = { ...a.topics };
  for (const [id, t] of Object.entries(b.topics ?? {})) if (!topics[id] || t.at > topics[id].at) topics[id] = t;
  const subMin = { ...a.subMin };
  for (const [k, v] of Object.entries(b.subMin ?? {})) subMin[k] = Math.max(subMin[k] ?? 0, v);
  const mocks = [a.lastMock, b.lastMock].filter((x): x is number => x != null);
  return { ...a, topics, subMin, lastMock: mocks.length ? Math.max(...mocks) : null };
}

/** Birleştirme yalnız yenisini alır: boş bulut dolu yereli asla silmez. */
export function mergeCloud(core: StudyCore, cloud: StudyCloud | null | undefined): StudyCore {
  if (!cloud || typeof cloud !== 'object' || !cloud.plans) return core;
  const plans = { ...core.plans };
  for (const [key, c] of Object.entries(cloud.plans)) {
    const l = plans[key];
    if (!l) { plans[key] = { ...c, slot: null }; continue; }
    const states = { ...l.states };
    for (const [id, s] of Object.entries(c.states ?? {})) states[id] = mergeUnit(states[id], s);
    // Silinen deneme başka cihazın kopyasından geri dönmez; silinmeyen hiçbir kayıt düşmez.
    const removed = [...new Set([...(l.removedMocks ?? []), ...(c.removedMocks ?? [])])];
    const mocks = [...l.mocks];
    for (const m of c.mocks ?? []) if (!mocks.some(x => x.id === m.id)) mocks.push(m);
    mocks.sort((a, b) => a.day.localeCompare(b.day));
    const newer = c.at > l.at;
    plans[key] = { ...l, ...(newer ? { levels: c.levels, excluded: c.excluded, courses: c.courses, reviewed: c.reviewed, customTopics: c.customTopics, customSubjects: c.customSubjects, weights: c.weights } : null), states, mocks: mocks.filter(m => !removed.includes(m.id)), removedMocks: removed, at: Math.max(l.at, c.at) };
  }
  const lastActive = [core.lastActive, cloud.lastActive].filter((x): x is string => !!x).sort().pop() ?? null;
  const newerWeek = cloud.weekAt > core.weekAt && cloud.week;
  return { ...core, plans, lastActive, ...(newerWeek ? { week: cloud.week, weekAt: cloud.weekAt, closed: cloud.closed ?? core.closed } : null) };
}
