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
  // İlk vade gelecek yıldaysa (Ekim'de "Mart 2027" seçildi) bu yılın Mart'ı bir dönem
  // DEĞİL — eskiden öyle sayılıyordu ve yeni eklenen yıllık ödeme 7 ay gecikmiş görünüyordu.
  if (anchor.getFullYear() > y) return anchor;
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

export type PaymentStatus = 'paid' | 'overdue' | 'due';

export interface PaymentView {
  p: Payment;
  /** Satırda gösterilen tarih: ödendiyse ödenen dönemin vadesi, değilse sıradaki vade. */
  date: Date;
  status: PaymentStatus;
  /** Bugünden `date`e takvim günü (negatif = geçti). */
  days: number;
  /** "Bu ay" bölümüne mi düşer — bu ayın dönemi ya da gecikmiş. */
  thisMonth: boolean;
  /** Taksitliyse satırdaki dönemin kaçıncı taksit olduğu ("3/12"). */
  installment?: { no: number; total: number };
}

/**
 * TAKSİT NUMARASI (2026-11-01): dönem anahtarının başlangıçtan kaçıncı dönem olduğu (1'den). Taksitsizse null.
 * Aylık "YYYY-MM", yıllık "YYYY" — ikisi de aynı formülle (ay/yıl farkı + 1).
 */
export function installmentNo(p: Payment, cycleKey: string): number | null {
  if (!p.installmentCount || !p.installmentStart || p.recurrence === 'Once') return null;
  const idx = (k: string) => {
    const [y, m] = k.split('-').map(Number);
    return p.recurrence === 'Yearly' ? y : y * 12 + (m - 1);
  };
  return idx(cycleKey) - idx(p.installmentStart) + 1;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Ekranın TEK satır modeli. Eskiden ekran `nextDueDateOf` (ödendiyse SONRAKİ dönem)
 * ile "ödendi mi" (BU dönem) bilgisini yan yana koyuyordu: Ekim kirası ödenince satır
 * "1 Kas" tarihiyle "Gelecek ay" altına üstü çizili düşüyordu — Kasım ödenmiş gibi.
 * Şimdi ödenen dönem kendi ayında "ödendi" olarak kalır (ayın toplamı tutarlı), gelecek
 * ay dönemi gelince yeniden açılır. Gecikmiş ödeme "Bu ay"ın başına yükselir.
 */
export function paymentView(p: Payment, today: Date = new Date()): PaymentView | null {
  const t0 = startOfDay(today);
  const cycle = currentCycleDate(p, today);
  const paid = isPaidForCycle(p, cycleKeyOf(p, cycle));
  const sameMonth = (d: Date) => d.getFullYear() === t0.getFullYear() && d.getMonth() === t0.getMonth();
  const daysTo = (d: Date) => Math.round((startOfDay(d).getTime() - t0.getTime()) / 86400000);

  const inst = (d: Date) => {
    const no = installmentNo(p, cycleKeyOf(p, d));
    return no == null ? undefined : { no, total: p.installmentCount as number };
  };

  if (paid && sameMonth(cycle)) {
    return { p, date: cycle, status: 'paid', days: daysTo(cycle), thisMonth: true, installment: inst(cycle) };
  }
  const next = nextDueDateOf(p, today);
  if (!next) return null;
  const installment = inst(next);
  // Taksitler bitti → ödeme kapanır (son taksit ödendiği ay "ödendi" olarak yukarıda kalır).
  if (installment && installment.no > installment.total) return null;
  const days = daysTo(next);
  const status: PaymentStatus = days < 0 ? 'overdue' : 'due';
  return { p, date: next, status, days, thisMonth: status === 'overdue' || sameMonth(next), installment };
}

export interface PaymentOccurrence { p: Payment; date: Date; status: PaymentStatus | 'past'; installment?: { no: number; total: number } }

/**
 * TAKVİM İÇİN (2026-11-05): ödemenin verilen aydaki vadesi. Geçmiş dönemlerin "ödendi" bilgisi modelde yok (yalnız son
 * dönem tutuluyor), bu yüzden geçmiş ay "past" döner: ödendi ya da gecikti diye uydurulmaz.
 */
export function occurrenceInMonth(p: Payment, year: number, month0: number, today: Date = new Date()): PaymentOccurrence | null {
  let date: Date;
  if (p.recurrence === 'Monthly') {
    date = new Date(year, month0, Math.min(p.dueDay, daysInMonth(year, month0)));
  } else {
    if (!p.nextDueDate) return null;
    const a = new Date(p.nextDueDate);
    if (a.getMonth() !== month0 && p.recurrence === 'Yearly') return null;
    if (p.recurrence === 'Once') {
      if (a.getFullYear() !== year || a.getMonth() !== month0) return null;
      date = a;
    } else {
      if (year < a.getFullYear()) return null;
      date = new Date(year, month0, Math.min(a.getDate(), daysInMonth(year, month0)));
    }
  }
  const key = cycleKeyOf(p, date);
  const no = installmentNo(p, key);
  if (no != null && (no < 1 || no > (p.installmentCount as number))) return null;
  const installment = no == null ? undefined : { no, total: p.installmentCount as number };
  const t0 = startOfDay(today).getTime();
  const curKey = cycleKeyOf(p, currentCycleDate(p, today));
  if (isPaidForCycle(p, key)) return { p, date, status: 'paid', installment };
  if (key < curKey) return { p, date, status: 'past', installment };
  return { p, date, status: startOfDay(date).getTime() < t0 ? 'overdue' : 'due', installment };
}
