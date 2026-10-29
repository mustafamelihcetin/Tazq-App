/**
 * Takvim bugün dışındaki bir günü de açabiliyor (madde 5): geçmiş gün = kayıt,
 * gelecek gün = plan. Bugünün kuralından farkı: önceki günlerden taşan gecikmiş işler
 * O GÜNE ait değildir — yalnız vadesi o gün olanlar ve o gün bitenler.
 */
import { scopeOtherDay } from '@/features/dashboard/utils/dayScope';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const day = new Date(2026, 9, 27); // 27 Ekim

describe('scopeOtherDay', () => {
  it('vadesi o gün olan bitmemiş iş "bitmeyenler"de', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: at(2026, 10, 27), isCompleted: false }], day);
    expect(r.incomplete.map(t => t.id)).toEqual([1]);
  });

  it('önceki günden taşan gecikmiş iş O GÜNE ait değil (bugünün kuralı burada geçmez)', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: at(2026, 10, 25), isCompleted: false }], day);
    expect(r.incomplete).toEqual([]);
  });

  it('o gün bitirilen iş, vadesi başka gün olsa da "bitenler"de', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: at(2026, 10, 20), isCompleted: true, completedAt: at(2026, 10, 27, 18) }], day);
    expect(r.completed.map(t => t.id)).toEqual([1]);
  });

  it('vadesi o gün olup bitmiş iş (completedAt yoksa) "bitenler"de', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: at(2026, 10, 27), isCompleted: true }], day);
    expect(r.completed.map(t => t.id)).toEqual([1]);
  });

  it('tarihsiz iş hiçbir güne ait değil', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: null, isCompleted: false }], day);
    expect(r.incomplete).toEqual([]);
    expect(r.completed).toEqual([]);
  });

  it('gece yarısı sınırı: ertesi günün 00:00 vadesi o güne girmez', () => {
    const r = scopeOtherDay([{ id: 1, dueDate: new Date(2026, 9, 28, 0, 0).toISOString(), isCompleted: false }], day);
    expect(r.incomplete).toEqual([]);
  });
});
