import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Compass, CloudOff, ChevronRight, Sparkles } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes';
import { useMomentumStore } from '@/features/user';
import { useHabitStore } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { useFocusStore } from '@/features/focus';
import { ICON, S, R, F, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { generateWeeklyTips, getCoachAction, ProductivityHour } from '@/shared/utils/insights';
import { track } from '@/shared/utils/analytics';
import { toDateKey } from '@/shared/utils/dateKey';
import type { AppTheme } from '@/shared/constants/Colors';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { WeekChart, HabitWeekList } from '@/features/report/components/WeeklyBoard';
import { WeekSkySheet } from '@/features/focus/components/WeekSkySheet';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { WeekDisplay } from '@/features/report/components/WeekDisplay';
import { weekRange, summarizeWeek, compareWeeks, weekLabel, planProgress } from '@/features/report/weeklyReport';
import { PLAN_MODE_TAGS } from '@/features/modes/utils/modeHelpers';
import { haptic } from '@/shared/utils/haptics';

/**
 * HAFTALIK GERİ BAKIŞ — "nasıl gidiyorum?"
 *
 * ── ROL AYRIMI ──────────────────────────────────────────────────────────────
 * Uygulamada iki "haftalık" yüzey vardı ve ikisi de aynı şeyi anlatıyordu: Kokpit
 * ("Haftalık Merkez") ve bu ekran ("Haftalık Rapor"). Kullanıcı hangisine bakacağını
 * bilemiyordu, üstelik ikisi aynı hafta için FARKLI sayı gösterebiliyordu.
 * Roller ayrıldı: Kokpit = bu hafta ne yapıyorum (şimdi), bu ekran = nasıl gidiyorum
 * (geçmiş + kıyas). Sayının tanımı ikisinde de tek yerden gelir:
 * `features/report/weeklyReport.ts`.
 *
 * ── ESKİ EKRANIN KARŞILAMADIĞI VAATLER ──────────────────────────────────────
 *  · Geçen haftayla KIYAS yoktu (veri sunucudan geliyordu ama kullanılmıyordu).
 *  · GEÇMİŞ haftalara bakılamıyordu: pazartesi sabahı ekran boştu.
 *  · Hangi haftaya bakıldığı YAZMIYORDU.
 *  · Alışkanlıklar raporda hiç yoktu.
 *  · Çevrimdışı hiç çalışmıyordu ("Rapor yüklenemedi").
 *  · Sayılar yanlıştı: görevler vade gününe göre, günler UTC'ye göre sayılıyordu.
 */

const HISTORY_WEEKS = 8; // odak geçmişi 63 gün indiriliyor (bkz. useFocusHistoryStore)

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    title: 'Geri Bakış',
    thisWeek: 'Bu hafta',
    prev: 'Önceki hafta',
    next: 'Sonraki hafta',
    focus: 'Odak',
    tasks: 'Görev',
    habits: 'Alışkanlık',
    activeDays: 'Aktif gün',
    plan: 'Plan',
    goal: (done: number, target: number) => `Haftalık hedef ${done} / ${target} dk`,
    goalDone: 'Haftalık hedefin tamam',
    offline: 'Odak geçmişi henüz indirilemedi. Görev ve alışkanlık verisi cihazından geliyor.',
    hour: (h: number, m: number) => (h > 0 ? `${h} sa ${m} dk` : `${m} dk`),
    closeTitle: 'Gelecek haftanın günlük odak hedefi',
    closeBtn: 'Haftayı kapat',
    closed: 'Bu haftayı kapattın',
    goalA11y: 'Günlük odak hedefi',
    goalPick: (m: number) => `${m} dk`,
    legacy: 'Geçmiş haftaların odak kaydı sunucu güncellendiğinde görünecek.',
    sky: 'Haftanın gökyüzü',
    modesLink: 'Modların geçmişi',
    up: (m: string) => `Geçen haftadan ${m} fazla`,
    down: (m: string) => `Geçen haftadan ${m} az`,
    same: 'Geçen haftayla aynı',
    empty: 'Henüz kayıt yok',
  },
  en: {
    title: 'Review',
    thisWeek: 'This week',
    prev: 'Previous week',
    next: 'Next week',
    focus: 'Focus',
    tasks: 'Tasks',
    habits: 'Habits',
    activeDays: 'Active days',
    plan: 'Plan',
    goal: (done: number, target: number) => `Weekly goal ${done} / ${target} min`,
    goalDone: 'Weekly goal reached',
    offline: 'Focus history not downloaded yet. Task and habit data comes from your device.',
    hour: (h: number, m: number) => (h > 0 ? `${h}h ${m}m` : `${m} min`),
    closeTitle: "Next week's daily focus goal",
    closeBtn: 'Close the week',
    closed: 'You closed this week',
    goalA11y: 'Daily focus goal',
    goalPick: (m: number) => `${m} min`,
    legacy: 'Focus history for past weeks appears once the server is updated.',
    sky: "This week's sky",
    modesLink: 'Your modes over time',
    up: (m: string) => `${m} more than last week`,
    down: (m: string) => `${m} less than last week`,
    same: 'Same as last week',
    empty: 'Nothing recorded yet',
  },
};

