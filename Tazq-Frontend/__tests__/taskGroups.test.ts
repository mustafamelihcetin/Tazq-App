import { buildTaskRows, dateGroupOf } from '@/features/tasks/utils/taskGroups';
import { tourStepsFor } from '@/features/onboarding/tour/tourSteps';

const NOW = new Date(2026, 10, 6, 12);
const t = (id: number, dueDate: string | null, extra: object = {}) => ({ id, isCompleted: false, dueDate, priority: 'Medium', tags: [] as string[], ...extra });
const opts = { mode: 'date' as const, cols: 1, laterCount: 0, exiting: new Set<number>(), lang: 'tr' as const, now: NOW };
const headers = (rows: { kind: string; label?: string }[]) => rows.filter(r => r.kind === 'header').map(r => r.label);

describe('görev bölümleri', () => {
  it('tarih bölümleri günle eşleşir', () => {
    expect(dateGroupOf(t(1, '2026-11-05'), NOW)).toBe('overdue');
    expect(dateGroupOf(t(1, '2026-11-06'), NOW)).toBe('today');
    expect(dateGroupOf(t(1, '2026-11-07'), NOW)).toBe('tomorrow');
    expect(dateGroupOf(t(1, '2026-11-10'), NOW)).toBe('soon');
    expect(dateGroupOf(t(1, null), NOW)).toBe('anytime');
    expect(dateGroupOf(t(1, '0001-01-01T00:00:00'), NOW)).toBe('anytime');
  });

  it('sıra sabit, boş bölüm başlığı yok, tamamlanan en altta', () => {
    const done = t(5, '2026-11-06', { isCompleted: true });
    const { rows, flat } = buildTaskRows([t(1, null), done, t(2, '2026-11-06'), t(3, '2026-11-05')], [], opts);
    expect(headers(rows)).toEqual(['Gecikmiş', 'Bugün', 'Tarihsiz', 'Tamamlanan']);
    expect(flat.map(x => x.id)).toEqual([3, 2, 1, 5]);
  });

  it('düz sıra çizimle aynı: taşıma doğru görevi taşır, bölüm dışına çıkılmaz', () => {
    const { rows } = buildTaskRows([t(1, '2026-11-06'), t(2, '2026-11-06'), t(3, '2026-11-07')], [], opts);
    const cells = rows.flatMap(r => (r.kind === 'cells' ? r.cells : []));
    expect(cells.map(c => c.index)).toEqual([0, 1, 2]);
    expect(cells.map(c => [c.canUp, c.canDown])).toEqual([[false, true], [true, false], [false, false]]);
    expect(cells.map(c => c.position)).toEqual(['first', 'last', 'only']);
  });

  it('animasyondaki görev yerinde kalır, bitince Tamamlanan\'a iner', () => {
    const done = t(1, '2026-11-06', { isCompleted: true });
    expect(headers(buildTaskRows([done], [], { ...opts, exiting: new Set([1]) }).rows)).toEqual(['Bugün']);
    expect(headers(buildTaskRows([done], [], opts).rows)).toEqual(['Tamamlanan']);
  });

  it('daraltılmış görünümde başlık yok', () => {
    const { rows, flat } = buildTaskRows([t(1, '2026-11-05'), t(2, '2026-11-06')], [], { ...opts, mode: 'none' });
    expect(headers(rows)).toEqual([]);
    expect(flat.map(x => x.id)).toEqual([1, 2]);
  });

  it('öncelik sıralamasında bölümler önceliğe göre', () => {
    const { rows } = buildTaskRows([t(1, null, { priority: 'Low' }), t(2, null, { priority: 'High' })], [], { ...opts, mode: 'priority' });
    expect(headers(rows)).toEqual(['Yüksek öncelik', 'Düşük öncelik']);
  });

  it('uzak görevler katlama satırının altında, Tamamlanan\'ın üstünde', () => {
    const { rows, flat } = buildTaskRows([t(1, '2026-11-06'), t(9, '2026-11-06', { isCompleted: true })], [t(2, '2026-12-20')], { ...opts, laterCount: 1 });
    expect(rows.map(r => r.kind)).toEqual(['header', 'cells', 'later', 'cells', 'header', 'cells']);
    expect(flat.map(x => x.id)).toEqual([1, 2, 9]);
  });

  it('tablette hücreler satırlara bölünür, tek kalan da çizilir', () => {
    const { rows } = buildTaskRows([t(1, null), t(2, null), t(3, null)], [], { ...opts, cols: 2 });
    expect(rows.filter(r => r.kind === 'cells').map(r => (r.kind === 'cells' ? r.cells.length : 0))).toEqual([2, 1]);
  });
});

describe('ilk açılış turu kısa', () => {
  it('kendiliğinden açılan tur 3 adım; Yardım\'dan istenince tamamı', () => {
    expect(tourStepsFor('dashboard', true).map(s => s.target)).toEqual(['today', 'tasks', 'core']);
    expect(tourStepsFor('dashboard', false)).toHaveLength(5);
  });
});
