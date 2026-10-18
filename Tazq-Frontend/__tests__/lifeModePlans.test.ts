import { buildTasarrufPlan, buildBirakmaPlan, birakmaMilestoneTask, birakmaTypeTasks, tasarrufTypeLabel, birakmaTypeLabel, spendingAreaLabel, triggerLabel } from '@/shared/utils/lifeModePlans';

describe('lifeModePlans', () => {
  it('tasarruf: tipe özel görevleri başa ekler + tipe özel alışkanlık + temel içerik', () => {
    const { habits, tasks } = buildTasarrufPlan('borc');
    // Temel 2 alışkanlık + tipe özel 1 alışkanlık.
    expect(habits.length).toBe(3);
    expect(habits.some(h => /borca/i.test(h.name))).toBe(true);
    // Tipe özel görevler en başta.
    expect(tasks[0].title).toMatch(/Borç/);
    expect(tasks.some(t => /faiz/i.test(t.title))).toBe(true);
    expect(tasks.some(t => /abonelik/i.test(t.title))).toBe(true);
    expect(tasks.every(t => t.tags.includes('tasarruf'))).toBe(true);
  });

  it('tasarruf: tip boşsa sadece temel içerik (3 görev, tipe özel alışkanlık yok)', () => {
    const { habits, tasks } = buildTasarrufPlan('');
    expect(habits.length).toBe(2);
    expect(tasks.length).toBe(3);
  });

  it('birakma: temel görevler + tipe özel görevler eklenir (temiz gün alışkanlığı dahil)', () => {
    const { habits, tasks } = buildBirakmaPlan('sigara');
    expect(habits.some(h => /temiz/i.test(h.name))).toBe(true);
    expect(tasks.some(t => /[Ss]igara/.test(t.title))).toBe(true);
    expect(tasks.some(t => /çağrıştıran|cues/i.test(t.title) || (t.desc && /kül/i.test(t.desc)))).toBe(true);
    expect(tasks.every(t => t.tags.includes('birakma'))).toBe(true);
  });

  it('birakma: ozel tipte tipe özel görev yok ama zengin temel akış var (4 görev)', () => {
    const { tasks } = buildBirakmaPlan('ozel');
    expect(tasks.length).toBe(4);
  });

  it('birakmaTypeTasks: bilinen tür 2 görev, boş/özel 0 görev döndürür', () => {
    expect(birakmaTypeTasks('kumar').length).toBe(2);
    expect(birakmaTypeTasks('ozel').length).toBe(0);
    expect(birakmaTypeTasks('').length).toBe(0);
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

  it('tasarruf: spendingArea verilmezse davranış AYNI (geriye dönük uyumlu)', () => {
    const withoutArea = buildTasarrufPlan('birikim');
    const withExplicitEmpty = buildTasarrufPlan('birikim', '');
    expect(withExplicitEmpty.tasks.length).toBe(withoutArea.tasks.length);
  });

  it('tasarruf: spendingArea verilince tam olarak 1 ekstra görev en başa eklenir', () => {
    const base = buildTasarrufPlan('birikim');
    const withArea = buildTasarrufPlan('birikim', 'abonelikler');
    expect(withArea.tasks.length).toBe(base.tasks.length + 1);
    expect(withArea.tasks[0].title).toMatch(/[Aa]bonelik/);
  });

  it('tasarruf: her harcama alanı kendi görevini üretir', () => {
    const areas: Array<Parameters<typeof buildTasarrufPlan>[1]> = ['disarida_yemek', 'online_alisveris', 'abonelikler', 'eglence_hobi'];
    const titles = new Set(areas.map(a => buildTasarrufPlan('', a).tasks[0].title));
    expect(titles.size).toBe(areas.length);
  });

  it('birakma: trigger verilmezse davranış AYNI (geriye dönük uyumlu)', () => {
    const withoutTrigger = buildBirakmaPlan('sigara');
    const withExplicitEmpty = buildBirakmaPlan('sigara', '');
    expect(withExplicitEmpty.tasks.length).toBe(withoutTrigger.tasks.length);
  });

  it('birakma: trigger verilince tam olarak 1 ekstra görev eklenir, türden bağımsız', () => {
    const base = buildBirakmaPlan('sigara');
    const withTrigger = buildBirakmaPlan('sigara', 'stres');
    expect(withTrigger.tasks.length).toBe(base.tasks.length + 1);
    expect(withTrigger.tasks[withTrigger.tasks.length - 1].title).toMatch(/[Ss]tres/);
  });

  it('birakma: her tetikleyici kendi görevini üretir', () => {
    const triggers: Array<Parameters<typeof buildBirakmaPlan>[1]> = ['stres', 'sosyal_ortam', 'can_sikintisi', 'otomatik_pilot'];
    const titles = new Set(triggers.map(t => buildBirakmaPlan('', t).tasks.at(-1)!.title));
    expect(titles.size).toBe(triggers.length);
  });

  it('alan/tetikleyici etiketleri TR/EN', () => {
    expect(spendingAreaLabel('abonelikler', true)).toBe('Abonelikler');
    expect(spendingAreaLabel('disarida_yemek', false)).toBe('Eating Out');
    expect(triggerLabel('can_sikintisi', true)).toBe('Can Sıkıntısı');
    expect(triggerLabel('sosyal_ortam', false)).toBe('Social Setting');
  });
});
