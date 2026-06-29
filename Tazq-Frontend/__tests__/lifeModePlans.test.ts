import { buildTasarrufPlan, buildBirakmaPlan, birakmaMilestoneTask, tasarrufTypeLabel, birakmaTypeLabel } from '../utils/lifeModePlans';

describe('lifeModePlans', () => {
  it('tasarruf: tipe özel görevi başa ekler + temel içerik', () => {
    const { habits, tasks } = buildTasarrufPlan('borc');
    expect(habits.length).toBeGreaterThanOrEqual(2);
    expect(tasks[0].title).toMatch(/Borç/);
    expect(tasks.some(t => /abonelik/i.test(t.title))).toBe(true);
    expect(tasks.every(t => t.tags.includes('tasarruf'))).toBe(true);
  });

  it('tasarruf: tip boşsa sadece temel görevler', () => {
    const { tasks } = buildTasarrufPlan('');
    expect(tasks.length).toBe(2);
  });

  it('birakma: tipe özel görev + temel alışkanlıklar (temiz gün dahil)', () => {
    const { habits, tasks } = buildBirakmaPlan('sigara');
    expect(habits.some(h => /temiz/i.test(h.name))).toBe(true);
    expect(tasks[0].title).toMatch(/[Ss]igara/);
    expect(tasks.every(t => t.tags.includes('birakma'))).toBe(true);
  });

  it('birakma: ozel tipte ekstra görev yok ama temel akış var', () => {
    const { tasks } = buildBirakmaPlan('ozel');
    expect(tasks.length).toBe(2);
  });

  it('milestone görevi gün ve etiket taşır', () => {
    const t = birakmaMilestoneTask(7, true);
    expect(t.title).toMatch(/7/);
    expect(t.tags).toContain('birakma_m7');
  });

  it('tip etiketleri TR/EN', () => {
    expect(tasarrufTypeLabel('acilfon', true)).toBe('Acil Fon');
    expect(birakmaTypeLabel('sosyal', false)).toBe('Social Media');
  });
});