const GOALS = [15, 25, 45, 60];
/** Haftayı kapatmak cuma ve sonrasında anlamlı: pazartesi kapatılacak bir hafta yok (gün sırası pazartesiden). */
const CLOSE_FROM_DAY = 4;

// Koç/ipucu tonlarını tema token'larına bağlar (tek renk kaynağı: Colors).
const toneColor = (theme: AppTheme, tone: string): string => ({
  positive: theme.success,
  warning: theme.warning,
  motivational: theme.primary,
  neutral: theme.onSurfaceVariant,
}[tone] ?? theme.primary);

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const lang: Lang = language === 'en' ? 'en' : 'tr';
  const c = COPY[lang];
  const router = useRouter();

  const productivityHour = usePrefsStore(s => s.productivityHour);
  const getLastNDays = useMomentumStore(s => s.getLastNDays);
  const habits = useHabitStore(s => s.habits);
  const tasks = useTaskStore(s => s.tasks);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const streak = useFocusStore(s => s.localStreak);

  const lastClosedWeek = usePrefsStore(s => s.lastClosedWeek);
  const setLastClosedWeek = usePrefsStore(s => s.setLastClosedWeek);
  const setDailyGoal = useFocusStore(s => s.setDailyGoal);

  const sessions = useFocusHistoryStore(s => s.sessions);
  const neverLoaded = useFocusHistoryStore(s => s.neverLoaded);
  const usingLegacyFallback = useFocusHistoryStore(s => s.usingLegacyFallback);
  const refreshHistory = useFocusHistoryStore(s => s.refresh);

  /** 0 bu hafta, -1 geçen hafta … Geçmiş, indirilen pencere kadar geriye gider. */
  const [offset, setOffset] = useState(0);

  useFocusEffect(useCallback(() => {
    track('report_opened');
    void refreshHistory();
  }, [refreshHistory]));

  const now = new Date();
  const todayKey = toDateKey(now);

  const { summary, delta } = useMemo(() => {
    const range = weekRange(now, offset);
    const prevRange = weekRange(now, offset - 1);
    const current = summarizeWeek({ sessions, tasks, habits, range, now });
    const previous = summarizeWeek({ sessions, tasks, habits, range: prevRange, now });
    const d = compareWeeks(current, previous);
    return { summary: current, delta: d };
    // `now` her render'da yeni: bağımlılık olarak gün anahtarı yeter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, tasks, habits, offset, lang, todayKey]);

  const tips = useMemo(() => generateWeeklyTips({
    weeklyFocusMinutes: summary.focusPerDay,
    completedTasksWeek: summary.totalTasks,
    streak,
    momentumLast7: getLastNDays(7).map(d => d.score),
    productivityHour: productivityHour as ProductivityHour,
    habits,
    tasks,
  }, 3), [summary, streak, getLastNDays, productivityHour, habits, tasks]);

  const coach = getCoachAction({
    streak,
    todayFocusMin: summary.focusPerDay[summary.range.days.indexOf(todayKey)] ?? 0,
    todayTasksDone: summary.tasksPerDay[summary.range.days.indexOf(todayKey)] ?? 0,
    momentum: (() => { const m = getLastNDays(7).map(d => d.score); return m.length ? m[m.length - 1] : -1; })(),
  });

  // Mod planı olan kullanıcı, planının bu hafta ne kadarını tamamladığını göremiyordu.
  const plan = useMemo(() => planProgress(tasks, summary.range, PLAN_MODE_TAGS), [tasks, summary.range]);
  const weekClosed = lastClosedWeek === summary.range.startKey;

  const hours = Math.floor(summary.totalFocusMin / 60);
  const mins = summary.totalFocusMin % 60;
  const weeklyTarget = dailyGoalMinutes * 7;
  const goalPct = weeklyTarget > 0 ? Math.min(1, summary.totalFocusMin / weeklyTarget) : 0;
  const isCurrentWeek = offset === 0;
  // Mod yoksa Mod özeti'ne bağlantı da yok: boş bir sayfaya göndermez (E-2).
  const hasModes = usePrefsStore(st => { const x = st.seasonal; return !!(x.examMode || x.tezMode || x.mulakatMode || x.sporMode || x.ramazan || x.tasarrufMode || x.birakmaMode); });

  const [skyOpen, setSkyOpen] = useState(false);
  const hasData = summary.totalFocusMin > 0 || summary.totalTasks > 0 || summary.habitDone > 0;
  const deltaAbs = Math.abs(delta.focusMin);
  const note = !hasData ? { text: c.empty, up: false }
    : !delta.comparable ? null
    : deltaAbs <= 5 ? { text: c.same, up: false }
    : { text: (delta.focusMin > 0 ? c.up : c.down)(c.hour(Math.floor(deltaAbs / 60), deltaAbs % 60)), up: delta.focusMin > 0 };
  const canClose = isCurrentWeek && summary.range.days.indexOf(todayKey) >= CLOSE_FROM_DAY;
  // Tek öneri: yapılabilir bir adımı olan koç önce, yoksa ilk içgörü. Dört öneri yan yana hiçbirini okutmuyordu.
  const advice = !isCurrentWeek ? null
    : coach.route ? { text: lang === 'tr' ? coach.textTr : coach.textEn, route: coach.route as string, tone: coach.tone }
    : tips[0] ? { text: lang === 'tr' ? tips[0].textTr : tips[0].textEn, route: null as string | null, tone: tips[0].tone }
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} />
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.xs, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <WeekDisplay
          label={isCurrentWeek ? c.thisWeek : weekLabel(summary.range, lang)}
          canPrev={offset > -HISTORY_WEEKS} canNext={!isCurrentWeek}
          onPrev={() => setOffset(o => Math.max(-HISTORY_WEEKS, o - 1))} onNext={() => setOffset(o => Math.min(0, o + 1))}
          prevLabel={c.prev} nextLabel={c.next}
          value={c.hour(hours, mins)}
          valueLabel={c.focus}
          note={note}
          // Haftalık hedef = günlük hedef × 7. Yalnız içinde bulunulan hafta için anlamlı.
          goal={isCurrentWeek && weeklyTarget > 0 ? { text: goalPct >= 1 ? c.goalDone : c.goal(summary.totalFocusMin, weeklyTarget), pct: goalPct } : null}
          stats={[
            { label: c.tasks, value: `${summary.totalTasks}` },
            ...(habits.length > 0 ? [{ label: c.habits, value: `%${summary.habitPct}` }] : []),
            { label: c.activeDays, value: `${summary.activeDays}/7` },
            ...(plan.total > 0 ? [{ label: c.plan, value: `${plan.done}/${plan.total}` }] : []),
          ]}
        />

        {/* Eski sunucuda yalnız içinde bulunulan hafta dolu gelir; ilk indirme de henüz olmamış olabilir. */}
        {((usingLegacyFallback && !isCurrentWeek) || neverLoaded) && (
          <View style={styles.notice}>
            <CloudOff size={ICON.sm} color={theme.onSurfaceMuted} />
            <Text style={{ flex: 1, color: theme.onSurfaceMuted, fontSize: F.caption, lineHeight: 18 }}>{neverLoaded ? c.offline : c.legacy}</Text>
          </View>
        )}

        <WeekChart key={summary.range.startKey} summary={summary} language={lang} todayKey={todayKey} />
        <HabitWeekList habits={habits} summary={summary} language={lang} todayKey={todayKey} />

        {advice && (
          <Touchable
            disabled={!advice.route}
            onPress={() => { if (advice.route) { track('coach_tip_shown', { tone: advice.tone, route: advice.route }); router.push(advice.route as never); } }}
            accessibilityRole={advice.route ? 'link' : 'text'}
            style={[styles.row, styles.card, { backgroundColor: theme.surfaceCard }]}
          >
            <Compass size={ICON.sm} color={toneColor(theme, advice.tone)} />
            <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.footnote, lineHeight: 20 }}>{advice.text}</Text>
            {advice.route && <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />}
          </Touchable>
        )}

        {/* HAFTAYI KAPAT: yalnız haftanın sonuna doğru. Kapatmak gelecek haftanın hedefini seçtirir; hedef odak ekranının günlük hedefi. */}
        {canClose && (weekClosed ? (
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, textAlign: 'center' }}>{c.closed}</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surfaceCard, gap: S.smd }]}>
            <Text style={{ color: theme.onSurface, fontSize: F.footnote, fontWeight: '600' }}>{c.closeTitle}</Text>
            <SegmentedControl
              options={GOALS.map(m => ({ key: String(m), label: c.goalPick(m) }))}
              value={String(dailyGoalMinutes)}
              onChange={k => setDailyGoal(Number(k))}
              theme={theme}
              isDark={isDark}
              accessibilityLabel={c.goalA11y}
            />
            <Touchable accessibilityRole="button" onPress={() => { haptic.success(); setLastClosedWeek(summary.range.startKey); }} style={{ minHeight: MIN_TOUCH, borderRadius: R.full, backgroundColor: theme.primaryFill, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: theme.onPrimaryFill, fontSize: F.footnote, fontWeight: '700' }}>{c.closeBtn}</Text>
            </Touchable>
          </View>
        ))}

        <View style={[styles.links, { backgroundColor: theme.surfaceCard }]}>
          <Touchable accessibilityRole="button" onPress={() => setSkyOpen(true)} style={styles.row}>
            <Sparkles size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.footnote, fontWeight: '500' }}>{c.sky}</Text>
            <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
          </Touchable>
          {hasModes && (
            <Touchable accessibilityRole="link" accessibilityLabel={c.modesLink} onPress={() => router.push('/mod-ozet')} style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
              <Compass size={ICON.sm} color={theme.onSurfaceVariant} />
              <Text style={{ flex: 1, color: theme.onSurface, fontSize: F.footnote, fontWeight: '500' }}>{c.modesLink}</Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
            </Touchable>
          )}
        </View>
      </ScrollView>
      <WeekSkySheet visible={skyOpen} language={lang} days={summary.range.days} onClose={() => setSkyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md },
  notice: { flexDirection: 'row', gap: S.sm, alignItems: 'center', paddingHorizontal: S.md },
  links: { borderRadius: R.lg, paddingHorizontal: S.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: MIN_TOUCH, paddingVertical: S.sm },
});
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
