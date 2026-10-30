import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { ChevronLeft, ChevronRight, Coffee, Pause, Play, Trash2, SlidersHorizontal } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayDivider, DisplayReadout, useDisplayColors } from '@/shared/components/DisplayPanel';
import { PillSentence, type PillPart } from '@/shared/components/PillSentence';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { S, R, F, W, ICON, HAIRLINE, topBarSpace } from '@/shared/constants/tokens';
import { haptic } from '@/shared/utils/haptics';
import { renderModeEmojiIcon } from '@/features/modes';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { HabitBubble } from '@/features/habits/components/HabitBubble';
import { HabitPlanSheet } from '@/features/habits/components/HabitPlanSheet';
import { habitColor, HABIT_PALETTE, paletteOf, modeFamily } from '@/features/habits/utils/habitColor';
import { planSummary } from '@/features/habits/utils/planCopy';
import { consistency, countOn, targetOf, milestone, isDueToday, missState } from '@/features/habits/utils/habitSchedule';
import { streakStats, cellState, weekdayPattern, monthGrid } from '@/features/habits/utils/habitStats';
import { celebrateMilestone } from '@/features/habits/utils/autoMark';

/*
  ALIŞKANLIK DETAYI (2026-10-30). Kullanıcı: "'alışkanlık' tanımı ve takip algısını karşılayan bir
  ekran mı? — en iyisini, tüm eksikleri tam kapatacak şekilde". Bir alışkanlık takipçisinden
  beklenen dört şey bu sayfada:
    1) ZİNCİR — güncel ve en uzun seri (plana duyarlı, tek kaçırma affedilir), 30 günlük tutarlılık,
       toplam tekrar ve sıradaki kilometre taşı (7/21/66).
    2) BUGÜN — tek dokunuşla işaretle (miktarlıda adım adım), basılı tut = mola.
    3) GEÇMİŞ — ay ay gezilen takvim; geçmiş güne dokun = düzelt, basılı tut = mola.
    4) DESEN — haftanın hangi günü güçlü/zayıf (son 12 hafta) + tek cümle.
  Plan, dinlendirme ve silme de burada — alışkanlıkla ilgili her şey tek yerde.
*/

