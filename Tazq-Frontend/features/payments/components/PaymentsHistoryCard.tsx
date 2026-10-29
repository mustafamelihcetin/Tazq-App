import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { FormReveal } from '@/features/modes/components/ModeField';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { Touchable } from '@/shared/components/Touchable';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, R, F, W, B, ICON } from '@/shared/constants/tokens';
import { formatMoney, monthlyPaid, type FxRates } from '@/features/payments/utils/money';

/*
  ── GEÇMİŞ ÖDEMELER + 6 AYLIK GRAFİK (madde 12) ──────────────────────────────────
  Eskiden yalnız "bu dönem ödendi mi" vardı; ay değişince geçen ayın ödemesi
  kayboluyordu. Grafik: tek seri (ödenen tutar, ana birimde) → tek ton, lejantsız
  (başlık seriyi adlandırıyor), ince çubuklar, 4px yuvarlak uç tabana oturur, 2px boşluk.
  Her çubuğa sayı YAZILMAZ: seçili ayın değeri üstte. Kuru olmayan yabancı birimli kayıt
  o aya eklenemez → ay "eksik" işaretlenir, olduğundan küçük ama doğruymuş gibi çizilmez.
  Altındaki liste grafiğin tablo görünümü.
  Süre kullanıcının (3/6/12 ay). Ay adları TAM yazılır ("Eki" değil "Ekim"); 12 ayda
  eksene sığmadığı için kısalır ama seçili ayın başlığı yine tam ad (+ gerekirse yıl).
  VARSAYILAN KAPALI: ekranın asıl işi "bu ay ne kaldı"; grafik onu boğuyordu. Kapalıyken
  tek satır (toplam + küçük çubuk izi), dokununca açılır; tercih cihazda hatırlanır.
*/
type Range = '3' | '6' | '12';
const COPY = {
  tr: {
    title: 'Ödenen', show: 'Grafiği göster', hide: 'Grafiği gizle', range: (n: string) => `${n} ay`, rangeA11y: 'Grafik süresi', total: (n: string, v: string) => `Son ${n} ay: ${v}`,
    history: 'Geçmiş ödemeler', empty: 'Bu dönemde ödendi işaretlenmiş bir ödeme yok.',
    approx: (date: string) => `≈ ana para biriminde · ECB kuru ${date}`, partial: 'eksik — kur alınamadı',
    bar: (m: string, v: string, partial: boolean) => `${m}: ${v}${partial ? ', kur eksik' : ''}`,
  },
  en: {
    title: 'Paid', show: 'Show chart', hide: 'Hide chart', range: (n: string) => `${n} mo`, rangeA11y: 'Chart period', total: (n: string, v: string) => `Last ${n} months: ${v}`,
    history: 'Past payments', empty: 'No payment marked as paid in this period.',
    approx: (date: string) => `≈ in your main currency · ECB rate ${date}`, partial: 'partial — no exchange rate',
    bar: (m: string, v: string, partial: boolean) => `${m}: ${v}${partial ? ', rate missing' : ''}`,
  },
};
const LOCALE = { tr: 'tr-TR', en: 'en-US' } as const;
const CHART_H = 96;

type Rec = { id: number; title: string; amount: number; currency?: string | null; paidAt: string };

