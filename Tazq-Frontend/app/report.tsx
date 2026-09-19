import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, Flame, CalendarDays, Compass, CloudOff } from 'lucide-react-native';
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
import { weekRange, summarizeWeek, compareWeeks, weekStory, weekLabel } from '@/features/report/weeklyReport';

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
    hour: (h: number, m: number) => (h > 0 ? `${h}s ${m}d` : `${m}d`),
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
    hour: (h: number, m: number) => (h > 0 ? `${h}h ${m}m` : `${m}m`),
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

  const sessions = useFocusHistoryStore(s => s.sessions);
  const neverLoaded = useFocusHistoryStore(s => s.neverLoaded);
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
    return { summary: current, delta: d, story: weekStory(current, d, lang) };
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

  const hours = Math.floor(summary.totalFocusMin / 60);
  const mins = summary.totalFocusMin % 60;
  const weeklyTarget = dailyGoalMinutes * 7;
  const goalPct = weeklyTarget > 0 ? Math.min(1, summary.totalFocusMin / weeklyTarget) : 0;
  const isCurrentWeek = offset === 0;

  const deltaLabel = delta.comparable && delta.focusMin !== 0
    ? `${delta.focusMin > 0 ? '+' : '−'}${Math.abs(delta.focusMin)} ${lang === 'tr' ? 'dk' : 'min'}`
    : null;

  const Stat = ({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) => (
    <View style={[styles.stat, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
      <View style={{ width: 30, height: 30, borderRadius: R.sm, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center', marginBottom: S.xxs }}>
        {icon}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: theme.onSurface, fontSize: F.title3, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} subtitle={weekLabel(summary.range, lang)} subtitleColor={theme.primary} />
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* HAFTA GEZİNME — eski ekranda yalnız "bu hafta" vardı; pazartesi sabahı bomboştu. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={c.prev}
            disabled={offset <= -HISTORY_WEEKS}
            onPress={() => setOffset(o => Math.max(-HISTORY_WEEKS, o - 1))}
            style={[styles.navBtn, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, opacity: offset <= -HISTORY_WEEKS ? 0.35 : 1 }]}
          >
            <ChevronLeft size={ICON.sm} color={theme.onSurface} />
          </Touchable>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: '700' }}>
            {isCurrentWeek ? c.thisWeek : weekLabel(summary.range, lang)}
          </Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={c.next}
            disabled={isCurrentWeek}
            onPress={() => setOffset(o => Math.min(0, o + 1))}
            style={[styles.navBtn, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, opacity: isCurrentWeek ? 0.35 : 1 }]}
          >
            <ChevronRight size={ICON.sm} color={theme.onSurface} />
          </Touchable>
        </View>

        {/* HAFTANIN HİKÂYESİ — çıplak sayı yerine bir cümle; kıyas burada. */}
        <View style={[styles.story, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '2E' }]}>
          <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', lineHeight: 23 }}>{story}</Text>
          {deltaLabel && (
            <Text style={{ color: delta.focusMin > 0 ? theme.success : theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700', marginTop: S.xs }}>
              {deltaLabel}
            </Text>
          )}
        </View>

        {neverLoaded && (
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', borderRadius: R.md, padding: S.md, backgroundColor: theme.surfaceContainerHigh }}>
            <CloudOff size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption, lineHeight: 18 }}>{c.offline}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Stat icon={<Clock size={ICON.sm} color={theme.primary} />} value={c.hour(hours, mins)} label={c.focus} color={theme.primary} />
          <Stat icon={<CheckCircle2 size={ICON.sm} color={theme.success} />} value={`${summary.totalTasks}`} label={c.tasks} color={theme.success} />
        </View>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Stat icon={<Flame size={ICON.sm} color={theme.streak} />} value={`${summary.habitPct}%`} label={c.habits} color={theme.streak} />
          <Stat icon={<CalendarDays size={ICON.sm} color={theme.tertiary} />} value={`${summary.activeDays}/7`} label={c.activeDays} color={theme.tertiary} />
        </View>

        {/* Haftalık hedef = günlük hedef × 7. Yalnız İÇİNDE BULUNULAN hafta için anlamlı. */}
        {isCurrentWeek && weeklyTarget > 0 && (
          <View style={{ gap: S.xs }}>
            <Text style={{ color: goalPct >= 1 ? theme.primary : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
              {goalPct >= 1 ? c.goalDone : c.goal(summary.totalFocusMin, weeklyTarget)}
            </Text>
            <View style={{ height: 6, borderRadius: R.xs, backgroundColor: theme.onSurface + '14', overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(goalPct * 100)}%`, height: '100%', borderRadius: R.xs, backgroundColor: theme.primary }} />
            </View>
          </View>
        )}

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
  stat: { flex: 1, borderRadius: R.lg, borderWidth: B.thin, padding: S.md, gap: S.xxs },
  tip: { borderRadius: R.md, borderLeftWidth: 3, padding: S.md },
  coach: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  story: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  navBtn: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