const COPY = {
  tr: {
    notFound: 'Alışkanlık bulunamadı.', back: 'Geri',
    today: 'BUGÜN', doneToday: 'Bugün yapıldı.', notYet: 'Bugün henüz yapılmadı.', rested: 'Bugün mola günü.', notPlanned: 'Bugün planda yok.',
    rescue: 'Dün kaçtı — bugün yaparsan zincir sürer.',
    streak: 'Seri', best: 'En uzun', consistency: 'Tutarlılık', total: 'Toplam',
    day: 'gün', week: 'hafta', times: 'kez',
    nextMilestone: (n: number, left: number) => `${n}. tekrara ${left} kaldı`, allMilestones: 'Bütün kilometre taşları geçildi',
    calendar: 'Takvim', calendarHint: 'Güne dokun: işaretle · basılı tut: mola',
    prevMonth: 'Önceki ay', nextMonth: 'Sonraki ay',
    pattern: 'Haftanın günleri', patternHint: 'Son 12 hafta, planlı günlerde yapılma oranı',
    patternStory: (best: string, bestPct: number, worst: string, worstPct: number): PillPart[] => ['En güçlü günün ', { em: best }, ` (%${bestPct}), en zayıfı `, { em: worst }, ` (%${worstPct}).`],
    patternEven: 'Günler arasında belirgin bir fark yok.', patternEmpty: 'Desen için biraz daha veri gerekiyor.',
    plan: 'Plan', color: 'Renk', modeColor: (m: string) => `${m} modunun rengi — plan alışkanlıkları modla aynı renkte görünür.`, pause: 'Dinlendir', resume: 'Geri getir', remove: 'Sil',
    pauseHint: 'Geçmişi ve serisi korunur, bugünün listesinden çıkar.',
    removeTitle: 'Alışkanlığı sil?', removeBody: (n: string) => `"${n}" ve bütün geçmişi silinecek. Bu geri alınamaz.`, cancel: 'Vazgeç',
    weekdays: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'], weekdaysLong: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
    locale: 'tr-TR', dayA11y: (d: string, s: string) => `${d}: ${s}`,
    states: { done: 'yapıldı', rest: 'mola', missed: 'kaçtı', today: 'bugün, bekliyor', off: 'plan dışı', future: 'gelecek', before: 'başlamadan önce' } as Record<string, string>,
  },
  en: {
    notFound: 'Habit not found.', back: 'Back',
    today: 'TODAY', doneToday: 'Done today.', notYet: 'Not done yet today.', rested: 'Break day today.', notPlanned: 'Not planned today.',
    rescue: 'Missed yesterday — do it today to keep the chain.',
    streak: 'Streak', best: 'Best', consistency: 'Consistency', total: 'Total',
    day: 'd', week: 'wk', times: 'times',
    nextMilestone: (n: number, left: number) => `${left} to go until ${n} times`, allMilestones: 'Every milestone reached',
    calendar: 'Calendar', calendarHint: 'Tap a day: check · hold: break',
    prevMonth: 'Previous month', nextMonth: 'Next month',
    pattern: 'Days of the week', patternHint: 'Last 12 weeks, share of planned days done',
    patternStory: (best: string, bestPct: number, worst: string, worstPct: number): PillPart[] => ['Your strongest day is ', { em: best }, ` (${bestPct}%), weakest `, { em: worst }, ` (${worstPct}%).`],
    patternEven: 'No clear difference between days.', patternEmpty: 'A little more data is needed for a pattern.',
    plan: 'Plan', color: 'Color', modeColor: (m: string) => `The ${m} mode's color — plan habits share their mode's color.`, pause: 'Rest', resume: 'Bring back', remove: 'Delete',
    pauseHint: 'History and streak are kept; it leaves today’s list.',
    removeTitle: 'Delete habit?', removeBody: (n: string) => `"${n}" and all its history will be deleted. This can’t be undone.`, cancel: 'Cancel',
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    locale: 'en-US', dayA11y: (d: string, s: string) => `${d}: ${s}`,
    states: { done: 'done', rest: 'break', missed: 'missed', today: 'today, pending', off: 'not planned', future: 'upcoming', before: 'before start' } as Record<string, string>,
  },
};

