import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, F } from '@/shared/constants/tokens';
import { haptic } from '@/shared/utils/haptics';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useActiveHabitList } from '@/features/habits/hooks/useActiveHabitList';
import { HabitBubble } from '@/features/habits/components/HabitBubble';
import { BentoCard } from '@/shared/components/BentoCard';
import { celebrateMilestone } from '@/features/habits/utils/autoMark';
import { habitColor } from '@/features/habits/utils/habitColor';
import { isDueToday, pendingOn, missState, countOn, targetOf, weekProgress, addDays, type HabitLike } from '@/features/habits/utils/habitSchedule';

/*
  GÜN SONU — ALIŞKANLIKLAR (2026-10-30). Akşam özeti ("2 alışkanlık bekliyor") Bugün ekranını açar;
  burada aynı halkalar tek şeritte: hepsi birkaç saniyede kapanır. Kullanıcı: "gün gün işaretlemek
  angarya gibi gelebilir" — gün içinde unutulan, günün sonunda tek yerden toplanır.
  SABAH DÜZELTMESİ: dün işaretlenmemiş planlı alışkanlık varsa (öğleye kadar) ayrı bir "Dün" şeridi
  çıkar — unutulan işaret düzeltilir, yapılmayan kaçırma olarak kalır (dürüst kayıt).
  Başta tek cümle: ne kaldı, ve "iki kez kaçırma" — dün kaçan bugün yapılırsa zincir sürer.
*/

const COPY = {
  tr: {
    title: 'Alışkanlıklar', yesterday: 'Dün', allDone: 'Bugünün alışkanlıkları tamam.',
    left: (n: number) => `${n} alışkanlık bekliyor.`,
    rescue: (name: string) => `${name} dün kaçtı — bugün yaparsan zincir sürer.`,
    yesterdayHint: 'İşaretlemeyi unuttuysan şimdi düzelt.',
  },
  en: {
    title: 'Habits', yesterday: 'Yesterday', allDone: "Today's habits are done.",
    left: (n: number) => `${n} habit${n > 1 ? 's' : ''} waiting.`,
    rescue: (name: string) => `${name} was missed yesterday — do it today to keep the chain.`,
    yesterdayHint: 'Forgot to check it off? Fix it now.',
  },
};

export function DayCloseHabits({ theme, isDark, lang, now = new Date() }: { theme: AppTheme; isDark: boolean; lang: 'tr' | 'en'; now?: Date }) {
  const habits = useActiveHabitList();
  const tapHabit = useHabitStore(s => s.tapHabit);
  const toggleSkip = useHabitStore(s => s.toggleSkipDate);
  const c = COPY[lang];
  const today = fmtDateKey(now);
  const yesterday = addDays(today, -1);

  const due = habits.filter(h => isDueToday(h, today));
  if (due.length === 0) return null;
  const pending = pendingOn(due, today);
  const rescue = pending.find(h => missState(h, today) === 'missed');
  const forgot = now.getHours() < 12 ? pendingOn(habits.filter(h => isDueToday(h, yesterday)), yesterday) : [];

  const itemOf = (h: (typeof habits)[number], key: string) => {
    const week = weekProgress(h as HabitLike, key);
    return {
      id: h.id, title: h.name, color: habitColor(h, isDark), emoji: h.emoji,
      isCompleted: (h.completedDates ?? []).includes(key), isSkipped: (h.skippedDates ?? []).includes(key),
      count: countOn(h, key), target: targetOf(h), weekBadge: week && week.goal < 7 ? `${week.done}/${week.goal}` : null,
      missed: key === today && missState(h, today) === 'missed',
    };
  };

  const Rail = ({ list, day }: { list: typeof habits; day: string }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {list.map(h => {
        const item = itemOf(h, day);
        return (
          <HabitBubble key={`${day}-${h.id}`} item={item} theme={theme} isDark={isDark} tr={lang === 'tr'}
            onPress={() => { item.isCompleted ? haptic.surface() : haptic.success(); tapHabit(h.id, day); celebrateMilestone(h.id, day); }}
            onLongPress={() => { haptic.surface(); toggleSkip(h.id, day); }} />
        );
      })}
    </ScrollView>
  );

  return (
    <BentoCard index={1} style={[styles.wrap, { padding: S.md }]}>
      <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.title.toLocaleUpperCase(lang === 'en' ? 'en-US' : 'tr-TR')}</Text>
      <Text style={[styles.sentence, { color: pending.length === 0 ? theme.success : theme.onSurface }]}>
        {pending.length === 0 ? c.allDone : c.left(pending.length)}
        {rescue ? <Text style={{ color: theme.onSurfaceVariant }}>{` ${c.rescue(rescue.name)}`}</Text> : null}
      </Text>
      <Rail list={due} day={today} />
      {forgot.length > 0 && (
        <View style={{ gap: S.xs }}>
          <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.yesterday.toLocaleUpperCase(lang === 'en' ? 'en-US' : 'tr-TR')}</Text>
          <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>{c.yesterdayHint}</Text>
          <Rail list={forgot} day={yesterday} />
        </View>
      )}
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.sm },
  label: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.2 },
  sentence: { fontSize: F.body, lineHeight: F.body * 1.35 },
  hint: { fontSize: F.caption },
  rail: { gap: S.md, paddingVertical: S.xs },
});
