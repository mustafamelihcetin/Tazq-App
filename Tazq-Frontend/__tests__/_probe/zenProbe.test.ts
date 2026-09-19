import { analyzeTaskLoad, calculateZenDistribution, getLocalDateString } from '@/features/tasks/utils/taskBalancer';

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return getLocalDateString(d); };
// Sunucudan dönen gerçek biçim: tam ISO tarih-saat
const iso = (offset: number) => `${day(offset)}T00:00:00Z`;
const t = (id: number, dueDate: string | null, extra: any = {}) =>
  ({ id, title: `t${id}`, isCompleted: false, isArchived: false, priority: 'Medium', dueDate, ...extra } as any);

it('PROBE', () => {
  // 1) Buzdolabı: 10 gün gecikmiş görev (sunucu biçimi)
  const old = t(1, iso(-10));
  const r1 = calculateZenDistribution([old], [old]);
  console.log('BUZDOLABI (10 gün gecikmiş, ISO):', JSON.stringify(r1.map(u => u.newDate)));

  // Aynı görev çıplak YYYY-MM-DD biçiminde
  const oldBare = t(2, day(-10));
  console.log('BUZDOLABI (10 gün gecikmiş, YYYY-MM-DD):', JSON.stringify(calculateZenDistribution([oldBare], [oldBare]).map(u => u.newDate)));

  // 2) Yük dengeleme: yarın ZATEN 8 görev var (ISO)
  const busy = Array.from({ length: 8 }, (_, i) => t(100 + i, iso(1)));
  const moving = [t(10, iso(-1)), t(11, iso(-1))];
  const r2 = calculateZenDistribution(moving, [...busy, ...moving]);
  console.log('YARIN 8 görevken taşınanlar nereye:', JSON.stringify(r2.map(u => u.newDate)), '(yarın =', day(1), ')');

  // 3) Gecikme tespiti
  console.log('bugün ISO gecikmiş mi:', analyzeTaskLoad([t(20, iso(0))]).overdueTasks.length);
  console.log('dün ISO gecikmiş mi:', analyzeTaskLoad([t(21, iso(-1))]).overdueTasks.length);
});
