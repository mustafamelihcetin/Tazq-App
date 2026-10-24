import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2 } from 'lucide-react-native';
import { ICON, S, R, F, W, B, RSPRING } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { TranslationKeys } from '@/shared/constants/i18n';
import { upperFor } from '@/shared/utils/localeCase';

/*
  ── AY ÖZETİ — Tremor "KPI card with progress bar" ───────────────────────────────
  Ekranın cevaplaması gereken tek soru: "bu ay daha ne kadar ödeyeceğim?". Eskiden
  bu bilgi bölüm başlığının sağında, 11pt'lik "4 ödeme · toplam 7.269,98 ₺" satırıydı
  ve ödenenleri de içine katıp katmadığı belirsizdi. Tremor'un KPI kartı:
    etiket → BÜYÜK sayı → ilerleme çubuğu → "x / y" alt satır.
  Çubuğun izi kendi renginin soluğu (TodayRings ile aynı kural). Gecikme varsa
  kırmızı tek satır — ayrı bir uyarı kartı değil.
*/

interface Props {
  theme: AppTheme;
  isDark: boolean;
  t: TranslationKeys['payments'];
  language: 'tr' | 'en';
  remaining: string;
  paid: string;
  total: string;
  /** 0..1 — ödenen / toplam (tutar üzerinden). */
  progress: number;
  allPaid: boolean;
  overdue: { count: number; amount: string } | null;
}

export const PaymentsMonthCard = React.memo(({ theme, isDark, t, language, remaining, paid, total, progress, allPaid, overdue }: Props) => {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View
      accessible
      accessibilityLabel={allPaid ? t.allPaid : `${t.leftThisMonth}: ${remaining}. ${t.paidOfTotal(paid, total)}`}
      style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.outline, borderWidth: isDark ? B.thin : 0 }]}
    >
      <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{upperFor(t.leftThisMonth, language)}</Text>
      {allPaid ? (
        <View style={styles.doneRow}>
          <CheckCircle2 size={ICON.lg} color={theme.success} />
          <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.title3, fontWeight: W.semibold }}>{t.allPaid}</Text>
        </View>
      ) : (
        <Text style={[styles.amount, { color: theme.onSurface }]} numberOfLines={1} adjustsFontSizeToFit>{remaining}</Text>
      )}

      <View style={[styles.track, { backgroundColor: theme.success + '29' }]}>
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
          transition={{ type: 'spring', ...RSPRING.soft }}
          style={[styles.fill, { backgroundColor: theme.success }]}
        />
      </View>
      <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{t.paidOfTotal(paid, total)}</Text>

      {overdue && (
        <View style={styles.overdue}>
          <View style={[styles.dot, { backgroundColor: theme.error }]} />
          <Text style={{ flex: 1, color: theme.error, fontSize: F.footnote, fontWeight: W.semibold }}>{t.urgentOverdue(overdue.count, overdue.amount)}</Text>
        </View>
      )}
    </View>
  );
});

PaymentsMonthCard.displayName = 'PaymentsMonthCard';

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  label: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.6 },
  amount: { fontSize: F.hero, fontWeight: W.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  track: { height: 8, borderRadius: R.full, overflow: 'hidden', marginTop: S.xs },
  fill: { height: '100%', borderRadius: R.full },
  sub: { fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  dot: { width: 8, height: 8, borderRadius: R.full },
});
