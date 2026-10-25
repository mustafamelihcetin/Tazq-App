import { briefHourOf, workHourOf, productivityHint } from '@/shared/utils/productivityHour';
import { briefHourFor } from '@/shared/utils/notifications';
import { defaultReminderSlot } from '@/features/tasks/utils/taskFormDates';

/**
 * Verimli saat tercihi davranışa bağlı: özet saati + varsayılan hatırlatıcı saati.
 * Ekrandaki açıklama aynı tablodan üretilir (vaat ≠ davranış olamaz).
 */
describe('productivityHour', () => {
  it('özet bildirimi tercihin saatinde', () => {
    expect(briefHourFor('night')).toBe(briefHourOf('night'));
    expect(briefHourFor('morning')).toBe(7);
  });

  it('saat verilmemiş hatırlatıcı verimli saate kurulur (gece → 22:00)', () => {
    const now = new Date(2026, 9, 25, 10, 0);
    const r = defaultReminderSlot({ dueDate: '', dueTime: null }, now, workHourOf('night'));
    expect(new Date(r.dueTime!).getHours()).toBe(22);
    expect(r.dueDate).toBe('2026-10-25'); // 10:00 < 22:00 → bugün
  });

  it('gelecek bir gün seçiliyse o günün verimli saatine', () => {
    const r = defaultReminderSlot({ dueDate: '2026-10-30', dueTime: null }, new Date(2026, 9, 25, 10, 0), workHourOf('afternoon'));
    expect(new Date(r.dueTime!).getHours()).toBe(13);
  });

  it('tercih yoksa eski davranış (09:00) korunur', () => {
    const r = defaultReminderSlot({ dueDate: '2026-10-30', dueTime: null }, new Date(2026, 9, 25, 10, 0));
    expect(new Date(r.dueTime!).getHours()).toBe(9);
  });

  it('açıklama iki dilde, davranıştaki saatleri söyler', () => {
    expect(productivityHint('night', 'tr')).toBe("Günlük özetin 21:00'de gelir; saat vermediğin hatırlatıcılar 22:00'ye kurulur.");
    expect(productivityHint('morning', 'tr')).toBe("Günlük özetin 07:00'de gelir; saat vermediğin hatırlatıcılar 09:00'a kurulur.");
    expect(productivityHint('afternoon', 'tr')).toBe("Günlük özetin 12:00'de gelir; saat vermediğin hatırlatıcılar 13:00'e kurulur.");
    expect(productivityHint('evening', 'tr')).toBe("Günlük özetin 17:00'de gelir; saat vermediğin hatırlatıcılar 18:00'e kurulur.");
    expect(productivityHint('morning', 'en')).toContain('07:00');
    expect(productivityHint('morning', 'en')).toContain('09:00');
  });
});