export function PaymentsHistoryCard({ theme, isDark, lang, records, main, fx }: {
  theme: AppTheme; isDark: boolean; lang: 'tr' | 'en'; records: Rec[]; main: string; fx: FxRates | null;
}) {
  const c = COPY[lang];
  const open = usePaymentsStore(s => s.chartOpen);
  const setOpen = usePaymentsStore(s => s.setChartOpen);
  const [range, setRange] = useState<Range>('6');
  const months = useMemo(() => monthlyPaid(records, Number(range), main, fx), [records, range, main, fx]);
  const [selKey, setSelKey] = useState<string | null>(null);
  const found = months.findIndex(m => m.key === selKey);
  const sel = found >= 0 ? found : months.length - 1;
  const max = Math.max(1, ...months.map(m => m.amount));
  const dateOf = (key: string) => new Date(`${key}-01T12:00:00`);
  const axis = (key: string) => dateOf(key).toLocaleDateString(LOCALE[lang], { month: range === '12' ? 'short' : 'long' });
  const full = (key: string) => dateOf(key).toLocaleDateString(LOCALE[lang], dateOf(key).getFullYear() === new Date().getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
  const picked = months[sel];
  const since = months[0] ? dateOf(months[0].key).getTime() : 0;
  const shown = records.filter(r => new Date(r.paidAt).getTime() >= since);
  const sum = months.reduce((a, m) => a + m.amount, 0);

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.outline }]}>
      <Touchable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={`${c.title}, ${c.total(range, formatMoney(Math.round(sum), main, lang))}`}
        accessibilityHint={open ? c.hide : c.show}
        accessibilityState={{ expanded: open }}
        style={styles.head}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
          <Text style={[styles.note, { color: theme.onSurfaceVariant }]}>{c.total(range, formatMoney(Math.round(sum), main, lang))}</Text>
        </View>
        {!open && (
          <View style={styles.spark} importantForAccessibility="no-hide-descendants">
            {months.slice(-6).map(m => (
              <View key={m.key} style={[styles.sparkBar, { height: m.amount > 0 ? Math.max(3, (m.amount / max) * 20) : 2, backgroundColor: m.amount > 0 ? theme.primary : theme.outlineVariant }]} />
            ))}
          </View>
        )}
        <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Touchable>
      {open && <FormReveal style={{ gap: S.sm }}>
      <SegmentedControl<Range>
        options={(['3', '6', '12'] as const).map(k => ({ key: k, label: c.range(k) }))}
        value={range} onChange={k => { setRange(k); setSelKey(null); }}
        theme={theme} isDark={isDark} accessibilityLabel={c.rangeA11y}
      />
      {picked && (
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {`${full(picked.key)} · ${formatMoney(picked.amount, main, lang)}`}
          {picked.partial ? <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{`  ${c.partial}`}</Text> : null}
        </Text>
      )}
      <View style={styles.chart}>
        {months.map((m, i) => {
          const h = m.amount > 0 ? Math.max(4, (m.amount / max) * CHART_H) : 2;
          const active = i === sel;
          return (
            <Touchable
              key={m.key}
              onPress={() => setSelKey(m.key)}
              accessibilityRole="button"
              accessibilityLabel={c.bar(full(m.key), formatMoney(m.amount, main, lang), m.partial)}
              accessibilityState={{ selected: active }}
              style={styles.col}
            >
              <View style={[styles.bar, { height: h, backgroundColor: m.amount > 0 ? theme.primary : theme.outlineVariant, opacity: active ? 1 : 0.55, borderStyle: m.partial ? 'dashed' : 'solid', borderWidth: m.partial ? B.thin : 0, borderColor: theme.onSurfaceMuted }]} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.axis, { color: active ? theme.onSurface : theme.onSurfaceMuted }]}>{axis(m.key)}</Text>
            </Touchable>
          );
        })}
      </View>
      {fx?.date && <Text style={[styles.note, { color: theme.onSurfaceMuted }]}>{c.approx(fx.date)}</Text>}

      <Text style={[styles.subTitle, { color: theme.onSurfaceVariant }]}>{c.history}</Text>
      {shown.length === 0 ? (
        <Text style={[styles.note, { color: theme.onSurfaceMuted }]}>{c.empty}</Text>
      ) : shown.slice(0, 12).map((r, i) => (
        <View key={r.id} style={[styles.row, { borderTopColor: theme.separator, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.onSurface }]} numberOfLines={1}>{r.title}</Text>
            <Text style={[styles.note, { color: theme.onSurfaceMuted }]}>{new Date(r.paidAt).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long' })}</Text>
          </View>
          <Text style={[styles.amount, { color: theme.onSurface }]}>{formatMoney(r.amount, r.currency || main, lang)}</Text>
        </View>
      ))}
      </FormReveal>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: S.md, borderRadius: R.lg, borderWidth: B.thin, gap: S.sm },
  title: { fontSize: F.body, fontWeight: W.semibold },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs, height: 20 },
  sparkBar: { width: 4, borderRadius: R.xs },
  value: { fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs, height: CHART_H + 22 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: S.xs, height: '100%' },
  bar: { width: '62%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { fontSize: F.caption2, lineHeight: 16, fontWeight: W.medium }, // sabit satır: küçülen etiket (Temmuz) aşağı kaymasın
  note: { fontSize: F.caption },
  subTitle: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.4, marginTop: S.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm },
  rowTitle: { fontSize: F.body, fontWeight: W.medium },
  amount: { fontSize: F.body, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
});
