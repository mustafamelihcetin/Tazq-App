import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2 } from 'lucide-react-native';
import { ICON, S, R, F, W, B, RSPRING } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { TranslationKeys } from '@/shared/constants/i18n';
import { upperFor } from '@/shared/utils/localeCase';
import { DisplayPanel, DisplayValue, DisplayDivider, useDisplayColors } from '@/shared/components/DisplayPanel';

/*
  ── AY ÖZETİ — Tremor "KPI card with progress bar" ───────────────────────────────
  Ekranın cevaplaması gereken tek soru: "bu ay daha ne kadar ödeyeceğim?". Eskiden
  bu bilgi bölüm başlığının sağında, 11pt'lik "4 ödeme · toplam 7.269,98 ₺" satırıydı
  ve ödenenleri de içine katıp katmadığı belirsizdi. Tremor'un KPI kartı:
    etiket → BÜYÜK sayı → ilerleme çubuğu → "x / y" alt satır.
  Çubuğun izi kendi renginin soluğu (TodayRings ile aynı kural). Gecikme varsa
  kırmızı tek satır — ayrı bir uyarı kartı değil.

  DİJİTAL PANEL (2026-10-30, uygulama geneli dil; bkz. DisplayPanel): kart artık panel —
  üst şeritte AY ve "ay sonuna N gün" (ödeme planının asıl takvimi), kalan tutar sabit
  genişlikli rakam, altta SIRADAKİ okuması: en yakın ödenmemiş ödeme ve günü.
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
  /** Birden çok para birimi varsa ana birimde yaklaşık kalan (madde 12); yoksa/kur yoksa verilmez. */
  approx?: string | null;
  /** En yakın ödenmemiş ödeme — `days` bugünden takvim günü (negatif = gecikti). */
  next?: { title: string; days: number } | null;
}

const COPY = {
  tr: { endIn: (n: number) => (n === 0 ? 'ay bugün bitiyor' : `ay sonuna ${n} gün`), next: 'Sıradaki', when: (d: number) => (d < 0 ? `${-d} gün gecikti` : d === 0 ? 'bugün' : d === 1 ? 'yarın' : `${d} gün sonra`) },
  en: { endIn: (n: number) => (n === 0 ? 'month ends today' : `${n} days to month end`), next: 'Next', when: (d: number) => (d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`) },
};

export const PaymentsMonthCard = React.memo((props: Props) => (
  <DisplayPanel padding={S.md}><Body {...props} /></DisplayPanel>
));

function Body({ theme, t, language, remaining, paid, total, progress, allPaid, overdue, approx, next }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const dc = useDisplayColors();
  const c = COPY[language];
  const now = new Date();
  const daysToEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const month = now.toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR', { month: 'long', year: 'numeric' });
  return (
    <View
      accessible
      accessibilityLabel={allPaid ? t.allPaid : `${t.leftThisMonth}: ${remaining}. ${t.paidOfTotal(paid, total)}`}
      style={{ gap: S.sm }}
    >
      <View style={styles.status}>
        <Text style={[styles.label, { color: dc.label }]}>{upperFor(month, language)}</Text>
        <Text style={[styles.label, { color: dc.label }]}>{upperFor(c.endIn(daysToEnd), language)}</Text>
      </View>
      <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{upperFor(t.leftThisMonth, language)}</Text>
      {allPaid ? (
        <View style={styles.doneRow}>
          <CheckCircle2 size={ICON.lg} color={theme.success} />
          <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.title3, fontWeight: W.semibold }}>{t.allPaid}</Text>
        </View>
      ) : (
        <>
          <DisplayValue value={remaining} color={theme.onSurface} style={styles.amount} />
          {approx ? <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{approx}</Text> : null}
        </>
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

      {next && !allPaid && (
        <>
          <DisplayDivider spacing={S.xs} />
          {/* Ad bir METİN: mono yazı rakamlar içindir, isimde yabancı duruyordu. */}
          <Text style={[styles.label, { color: dc.label }]}>{upperFor(c.next, language)}</Text>
          <Text style={{ color: theme.onSurface, fontSize: F.title3, fontWeight: W.semibold }} numberOfLines={1}>{next.title}</Text>
          <Text style={[styles.sub, { color: next.days < 0 ? theme.error : dc.muted, marginTop: -S.xs }]}>{c.when(next.days)}</Text>
        </>
      )}
    </View>
  );
}

PaymentsMonthCard.displayName = 'PaymentsMonthCard';

const styles = StyleSheet.create({
  status: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xs },
  label: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.6 },
  amount: { fontSize: F.hero, fontWeight: W.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  track: { height: 8, borderRadius: R.full, overflow: 'hidden', marginTop: S.xs },
  fill: { height: '100%', borderRadius: R.full },
  sub: { fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  dot: { width: 8, height: 8, borderRadius: R.full },
});
