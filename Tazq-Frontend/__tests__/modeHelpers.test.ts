import { deriveDateSlot } from '@/features/modes/utils/modeHelpers';

const NOW = new Date('2026-06-29T12:00:00Z').getTime();
const DAY = 86400000;

describe('deriveDateSlot', () => {
  it('is incomplete when label or date is empty', () => {
    expect(deriveDateSlot('', '2026-07-10', 30, NOW).isComplete).toBe(false);
    expect(deriveDateSlot('YKS', '', 30, NOW).isComplete).toBe(false);
    expect(deriveDateSlot('YKS', '2026-07-10', 30, NOW).isComplete).toBe(true);
  });

  it('computes days left to end of the target day (inclusive)', () => {
    // 10 gün sonrasının günü sonu → bugünden ~10-11 gün (ceil).
    const future = new Date(NOW + 10 * DAY).toISOString().split('T')[0];
    const r = deriveDateSlot('YKS', future, 30, NOW);
    expect(r.datePast).toBe(false);
    expect(r.daysLeft).toBeGreaterThanOrEqual(10);
    expect(r.daysLeft).toBeLessThanOrEqual(11);
  });

  it('flags a past date and yields 0 days left', () => {
    const past = new Date(NOW - 5 * DAY).toISOString().split('T')[0];
    const r = deriveDateSlot('YKS', past, 30, NOW);
    expect(r.datePast).toBe(true);
    expect(r.daysLeft).toBe(0);
  });

  it('falls back to now + fallbackDays when no date given', () => {
    const r = deriveDateSlot('YKS', '', 30, NOW);
    expect(Math.round((r.dateObj.getTime() - NOW) / DAY)).toBe(30);
  });
});
