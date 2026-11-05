import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MotiView } from 'moti';
import { ChevronRight } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { PillSentence } from '@/shared/components/PillSentence';
import { F, S, R, W, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { scopeOtherDay } from '@/features/dashboard/utils/dayScope';
import { toDateKey } from '@/shared/utils/dateKey';
import { weekdayIndex } from '@/features/dashboard/utils/streakDay';
import { weekRange, summarizeWeek } from '@/features/report/weeklyReport';
import { buildWeekSentence } from '@/features/week/weekSentence';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import type { Task } from '@/features/tasks/store/useTaskStore';

/*
  BUGÜN'ÜN ALTI (2026-11-01, kullanıcı: "bugün sayfası çok kısa, alta alınca hemen bitiyor · aşağı kaydırınca
  boşluk yerine bir şey görmek istiyor insan"). Aşağı kaydıran kişinin sorusu sırasıyla:
    1. ÖNÜMÜZDEKİ GÜNLER — "sonra ne var?": yarın + iki gün; her gün iş sayısı ve ilk iki iş → o güne gider.
    2. BU HAFTA — "nasıl gidiyorum?": Haftalık Merkez'in AYNI cümlesi (tek motor) + 7 günlük çubuk → haftaya gider.
    3. GÜNÜN GÖĞÜ — kapanış: bugün bitirdiğin her görev, alışkanlık ve 25 dakikalık odak gökte bir yıldız yakar.
       Yalnız ölçülen veriden; sayı uydurulmaz, sıfırsa davet eder.
*/

type Lang = 'tr' | 'en';
interface DayLite { key: string; tasksDone: number; habitsDone: number; focusMin: number }

const COPY = {
  tr: {
    locale: 'tr-TR', upcoming: 'ÖNÜMÜZDEKİ GÜNLER', tomorrow: 'Yarın', free: 'Boş gün', more: (n: number) => `+${n} iş daha`,
    count: (n: number) => `${n} iş`, week: 'BU HAFTA', sky: 'GÜNÜN GÖĞÜ',
    skyLine: (n: number, parts: string) => `Bugün ${n} yıldız yaktın${parts ? `: ${parts}` : ''}.`,
    skyEmpty: 'Gök henüz karanlık. İlk işini bitirince ilk yıldız yanar.',
    tasks: (n: number) => `${n} görev`, habits: (n: number) => `${n} alışkanlık`, focus: (n: number) => `${n} dk odak`,
    openWeek: 'Haftaya bak', openDay: (d: string) => `${d} gününü aç`,
  },
  en: {
    locale: 'en-US', upcoming: 'COMING UP', tomorrow: 'Tomorrow', free: 'Nothing planned', more: (n: number) => `+${n} more`,
    count: (n: number) => `${n} task${n === 1 ? '' : 's'}`, week: 'THIS WEEK', sky: 'TODAY’S SKY',
    skyLine: (n: number, parts: string) => `You lit ${n} star${n === 1 ? '' : 's'} today${parts ? ` — ${parts}` : ''}.`,
    skyEmpty: 'The sky is still dark. Finish your first task to light the first star.',
    tasks: (n: number) => `${n} task${n === 1 ? '' : 's'}`, habits: (n: number) => `${n} habit${n === 1 ? '' : 's'}`, focus: (n: number) => `${n} min focus`,
    openWeek: 'Open your week', openDay: (d: string) => `Open ${d}`,
  },
};

/** Yıldız sayısı — yalnız ölçülen: görev + alışkanlık + her 25 dk odak bir yıldız. */
export function skyStars(d: Pick<DayLite, 'tasksDone' | 'habitsDone' | 'focusMin'>): number {
  return d.tasksDone + d.habitsDone + Math.floor(d.focusMin / 25);
}

/** Güne bağlı sabit yıldız konumları (her açılışta aynı gök). */
function starField(seedKey: string, n: number, w: number, h: number) {
  let seed = 0;
  for (const ch of seedKey) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: n }, () => ({ x: 10 + rnd() * (w - 20), y: 8 + rnd() * (h - 16), r: 1 + rnd() * 1.6 }));
}

type WeekInput = Parameters<typeof summarizeWeek>[0];

