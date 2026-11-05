import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { MonthCalendar, dayKey } from '@/shared/components/MonthCalendar';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { Payment } from '@/features/payments/store/usePaymentsStore';
import { occurrenceInMonth, type PaymentOccurrence } from '@/features/payments/utils/paymentDates';
import { paymentLook } from '@/features/payments/utils/paymentLook';

/* ÖDEME TAKVİMİ (2026-11-05): ay ızgarasında ödemeler kendi renginde nokta; seçili günün ödemeleri altta. */
const COPY = {
  tr: { prev: 'Önceki ay', next: 'Sonraki ay', none: 'Bu gün ödeme yok', total: 'Bu ay', paid: 'Ödendi', overdue: 'Gecikti', past: 'Geçmiş dönem', upcoming: 'Ödenecek' },
  en: { prev: 'Previous month', next: 'Next month', none: 'No payments this day', total: 'This month', paid: 'Paid', overdue: 'Overdue', past: 'Past period', upcoming: 'Upcoming' },
};

export function PaymentsCalendar({ payments, theme, lang, locale, formatAmount, onOpen }: {
  payments: Payment[]; theme: AppTheme; lang: 'tr' | 'en'; locale: string;
  formatAmount: (p: Payment) => string; onOpen: (p: Payment) => void;
}) {
  const c = COPY[lang];
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(dayKey(now));
  const occ = useMemo(() => payments.map(p => occurrenceInMonth(p, ym.y, ym.m, now)).filter((o): o is PaymentOccurrence => o != null), [payments, ym]);
  const marks = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const o of occ) (out[dayKey(o.date)] ??= []).push(o.status === 'overdue' ? theme.error : paymentLook(o.p).color ?? theme.primary);
    return out;
  }, [occ, theme]);
  const list = occ.filter(o => dayKey(o.date) === selected);
  const shift = (d: number) => {
    const n = new Date(ym.y, ym.m + d, 1);
    setYm({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(n.getFullYear() === now.getFullYear() && n.getMonth() === now.getMonth() ? dayKey(now) : dayKey(n));
  };
  const statusText = (o: PaymentOccurrence) => (o.status === 'paid' ? c.paid : o.status === 'overdue' ? c.overdue : o.status === 'past' ? c.past : c.upcoming);
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
      <MonthCalendar year={ym.y} month0={ym.m} onShift={shift} selected={selected} onSelect={setSelected} marks={marks} locale={locale} prevLabel={c.prev} nextLabel={c.next} />
      <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />
      <MotiView key={selected} from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }} style={{ gap: S.xs }}>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>
          {new Date(`${selected}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'long' })}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.smd, gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 52 },
  icon: { width: 36, height: 36, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
});
