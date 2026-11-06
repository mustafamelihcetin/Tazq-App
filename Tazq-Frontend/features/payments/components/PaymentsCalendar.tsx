import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { MonthCalendar, dayKey } from '@/shared/components/MonthCalendar';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { Payment } from '@/features/payments/store/usePaymentsStore';
import { occurrenceInMonth, type PaymentOccurrence } from '@/features/payments/utils/paymentDates';
import { paymentLook } from '@/features/payments/utils/paymentLook';

/*
  ÖDEME TAKVİMİ (2026-11-06, kullanıcı: "4,1B herkes anlamaz; bir yerde 2 ödeme, bir yerde 17 dolar demek"). Aynı yerde iki anlam taşıyan sayı kalktı.
  Hücrede sayı YOK: renk yalnız durum (bekliyor, gecikti, ödendi), nokta sayısı ödeme adedi. Marka rengi yok, dar hücrede gökkuşağı oluyordu.
  Tutarlar altta tam yazılır: ayın toplamı (Wallos), seçili günün ödemeleri. Actual'daki gibi hücre yalnız işaret, değer ayrı yerde.
  Takvim boş bir günle açılmaz: bugün ödeme yoksa ayın sıradaki ödeme günü seçilir.
*/
const COPY = {
  tr: { count: (n: number) => `${n} ödeme`, prev: 'Önceki ay', next: 'Sonraki ay', none: 'Bu gün ödeme yok', paid: 'Ödendi', overdue: 'Gecikti', past: 'Geçmiş dönem', upcoming: 'Ödenecek', rest: 'Sıradaki' },
  en: { count: (n: number) => `${n} payment${n === 1 ? '' : 's'}`, prev: 'Previous month', next: 'Next month', none: 'No payments this day', paid: 'Paid', overdue: 'Overdue', past: 'Past period', upcoming: 'Upcoming', rest: 'Next' },
};

/** Açılışta seçilecek gün: bugün ödeme varsa bugün, yoksa ayın sıradaki ödeme günü, o da yoksa ayın ilk ödeme günü. */
export function initialDay(occ: { date: Date }[], y: number, m: number, now: Date): string {
  const isNow = y === now.getFullYear() && m === now.getMonth();
  const today = dayKey(now);
  const keys = occ.map(o => dayKey(o.date)).sort();
  if (isNow) return keys.includes(today) ? today : keys.find(k => k > today) ?? today;
  return keys[0] ?? dayKey(new Date(y, m, 1));
}

