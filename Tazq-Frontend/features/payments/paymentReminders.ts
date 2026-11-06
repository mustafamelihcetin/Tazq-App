import { AppState } from 'react-native';
import { usePaymentsStore, type Payment } from '@/features/payments/store/usePaymentsStore';
import { nextDueDateOf } from '@/features/payments/utils/paymentDates';
import { reminderDaysOf } from '@/features/payments/utils/paymentLook';
import { formatMoney } from '@/features/payments/utils/money';
import { syncPaymentDueNotifs, type PaymentNotif } from '@/shared/utils/notifications';
import { swallow } from '@/shared/utils/swallow';

/*
  ÖDEME HATIRLATMALARI EKRANDAN BAĞIMSIZ (2026-11-06). Eskiden yalnız Ödemeler ekranı açılınca kuruluyordu: ekranı açmayan
  yeni dönem için bildirim almıyordu, başka cihazda eklenen ödeme de öyle. Cashew'daki gibi açılışta ve veri değişince yeniden kurulur.

  İki iyileştirme daha:
  · Hatırlatma günü geçmişse sessizce vazgeçmez: vadesi 2 gün kalan ödemeye "3 gün önce" hatırlatması kurulduğunda en yakın 10:00'a kurar.
    Bunu BİR KEZ yapar (defter): yoksa her açılışta aynı ödeme için yeniden çalardı.
  · En yakın REMINDER_LIMIT ödeme: iOS'un bekleyen bildirim sınırı var ve başka bildirimlerimiz de sırada.
*/
export const REMINDER_LIMIT = 20;
const REMINDER_HOUR = 10;
const DEBOUNCE_MS = 500;
const DAY_MS = 86_400_000;

const COPY = {
  tr: {
    title: (name: string, days: number) => (days === 0 ? `${name} ödemesi bugün` : `${name} ödemesi yaklaşıyor`),
    when: (days: number) => (days === 0 ? 'Bugün son gün' : days === 1 ? 'Yarın' : `${days} gün sonra`),
    variable: (amount: string) => `tahmini ${amount}`,
  },
  en: {
    title: (name: string, days: number) => (days === 0 ? `${name} payment is due today` : `${name} payment is coming up`),
    when: (days: number) => (days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : `In ${days} days`),
    variable: (amount: string) => `about ${amount}`,
  },
};

/** Takvim günü farkı (yaz saati değişiminde kaymaz). */
const dayDiff = (from: Date, to: Date) => {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / DAY_MS);
};

const atHour = (d: Date) => { const x = new Date(d); x.setHours(REMINDER_HOUR, 0, 0, 0); return x; };

export function reminderPlan(
  payments: Payment[],
  ledger: Record<string, string>,
  lang: 'tr' | 'en',
  fallbackCurrency: string,
  now: Date = new Date(),
): { notifs: PaymentNotif[]; ledger: Record<string, string> } {
  const c = COPY[lang];
  const nextLedger: Record<string, string> = {};
  const rows: (PaymentNotif & { at: Date })[] = [];
  for (const p of payments) {
    if (p.id <= 0) continue;
    const days = reminderDaysOf(p);
    if (days < 0) continue;
    const due = nextDueDateOf(p, now);
    if (!due) continue;
    const dueKey = `${due.getFullYear()}-${due.getMonth() + 1}-${due.getDate()}`;
    const key = String(p.id);
    const known = ledger[key] === dueKey;

    const planned = atHour(due);
    planned.setDate(planned.getDate() - days);
    let at = planned;
    if (planned <= now) {
      if (known) { nextLedger[key] = dueKey; continue; } // bu vade için zaten çaldı
      at = atHour(now);
      if (at <= now) at.setDate(at.getDate() + 1);
      if (dayDiff(at, due) < 0) continue; // vade geçti: artık gelen kutusunun işi
    }
    nextLedger[key] = dueKey;
    const left = dayDiff(at, due);
    const money = formatMoney(p.amount, p.currency || fallbackCurrency, lang);
    rows.push({
      paymentId: p.id,
      at,
      fireAt: at,
      title: c.title(p.title, left),
      body: `${c.when(left)} · ${p.isVariable ? c.variable(money) : money}`,
      variable: !!p.isVariable,
    });
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { notifs: rows.slice(0, REMINDER_LIMIT).map(({ at: _at, ...n }) => n), ledger: nextLedger };
}

export async function syncPaymentReminders(lang: 'tr' | 'en'): Promise<void> {
  const st = usePaymentsStore.getState();
  const plan = reminderPlan(st.payments, st.reminderLedger ?? {}, lang, st.currency ?? 'TRY');
  await syncPaymentDueNotifs(plan.notifs);
  usePaymentsStore.setState({ reminderLedger: plan.ledger });
}

/** Uygulama boyunca: açılışta, öne gelince ve ödemeler değişince eşitler (bkz. app/_layout.tsx). */
export function startPaymentReminderSync(getLang: () => 'tr' | 'en'): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => { syncPaymentReminders(getLang()).catch((e: unknown) => swallow('paymentReminders.sync', e)); };
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  };
  later();
  const unsubStore = usePaymentsStore.subscribe((s, prev) => { if (s.payments !== prev.payments) later(); });
  const appState = AppState.addEventListener('change', (next) => { if (next === 'active') later(); });
  return () => {
    if (timer) clearTimeout(timer);
    unsubStore();
    appState.remove();
  };
}
