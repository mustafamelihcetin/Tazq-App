import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Coffee } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { HabitLiquid } from '@/features/habits/components/HabitLiquid';
import { modeOf } from '@/features/habits/utils/habitLimit';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, useDisplayColors } from '@/shared/components/DisplayPanel';
import { countOn, targetOf, type HabitLike } from '@/features/habits/utils/habitSchedule';
import { habitWeek } from '@/features/week/habitWeek';
import { cellState, streakStats } from '@/features/habits/utils/habitStats';
import { habitColor } from '@/features/habits/utils/habitColor';

/*
  ALIŞKANLIKLAR — Haftalık Merkez kartı (2026-10-31). 7 alışkanlıkla cihazda ölçüldü: iki satırlık
  satırlar, alt alta altı büyük halka, çoğu soluk nokta — "karmaşa var, bugünü nasıl işaretleyeceğimi
  ben bile anlamadım". Uygulamanın kullanıcıya zaten öğrettiği kalıba döndü: GÖREV SATIRI.
    · SOLDA yuvarlak ✓ = bugün yapıldı (görevlerdeki gibi; basılı tut = mola). Tek eylem, tek yer.
    · ORTADA ad + "seri · tutarlılık".
    · SAĞDA haftanın 7 noktası — yalnız BİLGİ: dolu = yapıldı.
    · Satıra dokun → alışkanlığın sayfası (takvim: geçmiş günü düzeltmek orada).
  Gün başlığı ve açıklama satırı yok: kalıp kendini anlatıyor.
  2026-11-05 (kullanıcı: "ulaşması zor, mantıksal olarak havada kalıyor"): kart üstteki gün seçimini izler. Yuvarlak SEÇİLİ güne işaretler; geçmişi unutan buradan düzeltir, gelecek gün işaretlenmez.
*/

const CHECK = 32;

function TodayCheck({ h, today, color, onTap, onHold, label, disabled }: {
  h: HabitLike; today: string; color: string; onTap: () => void; onHold: () => void; label: string; disabled: boolean;
}) {
  const { theme } = useAppTheme();
  const done = (h.completedDates ?? []).includes(today);
  const rest = (h.skippedDates ?? []).includes(today);
  const target = targetOf(h);
  const count = countOn(h, today);
  return (
    <Touchable disabled={disabled} onPress={onTap} onLongPress={onHold} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled }} accessibilityLabel={label}
      hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
      <View style={disabled ? { opacity: 0.35 } : undefined}>
        <HabitLiquid size={CHECK} stroke={2} ratio={rest ? 0 : done ? 1 : Math.min(1, count / target)} color={color} track={rest ? theme.warning : color}>
          {done ? <Check size={ICON.sm} color={theme.onPrimary} strokeWidth={3} />
            : rest ? <Coffee size={ICON.xs} color={theme.warning} />
            : target > 1 && count > 0 ? <Text style={{ fontSize: F.caption2, fontWeight: W.bold, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{count}</Text>
            : null}
        </HabitLiquid>
      </View>
    </Touchable>
  );
}

/** Bugünün (henüz yapılmamış) noktası: alışkanlığın renginde soluk dolgu. */
const TODAY_ALPHA = '4D';
const DOT = 7;

/** Haftanın 7 noktası — Planım'daki rutinlerle aynı dil (2026-11-05: minik çubuklar okunmuyordu). Yalnız bilgi. */
function WeekDots({ h, weekKeys, today, color }: { h: HabitLike; weekKeys: string[]; today: string; color: string }) {
  const { theme, isDark } = useAppTheme();
  const faint = theme.onSurface + (isDark ? '24' : '17');
  return (
    <View style={styles.dots} accessible={false}>
      {weekKeys.map(k => {
        const st = cellState(h, k, today);
        return <View key={k} style={[styles.dot, { backgroundColor: st === 'done' ? color : st === 'rest' ? theme.warning + '99' : st === 'today' ? color + TODAY_ALPHA : faint }]} />;
      })}
    </View>
  );
}

