import { buildDailyTasks, hasDailyToday, adaptiveTaskCount, DailyPlanSpec } from '../utils/dailyPlanEngine';

describe('adaptiveTaskCount (adaptif zorluk — yalnız hafifletir)', () => {
  it('returns base when no signal', () => {
    expect(adaptiveTaskCount(3)).toBe(3);
  });
  it('returns base when not enough history (<4 in 14d)', () => {
    expect(adaptiveTaskCount(3, { activeDays7: 0, total14: 2 })).toBe(3);
  });
  it('lightens by 1 when struggling (activeDays7 <= 2 with history)', () => {
    expect(adaptiveTaskCount(3, { activeDays7: 1, total14: 6 })).toBe(2);
    expect(adaptiveTaskCount(2, { activeDays7: 2, total14: 5 })).toBe(1);
  });
  it('never goes below 1', () => {
    expect(adaptiveTaskCount(1, { activeDays7: 0, total14: 8 })).toBe(1);
  });
  it('keeps base when consistent (activeDays7 > 2)', () => {
    expect(adaptiveTaskCount(3, { activeDays7: 5, total14: 12 })).toBe(3);
  });
  it('never increases above base', () => {
    expect(adaptiveTaskCount(2, { activeDays7: 7, total14: 20 })).toBe(2);
  });
});

const TODAY = new Date('2026-06-23T08:00:00.000Z');

function specFor(daysLeft: number, extra: Partial<DailyPlanSpec> = {}): DailyPlanSpec {
  return { kind: 'exam', name: 'KPSS', daysLeft, ...extra };
}

describe('dailyPlanEngine - buildDailyTasks', () => {
  it('produces tasks dated today (09:00), tagged with kind + daily', () => {
    const out = buildDailyTasks(specFor(400), [], 'tr', TODAY);
    expect(out.length).toBeGreaterThan(0);
    for (const t of out) {
      expect(t.tags).toContain('exam');
      expect(t.tags).toContain('daily');
      const due = new Date(t.dueDate as string);
      expect(due.getFullYear()).toBe(TODAY.getFullYear());
      expect(due.getDate()).toBe(TODAY.getDate());
    }
  });

  it('scales task count by dailyMinutes', () => {
    expect(buildDailyTasks(specFor(400, { dailyMinutes: 45 }), [], 'tr', TODAY)).toHaveLength(1);
    expect(buildDailyTasks(specFor(400, { dailyMinutes: 90 }), [], 'tr', TODAY)).toHaveLength(2);
    expect(buildDailyTasks(specFor(400, { dailyMinutes: 210 }), [], 'tr', TODAY)).toHaveLength(3);
  });

  it('defaults to 2 tasks when dailyMinutes is missing', () => {
    expect(buildDailyTasks(specFor(400), [], 'tr', TODAY)).toHaveLength(2);
  });

  it('returns empty when daily tasks already exist for today (dedupe)', () => {
    const existing = [
      { title: 'x', tags: ['exam', 'daily'], dueDate: TODAY.toISOString(), isCompleted: false },
    ];
    expect(buildDailyTasks(specFor(400), existing, 'tr', TODAY)).toHaveLength(0);
  });

  it('still generates when only a different plan kind has daily tasks today', () => {
    const existing = [
      { title: 'x', tags: ['tez', 'daily'], dueDate: TODAY.toISOString(), isCompleted: false },
    ];
    expect(buildDailyTasks(specFor(400), existing, 'tr', TODAY).length).toBeGreaterThan(0);
  });

  it('returns empty for a past target date', () => {
    expect(buildDailyTasks(specFor(-1), [], 'tr', TODAY)).toHaveLength(0);
  });

  it('uses sprint-phase content when the exam is near', () => {
    const sprint = buildDailyTasks(specFor(10, { dailyMinutes: 90 }), [], 'tr', TODAY);
    const text = sprint.map(t => t.title).join(' ');
    expect(text).toMatch(/deneme|tekrar|hata/i);
  });

  it('interpolates the plan name into titles', () => {
    const out = buildDailyTasks(specFor(400, { name: 'YDS' }), [], 'tr', TODAY);
    expect(out.some(t => t.title.includes('YDS'))).toBe(true);
  });

  it('produces English copy when lang=en', () => {
    const out = buildDailyTasks(specFor(400), [], 'en', TODAY);
    expect(out.length).toBeGreaterThan(0);
    // TR pool uses Turkish-specific chars; EN copy should be ASCII-ish (no 'ğ'/'ş')
    expect(out.every(t => !/[ğşçöİı]/.test(t.title))).toBe(true);
  });

  it('uses language-specific content for language exams (YDS/IELTS)', () => {
    const out = buildDailyTasks(specFor(400, { name: 'IELTS' }), [], 'tr', TODAY);
    const text = out.map(t => t.title).join(' ').toLowerCase();
    expect(text).toMatch(/kelime|dinle|gramer/);
  });

  it('uses flashcard/Qbank content for medical exams (TUS/USMLE)', () => {
    const out = buildDailyTasks(specFor(200, { name: 'TUS' }), [], 'tr', TODAY);
    const text = out.map(t => t.title).join(' ').toLowerCase();
    expect(text).toMatch(/anki|qbank|high-yield|yüksek-verimli/);
  });

  it('falls back to generic content for non-preset / public exams (KPSS)', () => {
    const out = buildDailyTasks(specFor(400, { name: 'KPSS' }), [], 'tr', TODAY);
    const text = out.map(t => t.title).join(' ').toLowerCase();
    // Jenerik foundation havuzu: kavram/oku/özet
    expect(text).toMatch(/kavram|oku|özet|soru/);
  });

  it('generates daily tasks for fitness kinds too', () => {
    const kilo = buildDailyTasks({ kind: 'kilo', daysLeft: 60, dailyMinutes: 90 }, [], 'tr', TODAY);
    expect(kilo.length).toBe(2);
    expect(kilo[0].tags).toContain('kilo');
  });
});

describe('dailyPlanEngine - hasDailyToday', () => {
  it('detects a same-day daily task for the kind', () => {
    const tasks = [{ tags: ['mulakat', 'daily'], dueDate: TODAY.toISOString(), isCompleted: false }];
    expect(hasDailyToday(tasks, 'mulakat', TODAY)).toBe(true);
  });

  it('ignores tasks dated on a different day', () => {
    const yesterday = new Date(TODAY.getTime() - 86400000);
    const tasks = [{ tags: ['mulakat', 'daily'], dueDate: yesterday.toISOString(), isCompleted: false }];
    expect(hasDailyToday(tasks, 'mulakat', TODAY)).toBe(false);
  });

  it('ignores non-daily plan tasks', () => {
    const tasks = [{ tags: ['mulakat'], dueDate: TODAY.toISOString(), isCompleted: false }];
    expect(hasDailyToday(tasks, 'mulakat', TODAY)).toBe(false);
  });
});
