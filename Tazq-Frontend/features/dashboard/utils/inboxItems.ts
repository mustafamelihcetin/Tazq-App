import type { Payment } from '@/features/payments/store/usePaymentsStore';
import { paymentView } from '@/features/payments/utils/paymentDates';
import type { MySupportMessage } from '@/shared/services/api';

/*
  GELEN KUTUSU — uygulamanın dağınık uyarıları TEK yerde (2026-11-01, kullanıcı: "sağ üste gerçekten işe yarayan
  bir şey · burada toplandığından da emin ol"). Bugün sayfasındaki Zen ve raf şeritleri buraya taşındı.

  Kalemler SAKLANMAZ, durumdan HESAPLANIR (gerçek kaynak yine kendi deposudur); yalnız "görüldü" bilgisi tutulur.
  Kimlik günlüktür: aynı uyarı ertesi gün yeniden "yeni" sayılır, ama aynı gün tekrar rozet yakmaz.
    · zen       — biriken gecikmiş iş ya da taşan gün (eylemli kart; bkz. TazqZenCard)
    · someday   — rafta bekleyenler (eylemli kart; bkz. SomedayNudge)
    · payment   — gecikmiş ya da 3 gün içinde vadesi gelen ödeme
    · support   — destek ekibinden okunmamış yanıt
    · badge     — son 7 günde kazanılan başarım
    · tomorrow  — yarının iş sayısı (akşam 18:00'den sonra; günü kapatırken bakılan şey)
*/

export type InboxKind = 'zen' | 'someday' | 'payment' | 'support' | 'badge' | 'tomorrow';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** Sıralama: küçük önce (eylem gerektirenler üstte). */
  rank: number;
  title?: string;
  sub?: string;
  tone?: 'error' | 'warning' | 'muted';
  /** payment: tutar her ay değişiyor; ödemeden önce sorulur. */
  variable?: boolean;
  /** payment: ödeme kimliği · support: mesaj kimliği · badge: başarım kimliği. */
  ref?: string | number;
}

export interface InboxInput {
  now: Date;
  dayKey: string;
  zen: { visible: boolean; overload: boolean };
  someday: { visible: boolean; count: number };
  payments: Payment[];
  support: MySupportMessage[];
  /** Başarım kimliği → kazanılma anı (ms). */
  unlockedAt: Record<string, number>;
  achievementTitle: (id: string) => string | null;
  tomorrowCount: number;
  copy: {
    paymentOverdue: (days: number) => string;
    paymentToday: string;
    paymentIn: (days: number) => string;
    supportReply: string;
    supportSub: (preview: string) => string;
    badge: string;
    tomorrow: (n: number) => string;
    tomorrowSub: string;
  };
}

const lastStaffReplyAt = (m: MySupportMessage): number => {
  const fromThread = (m.thread ?? []).filter(e => e.fromStaff).map(e => Date.parse(e.at)).filter(n => !Number.isNaN(n));
  const legacy = m.repliedAt ? Date.parse(m.repliedAt) : NaN;
  const all = Number.isNaN(legacy) ? fromThread : [...fromThread, legacy];
  return all.length ? Math.max(...all) : 0;
};

/*
  OTOMATİK TEMİZLİK — bakılınca ne olmalıysa o:
    · bilgi kalemleri (başarım, yarının yükü) BİR KEZ görülünce kutu kapanırken kendiliğinden gider;
    · bir kaleme dokunup sahibine gitmek onu okundu sayar ve kaldırır (ödeme hariç: ödeme ödenince kendisi düşer);
    · eylem isteyenler (ödeme, Zen, raf, destek yanıtı) çözülene ya da elle kaldırılana kadar kalır.
*/
export const AUTO_CLEAR_ON_SEEN: InboxKind[] = ['badge', 'tomorrow'];
export const clearsOnOpen = (k: InboxKind) => k !== 'payment';

export function buildInbox(i: InboxInput): InboxItem[] {
  const out: InboxItem[] = [];
  if (i.zen.visible) out.push({ id: `zen:${i.zen.overload ? 'load' : 'debt'}:${i.dayKey}`, kind: 'zen', rank: 0 });

  for (const p of i.payments) {
    const v = paymentView(p, i.now);
    if (!v || v.status === 'paid') continue;
    if (v.status !== 'overdue' && v.days > 3) continue;
    const sub = v.status === 'overdue' ? i.copy.paymentOverdue(-v.days) : v.days === 0 ? i.copy.paymentToday : i.copy.paymentIn(v.days);
    out.push({ id: `pay:${p.id}:${v.date.toISOString().slice(0, 10)}`, kind: 'payment', variable: !!p.isVariable, rank: v.status === 'overdue' ? 1 : 2, title: p.title, sub, tone: v.status === 'overdue' ? 'error' : v.days <= 1 ? 'warning' : 'muted', ref: p.id });
  }

  for (const m of i.support) {
    if (m.closedAt) continue;
    const at = lastStaffReplyAt(m);
    if (!at) continue;
    const last = (m.thread ?? []).slice(-1)[0];
    if (last && !last.fromStaff) continue; // son söz kullanıcıda: yanıt bekleniyor, okunacak bir şey yok
    const preview = (last?.fromStaff ? last.body : m.adminReply) ?? '';
    out.push({ id: `sup:${m.id}:${at}`, kind: 'support', rank: 1, title: i.copy.supportReply, sub: i.copy.supportSub(preview.slice(0, 60)), ref: m.id });
  }

  if (i.someday.visible && i.someday.count > 0) out.push({ id: `shelf:${i.dayKey}`, kind: 'someday', rank: 3 });

  const week = i.now.getTime() - 7 * 86400000;
  for (const [id, at] of Object.entries(i.unlockedAt)) {
    if (at < week) continue;
    const t = i.achievementTitle(id);
    if (t) out.push({ id: `ach:${id}`, kind: 'badge', rank: 4, title: t, sub: i.copy.badge, ref: id });
  }

  if (i.now.getHours() >= 18 && i.tomorrowCount > 0) {
    out.push({ id: `tmr:${i.dayKey}`, kind: 'tomorrow', rank: 5, title: i.copy.tomorrow(i.tomorrowCount), sub: i.copy.tomorrowSub });
  }

  return out.sort((a, b) => a.rank - b.rank);
}
