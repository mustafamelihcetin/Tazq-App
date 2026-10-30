import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Play, Check, Coffee, Flame, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { DISPLAY_FONT, useDisplayColors } from '@/shared/components/DisplayPanel';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { sessionDayKey } from '@/features/report/weeklyReport';
import { toDateKey } from '@/shared/utils/dateKey';
import { S, R, F, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  OKUMAYA DOKUN, İÇİ AÇILSIN (2026-10-30, kullanıcı: "etkileşimli, anlam katsın, sıkmasın
  germesin"). Akıllı saat komplikasyonu gibi: ekrandaki bir okumaya dokununca panel o konuyu
  açar — ana sayfadan çıkmadan bir sonraki adım:
   · ODAK: bugünkü seanslar + toplam/hedef + "Odaklan" (panelden doğrudan odağa)
   · GÖREVLER: sıradaki üç iş, ilkinde "Odaklan"; "Tümü" Görevler'e
   · ALIŞKANLIKLAR: bugünkü durum (yapıldı / mola / bekliyor) ve seriler. İşaretleme hemen
     alttaki şeritte — aynı eylem iki yerde olmasın (ses/kutlama/seri kuralları orada tek).
  Kısa bir belirme/sönme; sürekli hareket yok.
*/

export type DetailKind = 'tasks' | 'focus' | 'habits';
export interface DetailTask { id: number | string; title: string }
export interface DetailHabit { id: string | number; title: string; done: boolean; skipped: boolean; streak: number }

const COPY = {
  tr: { focusToday: (m: number, g: number) => `Bugün ${m} / ${g} dk`, noSessions: 'Bugün henüz odak seansı yok. Kısa bir başlangıç yeter.', focus: 'Odaklan', all: 'Tümü', noTasks: 'Bugün için bekleyen iş yok.', habitsLink: 'Alışkanlıklar', noHabits: 'Bugün için alışkanlık yok.', min: 'dk', rest: 'mola' },
  en: { focusToday: (m: number, g: number) => `Today ${m} / ${g} min`, noSessions: 'No focus sessions yet today. A short start is enough.', focus: 'Focus', all: 'All', noTasks: 'Nothing waiting for today.', habitsLink: 'Habits', noHabits: 'No habits for today.', min: 'min', rest: 'rest' },
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export function TodayDetail({ kind, tasks, habits, focusMin, focusGoal, onFocusTask }: {
  kind: DetailKind;
  tasks: DetailTask[];
  habits: DetailHabit[];
  focusMin: number;
  focusGoal: number;
  /** Görevi seçili olarak odak ekranına götürür; görev yoksa serbest odak. */
  onFocusTask: (task?: DetailTask) => void;
}) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const language = useLanguageStore(st => st.language);
  const c = COPY[language === 'en' ? 'en' : 'tr'];
  const sessions = useFocusHistoryStore(st => st.sessions);
  const todayKey = toDateKey(new Date());
  const today = sessions.filter(s => sessionDayKey(s.startedAt) === todayKey).slice(-3).reverse();

  const cta = (label: string, onPress: () => void, icon?: React.ReactNode) => (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={[styles.cta, { backgroundColor: theme.primary }]}>
      {icon}
      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onPrimary }}>{label}</Text>
    </Touchable>
  );
  const link = (label: string, onPress: () => void) => (
    <Touchable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={styles.link} hitSlop={{ top: S.sm, bottom: S.sm }}>
      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{label}</Text>
      <ChevronRight size={ICON.xs} color={theme.primary} />
    </Touchable>
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={[styles.box, { borderColor: dc.divider }]}>
      {kind === 'focus' && (
        <>
          <Text style={[styles.head, { color: dc.ink }]}>{c.focusToday(focusMin, focusGoal)}</Text>
          {today.length === 0 ? <Text style={[styles.note, { color: dc.muted }]}>{c.noSessions}</Text> : today.map((s, i) => {
            const d = new Date(s.startedAt);
            return (
              <View key={i} style={styles.row}>
                <Text style={[styles.mono, { color: dc.muted }]}>{`${pad2(d.getHours())}:${pad2(d.getMinutes())}`}</Text>
                <Text style={[styles.mono, { color: dc.ink }]}>{`${s.minutes} ${c.min}`}</Text>
              </View>
            );
          })}
          <View style={styles.actions}>{cta(c.focus, () => onFocusTask(), <Play size={ICON.xs} color={theme.onPrimary} fill={theme.onPrimary} />)}</View>
        </>
      )}

      {kind === 'tasks' && (
        <>
          {tasks.length === 0 ? <Text style={[styles.note, { color: dc.muted }]}>{c.noTasks}</Text> : tasks.slice(0, 3).map((t, i) => (
            <View key={t.id} style={styles.row}>
              <Text style={[styles.item, { color: dc.ink }]} numberOfLines={1}>{t.title}</Text>
              {i === 0 && (
                <Touchable onPress={() => onFocusTask(t)} accessibilityRole="button" accessibilityLabel={`${c.focus}: ${t.title}`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[styles.mini, { backgroundColor: theme.primary + '1F' }]}>
                  <Play size={ICON.xs} color={theme.primary} fill={theme.primary} />
                </Touchable>
              )}
            </View>
          ))}
          <View style={styles.actions}>{link(c.all, () => router.push('/tasks'))}</View>
        </>
      )}

      {kind === 'habits' && (
        <>
          {habits.length === 0 ? <Text style={[styles.note, { color: dc.muted }]}>{c.noHabits}</Text> : habits.slice(0, 4).map(h => (
            <View key={h.id} style={styles.row}>
              <View style={[styles.state, { backgroundColor: h.done ? theme.tertiary : h.skipped ? theme.warning + '33' : 'transparent', borderColor: h.done ? theme.tertiary : dc.divider }]}>
                {h.done ? <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} /> : h.skipped ? <Coffee size={ICON.xs} color={theme.warning} /> : null}
              </View>
              <Text style={[styles.item, { color: h.done ? dc.muted : dc.ink }]} numberOfLines={1}>{h.title}</Text>
              {h.streak >= 2 && (
                <View style={styles.streak}>
                  <Flame size={ICON.xs} color={theme.streak} />
                  <Text style={[styles.mono, { color: dc.muted }]}>{h.streak}</Text>
                </View>
              )}
            </View>
          ))}
          <View style={styles.actions}>{link(c.habitsLink, () => router.push('/cockpit'))}</View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: S.md, paddingTop: S.md, borderTopWidth: StyleSheet.hairlineWidth, gap: S.sm },
  head: { fontFamily: DISPLAY_FONT.digits, fontSize: F.callout },
  note: { fontSize: F.footnote },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 28 },
  item: { flex: 1, fontSize: F.body, fontWeight: W.medium },
  mono: { fontFamily: DISPLAY_FONT.digits, fontSize: F.footnote, fontVariant: ['tabular-nums'] },
  state: { width: 18, height: 18, borderRadius: R.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  mini: { width: MIN_TOUCH - 12, height: MIN_TOUCH - 12, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: S.xs },
  cta: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: 36, paddingHorizontal: S.md, borderRadius: R.full },
  link: { flexDirection: 'row', alignItems: 'center', gap: S.xxs, minHeight: 32 },
});