export function WeekHabits<T extends HabitLike & { id: string; name: string; color?: string; planMode?: string | null }>({
  label, count, ownLabel, ownLimit, goalLabel, habits, weekKeys, todayKey, dayKey, onToday, onTodayHold, onOpen, renderName, todayLabel, streakLabel, weekLabel,
}: {
  label: string; count: string; ownLabel: string; ownLimit: number; goalLabel: string;
  habits: T[]; weekKeys: string[]; todayKey: string;
  /** Üstte seçili gün: yuvarlak bu güne işaretler. */
  dayKey: string;
  onToday: (h: T) => void; onTodayHold: (h: T) => void; onOpen: (h: T) => void;
  /** Ad + alt bilgi (erişilebilirlik çağıranda kalır). */
  renderName: (h: T, sub: string) => React.ReactNode;
  todayLabel: (h: T, done: boolean) => string;
  streakLabel: (n: number, unit: 'day' | 'week') => string;
  /** Haftanın sayısı ("bu hafta 6/7") — dil çağıranda. */
  weekLabel: (done: number, goal: number) => string;
}) {
  const { theme, isDark } = useAppTheme();
  const dc = useDisplayColors();
  const own = habits.filter(h => !modeOf(h));
  const fromGoals = habits.filter(h => !!modeOf(h));
  return (
    <DisplayPanel padding={S.md}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: F.body, fontWeight: W.bold, color: dc.ink }}>{label}</Text>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: dc.muted }}>{count}</Text>
      </View>
      {/* İki ayrı hesap (bkz. habitLimit): kullanıcının kendi hakkı görünür, hedeflerin rutinleri ona karışmaz. */}
      {[{ key: 'own', list: own, title: `${ownLabel} ${own.length}/${ownLimit}` }, { key: 'goal', list: fromGoals, title: goalLabel }].filter(g => g.list.length > 0).map(g => (
        <View key={g.key} style={styles.list}>
          {own.length > 0 && fromGoals.length > 0 && <Text style={[styles.group, { color: dc.muted }]}>{g.title}</Text>}
          {g.list.map((h, i) => {
            const color = habitColor(h, isDark);
            const st = streakStats(h, todayKey);
            /*
              HAFTANIN SAYISI ("bu hafta 6/7"). Eskiden son 30 günün tutarlılığı etiketsiz "%20" diye
              yazıyordu: bu hafta her gün yapılmış alışkanlığın yanında %20 — haftalık ekranda yanlış
              okunuyordu, üstelik cümledeki haftalık yüzdeyle yan yana iki farklı yüzde.
            */
            const wk = habitWeek(h, weekKeys, todayKey);
            const sub = [st.current > 0 ? streakLabel(st.current, st.unit) : '', weekLabel(wk.done, wk.goal)].filter(Boolean).join(' · ');
            return (
              <View key={h.id} style={[styles.row, i > 0 && { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
                <TodayCheck h={h} today={dayKey} color={color} disabled={dayKey > todayKey} onTap={() => onToday(h)} onHold={() => onTodayHold(h)}
                  label={todayLabel(h, (h.completedDates ?? []).includes(dayKey))} />
                <Touchable onPress={() => onOpen(h)} style={styles.body} accessible={false}>
                  <View style={{ flex: 1, minWidth: 0 }}>{renderName(h, sub)}</View>
                  <WeekDots h={h} weekKeys={weekKeys} today={todayKey} color={color} />
                </Touchable>
              </View>
            );
          })}
        </View>
      ))}
    </DisplayPanel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  list: { marginTop: S.sm },
  group: { fontSize: F.caption, fontWeight: W.semibold, marginBottom: S.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 56 },
  check: { width: CHECK, height: CHECK, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm, alignSelf: 'stretch' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  dot: { width: DOT, height: DOT, borderRadius: R.full },
});
