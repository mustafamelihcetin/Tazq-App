/**
 * Dönemsel mod motoru — regresyon testleri.
 *
 * Kapsanan kök nedenler:
 *  1. `daysUntil` 0'a kırpılıyordu → "tarih geçmiş" korumaları hiç tetiklenmiyordu.
 *  2. `hasDuplicateAdaptation` gecikmiş AÇIK görevi "yok" sayıyordu → mükerrer görev.
 *  3. `buildKiloAdaptationTasks` ikinci bir `weight_entry` görevi üretiyordu.
 *  4. `analyzeKiloProgress` ilerlemeyi Math.abs ile ölçüyordu → ters yönde ilerleme
 *     de yüzdeyi artırıyordu; hedef hız kullanıcının tarihini yok sayıyordu.
 */
import {
  daysUntil,
  hasDuplicateAdaptation,
  analyzeKiloProgress,
  buildKiloAdaptationTasks,
  buildSinavAdaptationTasks,
  buildTezAdaptationTasks,
  buildMulakatAdaptationTasks,
  buildMaratonAdaptationTasks,
} from '@/features/modes/utils/planAdaptations';
import { buildDailyTasks } from '@/features/modes/utils/dailyPlanEngine';

const ymd = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('daysUntil — geçmiş tarihlerde işaret korunur', () => {
  it('geçmiş tarih için NEGATİF döner', () => {
    expect(daysUntil(ymd(-10))).toBeLessThan(0);
  });
  it('gelecek tarih için pozitif döner', () => {
    expect(daysUntil(ymd(10))).toBeGreaterThan(0);
  });
});

describe('süresi geçmiş planlar görev üretmez', () => {
  const empty: any[] = [];
  it('günlük plan motoru', () => {
    expect(buildDailyTasks({ kind: 'kilo', slot: 'spor', daysLeft: -3 }, empty, 'tr')).toEqual([]);
  });
  it('sınav / tez / mülakat / maraton adaptasyonları', () => {
    expect(buildSinavAdaptationTasks('KPSS', -1, empty, 'tr')).toEqual([]);
    expect(buildTezAdaptationTasks('Tez', -1, empty, 'tr')).toEqual([]);
    expect(buildMulakatAdaptationTasks('Firma', -1, empty, 'tr')).toEqual([]);
    expect(buildMaratonAdaptationTasks(30, '10K', -1, 4, 0.9, empty, 'tr')).toEqual([]);
  });
});

describe('hasDuplicateAdaptation', () => {
  it('AÇIK görev ne kadar gecikmiş olursa olsun duplicate sayılır', () => {
    const tasks = [{ title: 'x', tags: ['weight_entry'], isCompleted: false, dueDate: ymd(-45) }];
    expect(hasDuplicateAdaptation(tasks, 'weight_entry', 7, true)).toBe(true);
  });
  it('tamamlanmış görev lookback penceresinde sayılır, dışında sayılmaz', () => {
    const inWindow = [{ title: 'x', tags: ['kilo_adapt'], isCompleted: true, dueDate: ymd(-2) }];
    const outWindow = [{ title: 'x', tags: ['kilo_adapt'], isCompleted: true, dueDate: ymd(-30) }];
    expect(hasDuplicateAdaptation(inWindow, 'kilo_adapt', 7, true)).toBe(true);
    expect(hasDuplicateAdaptation(outWindow, 'kilo_adapt', 7, true)).toBe(false);
  });
  it('farklı etiket duplicate sayılmaz', () => {
    const tasks = [{ title: 'x', tags: ['spor'], isCompleted: false, dueDate: ymd(0) }];
    expect(hasDuplicateAdaptation(tasks, 'weight_entry', 7, true)).toBe(false);
  });
});

describe('analyzeKiloProgress', () => {
  const log = (a: number, b: number) => [
    { date: ymd(-14), weight: a },
    { date: ymd(0), weight: b },
  ];

  it('ters yönde gitmek ilerleme sayılmaz', () => {
    const gaining = analyzeKiloProgress(log(90, 93), 90, 80); // vermesi gerekirken almış
    expect(gaining.progressPct).toBe(0);
    expect(gaining.status).toBe('gaining_while_losing');
  });

  it('doğru yönde ilerleme yüzdeye yansır', () => {
    const losing = analyzeKiloProgress(log(90, 87), 90, 80);
    expect(losing.progressPct).toBeCloseTo(30, 5);
  });

  it('hedef hız kullanıcının tarihine göre yumuşar', () => {
    // 10 kg verme: sağlıklı tavan 20 hafta. Kullanıcı 40 hafta (280 gün) vermişse
    // hedef hız yarıya iner → aynı gerçek hız artık "geride" sayılmaz.
    const tight = analyzeKiloProgress(log(90, 89), 90, 80);
    const relaxed = analyzeKiloProgress(log(90, 89), 90, 80, 280);
    expect(Math.abs(relaxed.targetRatePerWeek)).toBeLessThan(Math.abs(tight.targetRatePerWeek));
  });

  it('2 kayıttan az veride analiz yapmaz', () => {
    expect(analyzeKiloProgress([{ date: ymd(0), weight: 90 }], 90, 80).status).toBe('not_enough_data');
  });
});

describe('buildKiloAdaptationTasks', () => {
  it('artık ASLA weight_entry görevi üretmez (tek kaynak weightCheckin.ts)', () => {
    // Eskiden weeksElapsed=2 → "Haftalık tartım zamanı" ikinci bir weight_entry
    // görevi doğuruyor, kullanıcının bastığı görev kapanmadan açık kalıyordu.
    const analysis = analyzeKiloProgress(
      [{ date: ymd(-14), weight: 90 }, { date: ymd(0), weight: 89 }],
      90, 80,
    );
    expect(Math.floor(analysis.weeksElapsed)).toBe(2); // eski bugun tetiklendigi kosul
    const tasks = buildKiloAdaptationTasks(analysis, 90, 80, [], 'tr');
    expect(tasks.some(t => (t.tags ?? []).includes('weight_entry'))).toBe(false);
  });
});
