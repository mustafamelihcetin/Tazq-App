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

/* ÖDEME TAKVİMİ (2026-11-05): ay ızgarasında ödemeler kendi renginde nokta; seçili günün ödemeleri altta. */
const COPY = {
  tr: { prev: 'Önceki ay', next: 'Sonraki ay', none: 'Bu gün ödeme yok', total: 'Bu ay', paid: 'Ödendi', overdue: 'Gecikti', past: 'Geçmiş dönem', upcoming: 'Ödenecek', rest: 'Sıradaki' },
  en: { prev: 'Previous month', next: 'Next month', none: 'No payments this day', total: 'This month', paid: 'Paid', overdue: 'Overdue', past: 'Past period', upcoming: 'Upcoming', rest: 'Next' },
};

const AMOUNT_UNITS = { tr: { sep: ',', k: 'B' }, en: { sep: '.', k: 'K' } };

/** Dar hücre için kısa tutar: 1500 → 1,5B / 1.5K; kuruş yok. */
export function compactAmount(n: number, lang: 'tr' | 'en'): string {
  const u = AMOUNT_UNITS[lang];
  const unit = (v: number, tail: string) => `${(Math.round(v * 10) / 10).toString().replace('.', u.sep)}${tail}`;
  if (n >= 1_000_000) return unit(n / 1_000_000, 'M');
  if (n >= 1000) return unit(n / 1000, u.k);
  return String(Math.round(n));
}

export function PaymentsCalendar({ payments, theme, lang, locale, formatAmount, onOpen, onDaySelected }: {
  payments: Payment[]; theme: AppTheme; lang: 'tr' | 'en'; locale: string;
  formatAmount: (p: Payment) => string; onOpen: (p: Payment) => void;
  /** Gün seçilince: ekran takvimi başa alır, liste görünür olur. */
  onDaySelected?: () => void;
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
  /*
    TEK BAKIŞTA (2026-11-05, kullanıcıyla üç deneme: nokta, ikon + "+1", adlı etiket; dar hücrede hiçbiri temiz durmadı).
    Hücre yalnız "ne kadar": gün kendi renginde hafif boyanır, altında toplam. Dördüncü deneme: çizgiler de kalktı, kullanıcı "çok karmaşık" dedi. "Ne" takvimin altındaki listede.
    Gecikmiş kırmızı, ödenmiş ve geçmiş soluk.
  */
  const byDay = useMemo(() => {
    const out: Record<string, PaymentOccurrence[]> = {};
    for (const o of occ) (out[dayKey(o.date)] ??= []).push(o);
    return out;
  }, [occ]);
  const toneOf = (o: PaymentOccurrence) => (o.status === 'overdue' ? theme.error : o.status === 'paid' || o.status === 'past' ? theme.onSurfaceMuted : paymentLook(o.p).color ?? theme.primary);
  const leadOf = (items: PaymentOccurrence[]) => items.find(o => o.status === 'overdue') ?? items.find(o => o.status === 'due') ?? items[0];
  const renderBelow = (key: string) => {
    const items = byDay[key];
    if (!items) return <View style={styles.below} />;
    const sameCurrency = items.every(o => (o.p.currency ?? '') === (items[0].p.currency ?? ''));
    return (
      <View style={styles.below}>
        <Text numberOfLines={1} style={[styles.amt, { color: toneOf(leadOf(items)) }]}>{sameCurrency ? compactAmount(items.reduce((a, o) => a + o.p.amount, 0), lang) : `${items.length}`}</Text>
      </View>
    );
  };
  const dayTint = (key: string) => { const items = byDay[key]; return items ? toneOf(leadOf(items)) + '26' : null; };
  const select = (key: string) => { setSelected(key); onDaySelected?.(); };
  // Tüm ayın listesi "Liste" sekmesinde; burada yalnız sıradaki ödeme, dokununca o güne gider.
  const nextUp = occ.filter(o => dayKey(o.date) > selected && (o.status === 'due' || o.status === 'overdue')).sort((x, y) => x.date.getTime() - y.date.getTime())[0];
  const shift = (d: number) => {
    const n = new Date(ym.y, ym.m + d, 1);
    setYm({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(n.getFullYear() === now.getFullYear() && n.getMonth() === now.getMonth() ? dayKey(now) : dayKey(n));
  };
  const statusText = (o: PaymentOccurrence) => (o.status === 'paid' ? c.paid : o.status === 'overdue' ? c.overdue : o.status === 'past' ? c.past : c.upcoming);
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
      <MonthCalendar year={ym.y} month0={ym.m} onShift={shift} selected={selected} onSelect={select} marks={marks} locale={locale} prevLabel={c.prev} nextLabel={c.next}
        renderBelow={renderBelow} dayTint={dayTint}
        dayA11y={key => { const items = byDay[key]; return items ? items.map(o => `${o.p.title} ${formatAmount(o.p)} ${statusText(o)}`).join(', ') : null; }} />
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
  below: { height: 16, alignItems: 'center' },
  amt: { fontSize: F.caption2, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 44 },
});