const CELL = 36;

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const { theme, isDark } = useAppTheme();
  const dc = useDisplayColors();
  const reduce = useReduceMotion();
  const language = useLanguageStore(s => s.language);
  const lang = language === 'en' ? 'en' : 'tr';
  const c = COPY[lang];
  const habit = useHabitStore(s => s.habits.find(h => h.id === id));
  const tapHabit = useHabitStore(s => s.tapHabit);
  const toggleSkip = useHabitStore(s => s.toggleSkipDate);
  const updatePlan = useHabitStore(s => s.updatePlan);
  const pauseHabit = useHabitStore(s => s.pauseHabit);
  const resumeHabit = useHabitStore(s => s.resumeHabit);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const setHabitColor = useHabitStore(s => s.setHabitColor);
  const today = fmtDateKey();
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [planOpen, setPlanOpen] = useState(false);

  const grid = useMemo(() => monthGrid(month.y, month.m), [month]);

  if (!habit) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <Text style={{ marginTop: topBarSpace(insets.top) + S.lg, textAlign: 'center', color: theme.onSurfaceVariant, fontSize: F.body }}>{c.notFound}</Text>
      </View>
    );
  }

  const color = habitColor(habit, isDark);
  const st = streakStats(habit, today);
  const cons = consistency(habit, today);
  const ms = milestone(habit);
  const unit = st.unit === 'week' ? c.week : c.day;
  const doneToday = (habit.completedDates ?? []).includes(today);
  const restToday = (habit.skippedDates ?? []).includes(today);
  const due = isDueToday(habit, today) || doneToday;
  const status = doneToday ? c.doneToday : restToday ? c.rested : !due ? c.notPlanned : c.notYet;
  const rescue = !doneToday && !restToday && due && missState(habit, today) === 'missed';
  const pattern = weekdayPattern(habit, today);
  const rated = pattern.map((p, i) => ({ p, i })).filter(x => x.p != null) as { p: number; i: number }[];
  const bestDay = rated.slice().sort((a, b) => b.p - a.p)[0];
  const worstDay = rated.slice().sort((a, b) => a.p - b.p)[0];
  const monthTitle = new Date(month.y, month.m, 1).toLocaleDateString(c.locale, { month: 'long', year: 'numeric' });
  const isCurrentMonth = month.y === new Date().getFullYear() && month.m === new Date().getMonth();

  const mark = (key: string) => {
    const was = (habit.completedDates ?? []).includes(key);
    was ? haptic.surface() : haptic.success();
    tapHabit(habit.id, key);
    if (!was) celebrateMilestone(habit.id, key);
  };
  const rest = (key: string) => { haptic.surface(); toggleSkip(habit.id, key); };
  const shiftMonth = (d: number) => { haptic.select(); setMonth(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; }); };
  const confirmRemove = () => Alert.alert(c.removeTitle, c.removeBody(habit.name), [
    { text: c.cancel, style: 'cancel' },
    { text: c.remove, style: 'destructive', onPress: () => { haptic.commit(); removeHabit(habit.id); router.back(); } },
  ]);

  const card = { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderRadius: R.md, borderWidth: isDark ? B_THIN : 0, borderColor: theme.outline, padding: S.md, gap: S.smd } as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={habit.name} subtitle={planSummary(habit, lang)} />
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1–2) Bugün + zincir */}
        <DisplayPanel padding={S.md}>
          <View style={styles.todayRow}>
            <HabitBubble
              item={{ id: habit.id, title: habit.name, emoji: habit.emoji, color, isCompleted: doneToday, isSkipped: restToday, count: countOn(habit, today), target: targetOf(habit), missed: rescue }}
              theme={theme} isDark={isDark} tr={lang === 'tr'}
              onPress={() => mark(today)} onLongPress={() => rest(today)} />
            <View style={{ flex: 1, gap: S.xs }}>
              <Text style={[styles.cap, { color: dc.label }]}>{c.today}</Text>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: doneToday ? color : dc.ink }}>{status}</Text>
              {rescue && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.rescue}</Text>}
            </View>
          </View>
          <DisplayDivider />
          <View style={styles.readouts}>
            <DisplayReadout style={{ flex: 1 }} label={c.streak} value={`${st.current} ${unit}`} />
            <DisplayReadout style={{ flex: 1 }} label={c.best} value={`${Math.max(st.longest, st.current)} ${unit}`} />
            <DisplayReadout style={{ flex: 1 }} label={c.consistency} value={cons == null ? '—' : `%${cons}`} />
            <DisplayReadout label={c.total} value={String(ms.total)} />
          </View>
          {/* Kilometre taşı: toplam tekrar asla düşmez — biriken bir hedef. */}
          <View style={{ marginTop: S.md, gap: S.xs }}>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{ms.next ? c.nextMilestone(ms.next, ms.next - ms.total) : c.allMilestones}</Text>
            <View style={[styles.track, { backgroundColor: color + (isDark ? '2E' : '22') }]}>
              <MotiView from={{ width: reduce ? `${pct(ms)}%` : '0%' }} animate={{ width: `${pct(ms)}%` }} transition={{ type: 'timing', duration: 700 }}
                style={{ height: '100%', borderRadius: R.full, backgroundColor: color }} />
            </View>
          </View>
        </DisplayPanel>

        {/* 3) Takvim */}
        <View style={card}>
          <View style={styles.monthHead}>
            <Touchable onPress={() => shiftMonth(-1)} accessibilityRole="button" accessibilityLabel={c.prevMonth} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
              <ChevronLeft size={ICON.sm} color={theme.onSurface} />
            </Touchable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface }}>{monthTitle}</Text>
            <Touchable disabled={isCurrentMonth} onPress={() => shiftMonth(1)} accessibilityRole="button" accessibilityLabel={c.nextMonth}
              accessibilityState={{ disabled: isCurrentMonth }} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }} style={{ opacity: isCurrentMonth ? 0.3 : 1 }}>
              <ChevronRight size={ICON.sm} color={theme.onSurface} />
            </Touchable>
          </View>
          <View style={styles.week}>
            {c.weekdays.map((w, i) => <Text key={i} style={[styles.wd, { color: theme.onSurfaceMuted }]}>{w}</Text>)}
          </View>
          {grid.map((row, ri) => (
            <View key={ri} style={styles.week}>
              {row.map((key, ci) => {
                if (!key) return <View key={ci} style={styles.cellSlot} />;
                const s = cellState(habit, key, today);
                const disabled = s === 'future' || s === 'before';
                const n = Number(key.slice(8));
                const look = s === 'done' ? { backgroundColor: color }
                  : s === 'rest' ? { backgroundColor: theme.warning + '2E', borderWidth: 1.5, borderColor: theme.warning }
                  : s === 'today' ? { borderWidth: 2, borderColor: color }
                  : s === 'missed' ? { borderWidth: 1.5, borderColor: theme.onSurfaceMuted + '80' }
                  : {};
                return (
                  <View key={ci} style={styles.cellSlot}>
                    <Touchable disabled={disabled} onPress={() => mark(key)} onLongPress={() => rest(key)} accessibilityRole="checkbox"
                      accessibilityState={{ checked: s === 'done', disabled }}
                      accessibilityLabel={c.dayA11y(new Date(`${key}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long' }), c.states[s])}>
                      <MotiView key={s} from={{ scale: reduce || s !== 'done' ? 1 : 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13, stiffness: 260 }}
                        style={[styles.cell, look]}>
                        {s === 'rest'
                          ? <Coffee size={ICON.xs} color={theme.warning} />
                          : <Text style={{ fontSize: F.footnote, fontWeight: s === 'today' ? W.bold : W.medium, fontVariant: ['tabular-nums'],
                              color: s === 'done' ? theme.onPrimary : disabled ? theme.onSurfaceMuted : s === 'off' ? theme.onSurfaceVariant : theme.onSurface,
                              opacity: s === 'future' || s === 'before' ? 0.45 : 1 }}>{n}</Text>}
                      </MotiView>
                    </Touchable>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'center' }}>{c.calendarHint}</Text>
        </View>

        {/* 4) Desen */}
        <View style={card}>
          <View style={{ gap: S.xxs }}>
            <Text style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface }}>{c.pattern}</Text>
            <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.patternHint}</Text>
          </View>
          {rated.length < 3 ? (
            <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant }}>{c.patternEmpty}</Text>
          ) : bestDay && worstDay && bestDay.p - worstDay.p >= 0.15 ? (
            <PillSentence size="body" parts={c.patternStory(c.weekdaysLong[bestDay.i], Math.round(bestDay.p * 100), c.weekdaysLong[worstDay.i], Math.round(worstDay.p * 100)).map(p => (typeof p === 'string' ? p : { ...p, color }))} />
          ) : (
            <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant }}>{c.patternEven}</Text>
          )}
          {/* Veri yetersizken boş kutu çizilmez — yalnız cümle. */}
          {rated.length >= 3 && <View style={styles.bars}>
            {pattern.map((p, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: S.xs }}>
                <View style={[styles.barTrack, { backgroundColor: color + (isDark ? '24' : '1A') }]}>
                  {p != null && (
                    <MotiView from={{ height: '0%' }} animate={{ height: `${Math.round(p * 100)}%` }} transition={{ type: 'timing', duration: reduce ? 0 : 600, delay: reduce ? 0 : i * 50 }}
                      style={{ width: '100%', borderRadius: R.sm, backgroundColor: color }} />
                  )}
                </View>
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.weekdays[i]}</Text>
              </View>
            ))}
          </View>}
        </View>

        {/* Plan ve yönetim */}
        <View style={[card, { padding: 0, gap: 0 }]}>
          <Touchable onPress={() => setPlanOpen(true)} accessibilityRole="button" style={styles.action}>
            <SlidersHorizontal size={ICON.sm} color={theme.onSurfaceVariant} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: F.body, color: theme.onSurface }}>{c.plan}</Text>
              <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{planSummary(habit, lang)}</Text>
            </View>
            <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
          </Touchable>
          <View style={{ height: HAIRLINE, backgroundColor: theme.separator, marginLeft: S.md }} />
          {/* RENK — elle eklenende kullanıcı seçer (ölçülmüş palet); mod alışkanlığı modunun rengini taşır. */}
          <View style={[styles.action, { flexDirection: 'column', alignItems: 'stretch', gap: S.sm }]}>
            <Text style={{ fontSize: F.body, color: theme.onSurface }}>{c.color}</Text>
            {habit.planMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Text style={{ flex: 1, fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.modeColor(modeFamily(habit.planMode))}</Text>
              </View>
            ) : (
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {HABIT_PALETTE.map((p, i) => {
                  const col = isDark ? p.dark : p.light;
                  const selected = paletteOf(habit.color).id === p.id;
                  return (
                    <Touchable key={p.id} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} accessibilityLabel={`${c.color} ${i + 1}`}
                      onPress={() => { if (!selected) { haptic.select(); setHabitColor(habit.id, p.light); } }}
                      style={[styles.swatchRing, { borderColor: selected ? col : 'transparent' }]}>
                      <View style={[styles.swatch, { backgroundColor: col }]} />
                    </Touchable>
                  );
                })}
              </View>
            )}
          </View>
          <View style={{ height: HAIRLINE, backgroundColor: theme.separator, marginLeft: S.md }} />
          <Touchable onPress={() => { haptic.commit(); habit.pausedAt ? resumeHabit(habit.id) : pauseHabit(habit.id); }} accessibilityRole="button" style={styles.action}>
            {habit.pausedAt ? <Play size={ICON.sm} color={theme.onSurfaceVariant} /> : <Pause size={ICON.sm} color={theme.onSurfaceVariant} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: F.body, color: theme.onSurface }}>{habit.pausedAt ? c.resume : c.pause}</Text>
              {!habit.pausedAt && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.pauseHint}</Text>}
            </View>
          </Touchable>
          <View style={{ height: HAIRLINE, backgroundColor: theme.separator, marginLeft: S.md }} />
          <Touchable onPress={confirmRemove} accessibilityRole="button" style={styles.action}>
            <Trash2 size={ICON.sm} color={theme.error} />
            <Text style={{ flex: 1, fontSize: F.body, color: theme.error }}>{c.remove}</Text>
          </Touchable>
        </View>
      </ScrollView>

      <HabitPlanSheet visible={planOpen} title={habit.name} color={color}
        initial={{ schedule: habit.schedule, target: habit.target, unit: habit.unit, slot: habit.slot, autoFrom: habit.autoFrom }}
        onSave={p => updatePlan(habit.id, p)} onClose={() => setPlanOpen(false)}
        theme={theme} isDark={isDark} lang={lang} />
    </View>
  );
}

const B_THIN = StyleSheet.hairlineWidth * 2;
const pct = (ms: { total: number; next: number | null }) => (ms.next ? Math.min(100, Math.round((ms.total / ms.next) * 100)) : 100);

const styles = StyleSheet.create({
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  cap: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  readouts: { flexDirection: 'row', gap: S.sm },
  track: { height: S.xs, borderRadius: R.full, overflow: 'hidden' },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  week: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: F.caption, fontWeight: W.semibold },
  cellSlot: { flex: 1, alignItems: 'center', paddingVertical: S.xxs },
  cell: { width: CELL, height: CELL, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: S.sm, alignItems: 'flex-end' },
  barTrack: { width: '100%', height: S.xxl, borderRadius: R.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  swatch: { width: S.lg, height: S.lg, borderRadius: R.full },
  swatchRing: { padding: S.xxs, borderRadius: R.full, borderWidth: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingHorizontal: S.md, paddingVertical: S.smd, minHeight: 52 },
});
