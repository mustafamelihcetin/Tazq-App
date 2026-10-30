import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Compass, CloudOff } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes';
import { useMomentumStore } from '@/features/user';
import { useHabitStore } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { useFocusStore } from '@/features/focus';
import { ICON, S, R, F, B, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { generateWeeklyTips, getCoachAction, ProductivityHour } from '@/shared/utils/insights';
import { track } from '@/shared/utils/analytics';
import { toDateKey } from '@/shared/utils/dateKey';
import type { AppTheme } from '@/shared/constants/Colors';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { WeekChart, HabitWeekList } from '@/features/report/components/WeeklyBoard';
import { WeekSky } from '@/features/focus/components/WeekSky';
import { WeekDisplay } from '@/features/report/components/WeekDisplay';
import { upperFor } from '@/shared/utils/localeCase';
import { weekRange, summarizeWeek, compareWeeks, weekStory, weekLabel, planProgress } from '@/features/report/weeklyReport';
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
    title: 'Haftalık Geri Bakış',
    thisWeek: 'Bu hafta',
    prev: 'Önceki hafta',
    next: 'Sonraki hafta',
    focus: 'Odak',
    tasks: 'Tamamlanan',
    habits: 'Alışkanlık',
    activeDays: 'Aktif gün',
    coach: 'KOÇUN',
    tips: 'ÖNERİLER',
    goal: (done: number, target: number) => `Haftalık hedef · ${done} / ${target} dk`,
    goalDone: 'Haftalık hedefin tamam ✦',
    offline: 'Odak geçmişi henüz indirilemedi. Görev ve alışkanlık verisi cihazından geliyor.',
    // "0d" gün gibi okunuyordu; aynı ekranın hedef satırı zaten "dk" diyor.
    hour: (h: number, m: number) => (h > 0 ? `${h} sa ${m} dk` : `${m} dk`),
    plan: (done: number, total: number) => `Plan görevleri · ${done} / ${total}`,
    closeTitle: 'Haftayı kapat',
    closeBody: 'Gelecek hafta için günlük odak hedefini seç.',
    closeBtn: 'Haftayı kapat',
    closed: 'Bu haftayı kapattın ✦',
    goalPick: (m: number) => `${m} dk`,
    legacy: 'Geçmiş haftaların odak kaydı sunucu güncellendiğinde görünecek.',
  },
  en: {
    title: 'Weekly Review',
    thisWeek: 'This week',
    prev: 'Previous week',
    next: 'Next week',
    focus: 'Focus',
    tasks: 'Completed',
    habits: 'Habits',
    activeDays: 'Active days',
    coach: 'YOUR COACH',
    tips: 'INSIGHTS',
    goal: (done: number, target: number) => `Weekly goal · ${done} / ${target} min`,
    goalDone: 'Weekly goal reached ✦',
    offline: 'Focus history not downloaded yet. Task and habit data comes from your device.',
    hour: (h: number, m: number) => (h > 0 ? `${h}h ${m}m` : `${m} min`),
    plan: (done: number, total: number) => `Plan tasks · ${done} / ${total}`,
    closeTitle: 'Close the week',
    closeBody: 'Pick your daily focus goal for next week.',
    closeBtn: 'Close the week',
    closed: 'You closed this week ✦',
    goalPick: (m: number) => `${m} min`,
    legacy: 'Focus history for past weeks appears once the server is updated.',
  },
};

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

  const { summary, delta, story } = useMemo(() => {
    const range = weekRange(now, offset);
    const prevRange = weekRange(now, offset - 1);
    const current = summarizeWeek({ sessions, tasks, habits, range, now });
    const previous = summarizeWeek({ sessions, tasks, habits, range: prevRange, now });
    const d = compareWeeks(current, previous);
    return { summary: current, delta: d, story: weekStory(current, d, lang, offset < 0) };
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

  const deltaLabel = delta.comparable && delta.focusMin !== 0
    ? `${delta.focusMin > 0 ? '+' : '−'}${Math.abs(delta.focusMin)} ${lang === 'tr' ? 'dk' : 'min'}`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} subtitle={weekLabel(summary.range, lang)} />
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/*
          HAFTA EKRANI (2026-10-30, dijital panel dili): okları, hikâyeyi, dört sayıyı ve hedef/plan
          çubuklarını TEK ekranda toplar; paneli yatay kaydırmak haftalar arasında gezdirir (bkz. WeekDisplay).
          HAFTA GEZİNME — eski ekranda yalnız "bu hafta" vardı; pazartesi sabahı bomboştu.
        */}
        <WeekDisplay
          label={upperFor(isCurrentWeek ? c.thisWeek : weekLabel(summary.range, lang), lang)}
          canPrev={offset > -HISTORY_WEEKS} canNext={!isCurrentWeek}
          onPrev={() => setOffset(o => Math.max(-HISTORY_WEEKS, o - 1))} onNext={() => setOffset(o => Math.min(0, o + 1))}
          prevLabel={c.prev} nextLabel={c.next}
          story={story}
          delta={deltaLabel ? { text: deltaLabel, up: delta.focusMin > 0 } : null}
          readouts={[
            { label: c.focus, value: c.hour(hours, mins), tone: 'primary' },
            { label: c.tasks, value: `${summary.totalTasks}`, tone: 'success' },
            { label: c.habits, value: `${summary.habitPct}%`, tone: 'streak' },
            { label: c.activeDays, value: `${summary.activeDays}/7`, tone: 'tertiary' },
          ]}
          bars={[
            // Haftalık hedef = günlük hedef × 7. Yalnız İÇİNDE BULUNULAN hafta için anlamlı.
            ...(isCurrentWeek && weeklyTarget > 0 ? [{ text: goalPct >= 1 ? c.goalDone : c.goal(summary.totalFocusMin, weeklyTarget), pct: goalPct, tone: 'primary' as const, highlight: goalPct >= 1 }] : []),
            ...(plan.total > 0 ? [{ text: c.plan(plan.done, plan.total), pct: plan.done / plan.total, tone: 'tertiary' as const }] : []),
          ]}
        />

        {/* Eski sunucuda yalnız içinde bulunulan hafta dolu gelir (bkz. useFocusHistoryStore). */}
        {usingLegacyFallback && !isCurrentWeek && (
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', borderRadius: R.md, padding: S.md, backgroundColor: theme.surfaceContainerHigh }}>
            <CloudOff size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption, lineHeight: 18 }}>{c.legacy}</Text>
          </View>
        )}

        {neverLoaded && (
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', borderRadius: R.md, padding: S.md, backgroundColor: theme.surfaceContainerHigh }}>
            <CloudOff size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption, lineHeight: 18 }}>{c.offline}</Text>
          </View>
        )}

        {/* Işık koleksiyonu — odak dakikalarından takımyıldızlar (bkz. WeekSky). */}
        <WeekSky focusPerDay={summary.focusPerDay} dayKeys={summary.range.days} language={lang === 'en' ? 'en' : 'tr'} />
        <WeekChart summary={summary} language={lang} todayKey={todayKey} />
        <HabitWeekList habits={habits} summary={summary} language={lang} todayKey={todayKey} />

        {/* Koç — yalnız İÇİNDE BULUNULAN hafta için: geçmiş haftaya eylem önerilmez. */}
        {isCurrentWeek && (() => {
          const tone = toneColor(theme, coach.tone);
          return (
            <View style={[styles.coach, { backgroundColor: tone + '14', borderColor: tone + '33' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs }}>
                <Compass size={ICON.xs} color={tone} strokeWidth={2.5} />
                <Text style={{ color: tone, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5 }}>{c.coach}</Text>
              </View>
              <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', lineHeight: 22 }}>
                {lang === 'tr' ? coach.textTr : coach.textEn}
              </Text>
              {coach.route && (
                <Touchable
                  onPress={() => { track('coach_tip_shown', { tone: coach.tone, route: coach.route }); router.push(coach.route as never); }}
                  style={{ alignSelf: 'flex-start', marginTop: S.sm, backgroundColor: tone, paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full }}
                  accessibilityRole="button"
                  accessibilityLabel={lang === 'tr' ? coach.ctaTr : coach.ctaEn}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: F.caption }}>{lang === 'tr' ? coach.ctaTr : coach.ctaEn}</Text>
                </Touchable>
              )}
            </View>
          );
        })()}

        {/*
          HAFTAYI KAPAT — geri dönmek için bir sebep.
          Eski rapor bir kez bakılıp unutulan bir sayfaydı: ne kıyas, ne geçmiş, ne de
          bitiren bir adım vardı. Kapatmak kullanıcıya gelecek haftanın hedefini
          seçtiriyor; hedef zaten odak ekranının kullandığı günlük hedef.
        */}
        {isCurrentWeek && (
          <View style={[styles.close, { borderColor: isDark ? theme.outline : 'transparent', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest }]}>
            {weekClosed ? (
              <Text style={{ color: theme.primary, fontSize: F.body, fontWeight: '700' }}>{c.closed}</Text>
            ) : (
              <>
                <Text style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '700' }}>{c.closeTitle}</Text>
                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{c.closeBody}</Text>
                <View style={{ flexDirection: 'row', gap: S.xs, marginTop: S.xs }}>
                  {[15, 25, 45, 60].map((m) => {
                    const on = dailyGoalMinutes === m;
                    return (
                      <Touchable
                        key={m}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={c.goalPick(m)}
                        onPress={() => setDailyGoal(m)}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: on ? theme.primary : theme.outlineVariant, backgroundColor: on ? theme.primary + '18' : 'transparent' }}
                      >
                        <Text style={{ color: on ? theme.primary : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>{c.goalPick(m)}</Text>
                      </Touchable>
                    );
                  })}
                </View>
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel={c.closeBtn}
                  onPress={() => { haptic.success(); setLastClosedWeek(summary.range.startKey); }}
                  style={{ marginTop: S.sm, paddingVertical: S.md, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.onPrimary, fontSize: F.footnote, fontWeight: '700' }}>{c.closeBtn}</Text>
                </Touchable>
              </>
            )}
          </View>
        )}

        {isCurrentWeek && tips.length > 0 && (
          <View style={{ gap: S.sm }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5 }}>{c.tips}</Text>
            {tips.map((tip, i) => {
              const tone = toneColor(theme, tip.tone);
              return (
                <View key={i} style={[styles.tip, { backgroundColor: tone + '12', borderLeftColor: tone }]}>
                  <Text style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '500', lineHeight: 21 }}>
                    {lang === 'tr' ? tip.textTr : tip.textEn}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { borderRadius: R.md, borderLeftWidth: 3, padding: S.md },
  coach: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  close: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg, gap: S.xxs },
});
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
