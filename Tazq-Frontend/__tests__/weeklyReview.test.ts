import fs from 'fs';
import path from 'path';
import { initialWeekDay } from '@/features/report/components/WeeklyBoard';

const src = fs.readFileSync(path.join(__dirname, '../app/report.tsx'), 'utf8');
const range = { days: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'] } as never;

describe('Geri Bakış sade', () => {
  it('seçili gün: bugün, geçmiş haftada en iyi gün', () => {
    expect(initialWeekDay({ range, bestDayIndex: 1 }, '2026-11-06')).toBe(4);
    expect(initialWeekDay({ range, bestDayIndex: 1 }, '2026-12-01')).toBe(1);
    expect(initialWeekDay({ range, bestDayIndex: -1 }, '2026-12-01')).toBe(0);
  });
  it('tek öneri: öneri listesi ve ayrı koç kartı yok', () => {
    expect(src).not.toContain('tips.map(');
    expect(src).toContain('const advice =');
  });
  it('haftayı kapat yalnız hafta sonuna doğru', () => {
    expect(src).toContain('summary.range.days.indexOf(todayKey) >= CLOSE_FROM_DAY');
  });
  it('gökyüzü silinmedi, tek dokunuşla açılıyor', () => {
    expect(src).toContain('<WeekSkySheet');
  });
});
