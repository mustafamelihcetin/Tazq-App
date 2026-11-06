import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2 } from 'lucide-react-native';
import { ICON, S, R, F, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { TranslationKeys } from '@/shared/constants/i18n';
import { useCountingValue } from '@/shared/hooks/useCountingValue';
import { formatMoney } from '@/features/payments/utils/money';

/*
  AY ÖZETİ (2026-11-06, kullanıcı ekrana 10 üzerinden 5,5 verdi). Ekranın tek sorusu: "bu ay daha ne kadar ödeyeceğim?".
  Kutu yok: sayfanın başlığı gibi durur, listeyle aynı sol kenarda başlar. Eski "1-30" ay şeridi kaldırıldı (neyi gösterdiği okunmuyordu);
  yerine ne kadarının ödendiğini söyleyen tek çubuk ve iki sayı. Altında tek cümle: gecikme ya da sıradaki.
*/

interface Props {
  theme: AppTheme;
  t: TranslationKeys['payments'];
  language: 'tr' | 'en';
  remaining: string;
  /** Tek birimdeyse kalan tutar: ödeyince sayarak azalır. Birden çok birim toplanıp sayılamaz. */
  remainingAmount?: { value: number; code: string } | null;
  paid: string;
  total: string;
  /** Ödenen pay (0-1). Kur yoksa ve birimler karışıksa hesaplanamaz: çubuk çizilmez. */
  progress: number | null;
  allPaid: boolean;
  /** Bu ay ödeme yok, sıradaki sonraki aylarda. */
  noneThisMonth?: boolean;
  overdue: { count: number; amount: string } | null;
  /** Birden çok para birimi varsa ana birimde yaklaşık kalan; kur yoksa verilmez. */
  approx?: string | null;
  /** En yakın ödenmemiş ödeme — `days` bugünden takvim günü (negatif = gecikti). */
  next?: { title: string; days: number } | null;
}

const COPY = {
  tr: { none: 'Bu ay ödeme yok', next: 'Sıradaki', paid: (v: string) => `${v} ödendi`, when: (d: number) => (d < 0 ? `${-d} gün gecikti` : d === 0 ? 'bugün' : d === 1 ? 'yarın' : `${d} gün sonra`) },
  en: { none: 'No payments this month', next: 'Next', paid: (v: string) => `${v} paid`, when: (d: number) => (d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`) },
};

export const PaymentsMonthCard = React.memo(({ theme, t, language, remaining, remainingAmount, paid, total, progress, allPaid, noneThisMonth, overdue, approx, next }: Props) => {
  const c = COPY[language];
  const shown = approx ?? remaining;
  const counted = useCountingValue(remainingAmount?.value ?? 0);
  const display = !approx && remainingAmount ? formatMoney(counted, remainingAmount.code, language) : shown;
  const nextLine = next && `${c.next}: ${next.title} · ${c.when(next.days)}`;
  return (
    <View accessible accessibilityLabel={noneThisMonth ? `${c.none}. ${nextLine ?? ''}` : allPaid ? `${t.allPaid}. ${nextLine ?? ''}` : `${t.leftThisMonth}: ${shown}. ${t.paidOfTotal(paid, total)}. ${nextLine ?? ''}`} style={styles.wrap}>
      {noneThisMonth ? (
        <Text style={[styles.done, { color: theme.onSurface }]}>{c.none}</Text>
      ) : allPaid ? (
        <View style={styles.doneRow}>
          <CheckCircle2 size={ICON.lg} color={theme.success} />
          <Text style={[styles.done, { flex: 1, color: theme.onSurface }]}>{t.allPaid}</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{t.leftThisMonth}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.amount, { color: theme.onSurface }]}>{display}</Text>
        </>
      )}
      {!noneThisMonth && !allPaid && progress != null && (
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: theme.outline }]}>
            <MotiView from={{ width: '0%' }} animate={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }} transition={{ type: 'timing', duration: 500 }} style={[styles.fill, { backgroundColor: theme.primaryFill }]} />
          </View>
          <View style={styles.ends}>
            <Text style={[styles.end, { color: theme.onSurfaceVariant }]}>{c.paid(paid)}</Text>
            <Text style={[styles.end, { color: theme.onSurfaceMuted }]}>{total}</Text>
          </View>
        </View>
      )}
      {overdue
        ? <Text style={[styles.line, { color: theme.error, fontWeight: W.semibold }]}>{t.urgentOverdue(overdue.count, overdue.amount)}</Text>
        : nextLine && <Text numberOfLines={1} style={[styles.line, { color: theme.onSurfaceVariant }]}>{nextLine}</Text>}
    </View>
  );
});

PaymentsMonthCard.displayName = 'PaymentsMonthCard';

const styles = StyleSheet.create({
  wrap: { gap: S.xs, paddingHorizontal: S.md, paddingBottom: S.xs },
  label: { fontSize: F.footnote, fontWeight: W.medium },
  amount: { fontSize: F.hero, fontWeight: W.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  done: { fontSize: F.title3, fontWeight: W.semibold },
  progress: { gap: S.xs, marginTop: S.xs },
  track: { height: 4, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: S.sm },
  end: { fontSize: F.caption, fontVariant: ['tabular-nums'] },
  line: { fontSize: F.footnote, marginTop: S.xxs },
});
