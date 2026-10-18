import type { Payment } from '@/features/payments/store/usePaymentsStore';

/**
 * Ödeme vade/dönem hesapları — TEK kaynak. Ekran (gruplama), bildirim zamanlayıcı ve
 * "ödendi" dönem anahtarı hepsi buradan geçer; aksi halde biri "bu ay"ı farklı
 * hesaplarsa (ör. ayın son günü farkı) kullanıcı iki ekranda çelişen bilgi görür.
 *
 * TASARIM: `Monthly` ayın GÜNÜNE (dueDay) dayanır — ay kısaysa son gün kullanılır.
 * `Yearly`/`Once` ise `nextDueDate`in AY+GÜNÜNE dayanır (yıllık her yıl o güne döner).
 */

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Bu ayki/yılki vade — dönem geçmiş olsa da olsun, "bir sonraki" hesabı ayrı fonksiyonda. */
export function currentCycleDate(p: Payment, today: Date): Date {
  if (p.recurrence === 'Monthly') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = Math.min(p.dueDay, daysInMonth(y, m));
    return new Date(y, m, d);
  }
  // Yearly / Once: nextDueDate'in ay+günü, BU yılda.
  const anchor = p.nextDueDate ? new Date(p.nextDueDate) : today;
  if (p.recurrence === 'Once') return anchor;
  const y = today.getFullYear();
  const m = anchor.getMonth();
  const d = Math.min(anchor.getDate(), daysInMonth(y, m));
  return new Date(y, m, d);
}

/** Dönem anahtarı — "ödendi" alanının karşılaştırıldığı değer. */
export function cycleKeyOf(p: Payment, date: Date): string {
  if (p.recurrence === 'Once') return 'once';
  if (p.recurrence === 'Yearly') return String(date.getFullYear());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function isPaidForCycle(p: Payment, cycleKey: string): boolean {
  return (p.lastPaidCycleKey ?? null) === cycleKey;
}

/**
 * Kullanıcıya gösterilecek "sıradaki vade": bu dönem ödenmemişse bu dönem, ödenmişse
 * (Monthly/Yearly) bir sonraki dönem. `Once` ödendiyse artık gösterilmez (null) —
 * ekran bunu "geçmiş/kapandı" listesine taşıyabilir.
 */
export function nextDueDateOf(p: Payment, today: Date = new Date()): Date | null {
  const current = currentCycleDate(p, today);
  const currentKey = cycleKeyOf(p, current);
  const paid = isPaidForCycle(p, currentKey);

  if (p.recurrence === 'Once') return paid ? null : current;

  if (!paid) return current;

  // Bu dönem zaten ödendi → bir sonraki dönemi hesapla.
  if (p.recurrence === 'Monthly') {
    const y = current.getFullYear();
    const m = current.getMonth() + 1;
    const d = Math.min(p.dueDay, daysInMonth(y, m));
    return new Date(y, m, d);
  }
  // Yearly
  const y = current.getFullYear() + 1;
  const d = Math.min(current.getDate(), daysInMonth(y, current.getMonth()));
  return new Date(y, current.getMonth(), d);
}

/** Bugünün dönem anahtarı — "Ödendi" basılırken gönderilecek değer budur. */
export function activeCycleKeyOf(p: Payment, today: Date = new Date()): string {
  return cycleKeyOf(p, currentCycleDate(p, today));
}