export function PaymentsCalendar({ payments, theme, lang, locale, formatAmount, sumOf, onOpen, onDaySelected }: {
  payments: Payment[]; theme: AppTheme; lang: 'tr' | 'en'; locale: string;
  formatAmount: (p: Payment) => string; onOpen: (p: Payment) => void;
  /** Birden çok ödemenin toplamı: ekranın birim kuralıyla (karışıksa ana birimde yaklaşık). */
  sumOf: (list: Payment[]) => string;
  /** Gün seçilince: ekran takvimi başa alır, liste görünür olur. */
  onDaySelected?: () => void;
}) {
  const c = COPY[lang];
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const occOf = (y: number, m: number) => payments.map(p => occurrenceInMonth(p, y, m, now)).filter((o): o is PaymentOccurrence => o != null);
  const [selected, setSelected] = useState(() => initialDay(occOf(now.getFullYear(), now.getMonth()), now.getFullYear(), now.getMonth(), now));
  const occ = useMemo(() => occOf(ym.y, ym.m), [payments, ym]); // eslint-disable-line react-hooks/exhaustive-deps
  const toneOf = (o: PaymentOccurrence) => (o.status === 'overdue' ? theme.error : o.status === 'paid' || o.status === 'past' ? theme.onSurfaceMuted : theme.primaryFill);
  const marks = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const o of occ) (out[dayKey(o.date)] ??= []).push(toneOf(o));
    return out;
  }, [occ, theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = occ.filter(o => dayKey(o.date) === selected);
  const byDay = useMemo(() => {
    const out: Record<string, PaymentOccurrence[]> = {};
    for (const o of occ) (out[dayKey(o.date)] ??= []).push(o);
    return out;
  }, [occ]);
  const leadOf = (items: PaymentOccurrence[]) => items.find(o => o.status === 'overdue') ?? items.find(o => o.status === 'due') ?? items[0];
  const dayTint = (key: string) => { const items = byDay[key]; return items ? toneOf(leadOf(items)) + '26' : null; };
  const select = (key: string) => { setSelected(key); onDaySelected?.(); };
  // Tüm ayın listesi "Liste" sekmesinde; burada yalnız sıradaki ödeme, dokununca o güne gider.
  const nextUp = occ.filter(o => dayKey(o.date) > selected && (o.status === 'due' || o.status === 'overdue')).sort((x, y) => x.date.getTime() - y.date.getTime())[0];
  const shift = (d: number) => {
    const n = new Date(ym.y, ym.m + d, 1);
    setYm({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(initialDay(occOf(n.getFullYear(), n.getMonth()), n.getFullYear(), n.getMonth(), now));
  };
  const statusText = (o: PaymentOccurrence) => (o.status === 'paid' ? c.paid : o.status === 'overdue' ? c.overdue : o.status === 'past' ? c.past : c.upcoming);
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
      <MonthCalendar year={ym.y} month0={ym.m} onShift={shift} selected={selected} onSelect={select} marks={marks} locale={locale} prevLabel={c.prev} nextLabel={c.next}
        dayTint={dayTint}
        dayA11y={key => { const items = byDay[key]; return items ? items.map(o => `${o.p.title} ${formatAmount(o.p)} ${statusText(o)}`).join(', ') : null; }} />
      {occ.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{new Date(ym.y, ym.m, 1).toLocaleDateString(locale, { month: 'long' })} · {c.count(occ.length)}</Text>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{sumOf(occ.map(o => o.p))}</Text>
        </View>
      )}
      <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />
      <MotiView key={selected} from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }} style={{ gap: S.xs }}>
        <View style={styles.dayHead}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>
            {new Date(`${selected}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'long' })}
          </Text>
          {list.length > 1 && <Text style={{ fontSize: F.footnote, fontVariant: ['tabular-nums'], color: theme.onSurfaceVariant }}>{sumOf(list.map(o => o.p))}</Text>}
        </View>
        {list.length === 0
          ? <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingVertical: S.sm }}>{c.none}</Text>
          : list.map(o => {
            const look = paymentLook(o.p);
            const tint = look.color ?? theme.primary;
            const Ic = look.icon;
            return (
              <Touchable key={o.p.id} onPress={() => onOpen(o.p)} accessibilityRole="button" accessibilityLabel={`${o.p.title}, ${formatAmount(o.p)}, ${statusText(o)}`} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: tint + '1F' }]}>
                  <Ic size={ICON.sm} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{o.p.title}</Text>
                  <Text style={{ fontSize: F.caption, color: o.status === 'overdue' ? theme.error : theme.onSurfaceMuted }}>
                    {statusText(o)}{o.installment ? ` · ${o.installment.no}/${o.installment.total}` : ''}
                  </Text>
                </View>
                {o.status === 'paid' && <Check size={ICON.sm} color={theme.success} />}
                <Text style={{ fontSize: F.callout, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{formatAmount(o.p)}</Text>
              </Touchable>
            );
          })}
      </MotiView>
      {nextUp && (
        <Touchable onPress={() => select(dayKey(nextUp.date))} accessibilityRole="button" accessibilityLabel={`${c.rest}: ${nextUp.p.title}, ${formatAmount(nextUp.p)}`} style={styles.nextRow}>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.rest}</Text>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{nextUp.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {nextUp.p.title}</Text>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{formatAmount(nextUp.p)}</Text>
          <ChevronRight size={ICON.xs} color={theme.onSurfaceMuted} />
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.smd, gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 52 },
  icon: { width: 36, height: 36, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: S.sm, paddingHorizontal: S.xs },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', gap: S.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 44 },
});
