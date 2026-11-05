import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, ChevronRight, Wallet, CheckCircle2, Circle } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { MonthCalendar, dayKey } from '@/shared/components/MonthCalendar';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { S, R, F, W, ICON, HAIRLINE, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import { calendarDayOf, parseDateKey } from '@/shared/utils/dateKey';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { occurrenceInMonth } from '@/features/payments/utils/paymentDates';
import { paymentLook } from '@/features/payments/utils/paymentLook';

/*
  TAKVİM (2026-11-05, kullanıcı: "takvime geç diyorum, saatlik kısım açılıyor; takvim görüntüsü de yok"). "Takvimde aç"
  artık gerçek ay görünümü: görevler ve ödemeler aynı ızgarada. Saatlik gün ekranı (/gun) bir alt adım.
*/
const COPY = {
  tr: { title: 'Takvim', prev: 'Önceki ay', next: 'Sonraki ay', empty: 'Bu gün boş', hourly: 'Saatlik görünüm', tasks: 'Görev', payments: 'Ödeme', locale: 'tr-TR' },
  en: { title: 'Calendar', prev: 'Previous month', next: 'Next month', empty: 'Nothing this day', hourly: 'Hourly view', tasks: 'Task', payments: 'Payment', locale: 'en-US' },
};

export default function TakvimScreen() {
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const router = useRouter();
  const { theme } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const c = COPY[language === 'en' ? 'en' : 'tr'];
  const params = useLocalSearchParams<{ date?: string }>();
  const start = params.date ? parseDateKey(params.date) : new Date();
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [selected, setSelected] = useState(params.date ?? dayKey(new Date()));
  const tasks = useTaskStore(s => s.tasks);
  const payments = usePaymentsStore(s => s.payments);

  const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const monthTasks = useMemo(() => tasks.filter(t => !t.isArchived && calendarDayOf(t.dueDate)?.startsWith(prefix)), [tasks, prefix]);
  const monthPayments = useMemo(() => payments.map(p => occurrenceInMonth(p, ym.y, ym.m)).filter(o => o != null), [payments, ym]);
  const marks = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const t of monthTasks) {
      const k = calendarDayOf(t.dueDate) as string;
      (out[k] ??= []).push(t.isCompleted ? theme.onSurfaceMuted : theme.primary);
    }
    for (const o of monthPayments) (out[dayKey(o!.date)] ??= []).push(paymentLook(o!.p).color ?? theme.warning);
    return out;
  }, [monthTasks, monthPayments, theme]);
  const dayTasks = monthTasks.filter(t => calendarDayOf(t.dueDate) === selected);
  const dayPayments = monthPayments.filter(o => dayKey(o!.date) === selected);

  const shift = (d: number) => {
    const n = new Date(ym.y, ym.m + d, 1);
    setYm({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(dayKey(n));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} />
      <ScrollView contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
        <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          <MonthCalendar year={ym.y} month0={ym.m} onShift={shift} selected={selected} onSelect={setSelected} marks={marks} locale={c.locale} prevLabel={c.prev} nextLabel={c.next} />
        </View>
        <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
          <Text accessibilityRole="header" style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface }}>
            {new Date(`${selected}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long', weekday: 'long' })}
          </Text>
          {dayTasks.length === 0 && dayPayments.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingVertical: S.xs }}>{c.empty}</Text>}
          {dayTasks.map(t => (
            <View key={t.id} accessible accessibilityLabel={`${c.tasks}: ${t.title}`} style={styles.row}>
              {t.isCompleted ? <CheckCircle2 size={ICON.sm} color={theme.success} /> : <Circle size={ICON.sm} color={theme.onSurfaceMuted} />}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: F.body, color: t.isCompleted ? theme.onSurfaceMuted : theme.onSurface }}>{t.title}</Text>
            </View>
          ))}
          {dayPayments.map(o => (
            <Touchable key={o!.p.id} onPress={() => router.push('/odemeler')} accessibilityRole="link" accessibilityLabel={`${c.payments}: ${o!.p.title}`} style={styles.row}>
              <Wallet size={ICON.sm} color={paymentLook(o!.p).color ?? theme.warning} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{o!.p.title}</Text>
              <ChevronRight size={ICON.xs} color={theme.onSurfaceMuted} />
            </Touchable>
          ))}
          <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />
          <Touchable onPress={() => router.push({ pathname: '/gun', params: { date: selected } })} accessibilityRole="link" style={[styles.row, { minHeight: MIN_TOUCH }]}>
            <Clock size={ICON.sm} color={theme.primary} />
            <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.hourly}</Text>
            <ChevronRight size={ICON.xs} color={theme.primary} />
          </Touchable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.smd, gap: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 40 },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';
