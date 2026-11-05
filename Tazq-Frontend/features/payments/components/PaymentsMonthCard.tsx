import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2 } from 'lucide-react-native';
import { ICON, S, R, F, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import type { TranslationKeys } from '@/shared/constants/i18n';
import { DisplayPanel, DisplayValue, useDisplayColors } from '@/shared/components/DisplayPanel';

/*
  ── AY ÖZETİ — Tremor "KPI card with progress bar" ───────────────────────────────
  Ekranın cevaplaması gereken tek soru: "bu ay daha ne kadar ödeyeceğim?". Eskiden
  bu bilgi bölüm başlığının sağında, 11pt'lik "4 ödeme · toplam 7.269,98 ₺" satırıydı
  ve ödenenleri de içine katıp katmadığı belirsizdi. Tremor'un KPI kartı:
    etiket → BÜYÜK sayı → ilerleme çubuğu → "x / y" alt satır.
  Çubuğun izi kendi renginin soluğu (TodayRings ile aynı kural). Gecikme varsa
  kırmızı tek satır — ayrı bir uyarı kartı değil.

  AY ŞERİDİ (2026-11-05). Kullanıcı: "ödemeler arttıkça karmaşık" sonra parçalı çubuğa "daha da anlamsız". Çubuğun neyi gösterdiği okunmuyordu.
  Şerit kendini anlatır: soldan sağa ay, koyu kısım geçen günler, her nokta o günün ödemesi. Yeşil ödendi, içi boş bekliyor, kırmızı gecikti.
  Üstünde tek sayı (kalan), altında tek cümle (sıradaki ya da gecikme). Ödeme sayısı kutuyu büyütmez.
*/

interface Props {
  theme: AppTheme;
  isDark: boolean;
  t: TranslationKeys['payments'];
  language: 'tr' | 'en';
  remaining: string;
  paid: string;
  total: string;
  allPaid: boolean;
  overdue: { count: number; amount: string } | null;
  /** Birden çok para birimi varsa ana birimde yaklaşık kalan (madde 12); yoksa/kur yoksa verilmez. */
  approx?: string | null;
  /** En yakın ödenmemiş ödeme — `days` bugünden takvim günü (negatif = gecikti). */
  next?: { title: string; days: number } | null;
  /** Ayın ödemeleri: hangi gün, hangi durumda. */
  marks: { day: number; state: 'paid' | 'due' | 'overdue' }[];
}

const COPY = {
  tr: { monthDone: 'Bu ay', next: 'Sıradaki', when: (d: number) => (d < 0 ? `${-d} gün gecikti` : d === 0 ? 'bugün' : d === 1 ? 'yarın' : `${d} gün sonra`) },
  en: { monthDone: 'This month', next: 'Next', when: (d: number) => (d < 0 ? `${-d} days overdue` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`) },
};

export const PaymentsMonthCard = React.memo((props: Props) => (
  <DisplayPanel padding={S.md}><Body {...props} /></DisplayPanel>
));

function Body({ theme, t, language, remaining, paid, total, allPaid, overdue, approx, next, marks }: Props) {
  const dc = useDisplayColors();
  const c = COPY[language];
  const shown = approx ?? remaining;
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const at = (day: number) => `${((Math.min(last, Math.max(1, day)) - 1) / Math.max(1, last - 1)) * 100}%` as const;
  const days = [...new Set(marks.map(m => m.day))].sort((a, b) => a - b);
  const stateOf = (day: number) => {
    const list = marks.filter(m => m.day === day);
    return list.some(m => m.state === 'overdue') ? 'overdue' : list.every(m => m.state === 'paid') ? 'paid' : 'due';
  };
  return (
    <View accessible accessibilityLabel={allPaid ? t.allPaid : `${t.leftThisMonth}: ${shown}. ${t.paidOfTotal(paid, total)}`} style={{ gap: S.sm }}>
      <Text style={[styles.sub, { color: dc.label }]}>{allPaid ? c.monthDone : t.leftThisMonth}</Text>
      {allPaid ? (
        <View style={styles.doneRow}>
          <CheckCircle2 size={ICON.lg} color={theme.success} />
          <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.title3, fontWeight: W.semibold }}>{t.allPaid}</Text>
        </View>
      ) : (
        <DisplayValue value={shown} color={theme.onSurface} style={styles.amount} />
      )}
      {/* AY ŞERİDİ: soldan sağa ay. Koyu kısım geçen günler, nokta o gündeki ödeme. Ödeme sayısı artsa da kutu büyümez. */}
      <View style={styles.strip}>
        <View style={[styles.line, { backgroundColor: theme.surfaceContainerHigh }]} />
        <MotiView from={{ width: '0%' }} animate={{ width: at(now.getDate()) }} transition={{ type: 'timing', duration: 600 }} style={[styles.line, { backgroundColor: theme.onSurfaceMuted }]} />
        {days.map((d, i) => {
          const state = stateOf(d);
          const color = state === 'overdue' ? theme.error : state === 'paid' ? theme.success : theme.primary;
          return (
            <MotiView key={d} from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 200 + i * 60 }}
              style={[styles.mark, { left: at(d), backgroundColor: state === 'due' ? theme.surfaceCard : color, borderColor: color }]} />
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={[styles.end, { color: dc.muted }]}>1</Text>
        <Text style={[styles.end, { color: dc.muted }]}>{last}</Text>
      </View>
      {overdue
        ? <Text style={{ color: theme.error, fontSize: F.footnote, fontWeight: W.semibold }}>{t.urgentOverdue(overdue.count, overdue.amount)}</Text>
        : next && !allPaid && <Text style={[styles.sub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>{`${c.next}: ${next.title} · ${c.when(next.days)}`}</Text>}
    </View>
  );
}

PaymentsMonthCard.displayName = 'PaymentsMonthCard';

const styles = StyleSheet.create({
  amount: { fontSize: F.hero, fontWeight: W.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs },
  strip: { height: 16, justifyContent: 'center', marginTop: S.xs, marginHorizontal: S.xs },
  line: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: R.full },
  mark: { position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: R.full, borderWidth: 2.5 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontSize: F.caption, fontVariant: ['tabular-nums'] },
  sub: { fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'] },
});