export function TodayBelow({ tasks, habits, sessions, today, dayClosed, theme, isDark, language, padding, onOpenDay, onOpenWeek }: {
  tasks: Task[]; habits: WeekInput['habits']; sessions: WeekInput['sessions']; today: DayLite;
  /** Bugünün işleri bitti mi (ya da bugün iş yok) — ileriye bakan bölümler ancak o zaman açılır. */
  dayClosed: boolean;
  theme: AppTheme; isDark: boolean; language: Lang; padding: number;
  onOpenDay: (key: string) => void; onOpenWeek: () => void;
}) {
  const c = COPY[language];
  const reduce = useReduceMotion();
  const locale = c.locale;

  const days = useMemo(() => [1, 2, 3].map(off => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
    const scope = scopeOtherDay(tasks, d);
    const label = off === 1 ? c.tomorrow : d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
    return { key: toDateKey(d), label, items: scope.incomplete };
  }), [tasks, c, locale]);

  const week = useMemo(() => {
    const sum = summarizeWeek({ sessions, tasks, habits, range: weekRange(new Date()) });
    return buildWeekSentence({ focusMin: sum.totalFocusMin, tasks: sum.totalTasks, habitPct: sum.habitPct, hasHabits: sum.habitPossible > 0, dayIndex: weekdayIndex() }, language);
  }, [sessions, tasks, habits, language]);

  const stars = skyStars(today);
  const parts = [today.tasksDone ? c.tasks(today.tasksDone) : '', today.habitsDone ? c.habits(today.habitsDone) : '', today.focusMin >= 25 ? c.focus(today.focusMin) : ''].filter(Boolean).join(', ');
  const SKY_H = 92;
  const [skyW, setSkyW] = useState(0);
  const field = useMemo(() => (skyW ? starField(today.key, 40, skyW, SKY_H) : []), [today.key, skyW]);
  const lit = Math.min(stars, field.length);

  // "BUGÜN" KAVRAMI (kullanıcı: "önümüzdeki günler ve altındakiler bir şey yapılırsa açılmalı"): sayfa bugünü anlatır.
  // Gök ilk yıldız yanınca, "önümüzdeki günler" bugünün işi kapanınca açılır. "Bu hafta" HEP görünür (2026-11-05,
  // kullanıcı: "görev ekledim, Bu hafta yok oldu"): bugünün durumu haftanın özetini saklamamalı.

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 420 }}>
      {dayClosed && <>
      {/* 1 · ÖNÜMÜZDEKİ GÜNLER */}
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{c.upcoming}</Text>
        <BentoCard index={2} style={{ paddingVertical: S.xs, paddingHorizontal: padding }}>
          {days.map((d, i) => (
            <Touchable
              key={d.key}
              onPress={() => onOpenDay(d.key)}
              accessibilityRole="button"
              accessibilityLabel={`${c.openDay(d.label)}: ${d.items.length ? c.count(d.items.length) : c.free}`}
              style={[styles.dayRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
            >
              <View style={{ flex: 1, gap: S.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                  <Text style={[styles.dayName, { color: theme.onSurface }]}>{d.label}</Text>
                  <Text style={[styles.dayCount, { color: d.items.length ? theme.primary : theme.onSurfaceMuted }]}>{d.items.length ? c.count(d.items.length) : c.free}</Text>
                </View>
                {d.items.length > 0 && (
                  <Text numberOfLines={1} style={[styles.dayItems, { color: theme.onSurfaceMuted }]}>
                    {d.items.slice(0, 2).map(t => t.title).join(' · ')}{d.items.length > 2 ? `  ${c.more(d.items.length - 2)}` : ''}
                  </Text>
                )}
              </View>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
            </Touchable>
          ))}
        </BentoCard>
      </View>

      </>}

      {/* 2 · BU HAFTA */}
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{c.week}</Text>
        <Touchable onPress={onOpenWeek} accessibilityRole="button" accessibilityLabel={c.openWeek}>
          <BentoCard index={3} style={{ padding, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <View style={{ flex: 1 }}><PillSentence parts={week} size="body" /></View>
            <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
          </BentoCard>
        </Touchable>
      </View>

      {/* 3 · GÜNÜN GÖĞÜ — kapanış */}
      {stars > 0 && <View style={styles.wrap}>
        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{c.sky}</Text>
        <BentoCard index={4} style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ height: SKY_H }} onLayout={e => setSkyW(Math.round(e.nativeEvent.layout.width))} accessible accessibilityLabel={stars ? c.skyLine(stars, parts) : c.skyEmpty}>
            {skyW > 0 && <Svg width={skyW} height={SKY_H}>
              <Defs>
                <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={isDark ? '#05070F' : '#0B1230'} />
                  <Stop offset="1" stopColor={isDark ? '#121A3A' : '#24306B'} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={skyW} height={SKY_H} fill="url(#sky)" />
              {field.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={i < lit ? p.r : 0.7} fill="#FFFFFF" opacity={i < lit ? 0.95 : 0.12} />
              ))}
            </Svg>}
            {/* Yeni yanan yıldızlar (son 3) yumuşakça parlar — hareket bilgi taşır: "az önce yaktın". */}
            {!reduce && field.slice(Math.max(0, lit - 3), lit).map((p, i) => (
              <MotiView
                key={`glow-${i}`}
                pointerEvents="none"
                from={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 0.55, scale: 1 }}
                transition={{ type: 'timing', duration: 900, delay: 200 + i * 220 }}
                style={{ position: 'absolute', left: p.x - 6, top: p.y - 6, width: 12, height: 12, borderRadius: R.full, backgroundColor: 'rgba(170,190,255,0.35)' }}
              />
            ))}
          </View>
          <Text style={[styles.skyText, { color: theme.onSurfaceVariant, padding }]}>{stars ? c.skyLine(stars, parts) : c.skyEmpty}</Text>
        </BentoCard>
      </View>}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  label: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.8, marginBottom: S.sm, paddingHorizontal: S.xxs },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.smd },
  dayName: { fontSize: F.body, fontWeight: W.semibold },
  dayCount: { fontSize: F.footnote, fontWeight: W.semibold },
  dayItems: { fontSize: F.footnote },
  skyText: { fontSize: F.footnote, lineHeight: 19 },
});
