import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check, Coffee } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, useDisplayColors } from '@/shared/components/DisplayPanel';
import { PillSentence } from '@/shared/components/PillSentence';
import { consistency, countOn, targetOf, type HabitLike } from '@/features/habits/utils/habitSchedule';
import { cellState, streakStats } from '@/features/habits/utils/habitStats';
import { habitColor } from '@/features/habits/utils/habitColor';
import type { WeekSeg } from '@/features/week/WeekPanel';

/*
  ALIŞKANLIKLAR — Haftalık Merkez kartı (2026-10-31). 7 alışkanlıkla cihazda ölçüldü: iki satırlık
  satırlar, alt alta altı büyük halka, çoğu soluk nokta — "karmaşa var, bugünü nasıl işaretleyeceğimi
  ben bile anlamadım". Uygulamanın kullanıcıya zaten öğrettiği kalıba döndü: GÖREV SATIRI.
    · SOLDA yuvarlak ✓ = bugün yapıldı (görevlerdeki gibi; basılı tut = mola). Tek eylem, tek yer.
    · ORTADA ad + "seri · tutarlılık".
    · SAĞDA haftanın 7 küçük çubuğu — yalnız BİLGİ: dolu = yapıldı, kısa = plan dışı/henüz değil.
    · Satıra dokun → alışkanlığın sayfası (takvim: geçmiş günü düzeltmek orada).
  Gün başlığı ve açıklama satırı yok: kalıp kendini anlatıyor.
*/

const CHECK = 28;

function TodayCheck({ h, today, color, onTap, onHold, label }: {
  h: HabitLike; today: string; color: string; onTap: () => void; onHold: () => void; label: string;
}) {
  const { theme } = useAppTheme();
  const reduce = useReduceMotion();
  const done = (h.completedDates ?? []).includes(today);
  const rest = (h.skippedDates ?? []).includes(today);
  const target = targetOf(h);
  const count = countOn(h, today);
  const state = done ? 'done' : rest ? 'rest' : `c${count}`;
  return (
    <Touchable onPress={onTap} onLongPress={onHold} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label}
      hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
      <MotiView key={state} from={{ scale: reduce || !done ? 1 : 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 280 }}
        style={[styles.check, done ? { backgroundColor: color } : rest ? { borderWidth: 1.5, borderColor: theme.warning } : { borderWidth: 2, borderColor: color }]}>
        {done ? <Check size={ICON.sm} color={theme.onPrimary} strokeWidth={3} />
          : rest ? <Coffee size={ICON.xs} color={theme.warning} />
          : target > 1 && count > 0 ? <Text style={{ fontSize: F.caption2, fontWeight: W.bold, color, fontVariant: ['tabular-nums'] }}>{count}</Text>
          : null}
      </MotiView>
    </Touchable>
  );
}

/** Haftanın 7 çubuğu — yalnız bilgi. */
function WeekBars({ h, weekKeys, today, color }: { h: HabitLike; weekKeys: string[]; today: string; color: string }) {
  const { theme, isDark } = useAppTheme();
  const faint = theme.onSurface + (isDark ? '24' : '17');
  return (
    <View style={styles.bars} accessible={false}>
      {weekKeys.map(k => {
        const st = cellState(h, k, today);
        const tall = st === 'done' || st === 'missed' || st === 'today' || st === 'rest';
        return (
          <View key={k} style={[styles.bar, {
            height: tall ? S.smd : S.xs,
            backgroundColor: st === 'done' ? color : st === 'rest' ? theme.warning + '99' : faint,
            borderWidth: st === 'today' ? 1 : 0, borderColor: color,
          }]} />
        );
      })}
    </View>
  );
}

export function WeekHabits<T extends HabitLike & { id: string; name: string; color?: string; planMode?: string | null }>({
  label, story, habits, weekKeys, todayKey, onToday, onTodayHold, onOpen, renderName, todayLabel, streakLabel,
}: {
  label: string; story: WeekSeg[];
  habits: T[]; weekKeys: string[]; todayKey: string;
  onToday: (h: T) => void; onTodayHold: (h: T) => void; onOpen: (h: T) => void;
  /** Ad + alt bilgi (erişilebilirlik çağıranda kalır). */
  renderName: (h: T, sub: string) => React.ReactNode;
  todayLabel: (h: T, done: boolean) => string;
  streakLabel: (n: number, unit: 'day' | 'week') => string;
}) {
  const { theme, isDark } = useAppTheme();
  const dc = useDisplayColors();
  return (
    <DisplayPanel padding={S.md}>
      <Text style={[styles.label, { color: dc.label }]}>{label}</Text>
      <PillSentence parts={story} size="body" />
      <View style={styles.list}>
        {habits.map((h, i) => {
          const color = habitColor(h, isDark);
          const st = streakStats(h, todayKey);
          const cons = consistency(h, todayKey);
          const sub = [st.current > 0 ? streakLabel(st.current, st.unit) : '', cons != null ? `%${cons}` : ''].filter(Boolean).join(' · ');
          return (
            <View key={h.id} style={[styles.row, i > 0 && { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
              <TodayCheck h={h} today={todayKey} color={color} onTap={() => onToday(h)} onHold={() => onTodayHold(h)}
                label={todayLabel(h, (h.completedDates ?? []).includes(todayKey))} />
              <Touchable onPress={() => onOpen(h)} style={styles.body} accessible={false}>
                <View style={{ flex: 1, minWidth: 0 }}>{renderName(h, sub)}</View>
                <WeekBars h={h} weekKeys={weekKeys} today={todayKey} color={color} />
              </Touchable>
            </View>
          );
        })}
      </View>
    </DisplayPanel>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2, marginBottom: S.sm },
  list: { marginTop: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 56 },
  check: { width: CHECK, height: CHECK, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, alignSelf: 'stretch' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs, height: S.smd },
  bar: { width: S.xs + 1, borderRadius: R.full },
});
