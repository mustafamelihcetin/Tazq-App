import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Coffee } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { HabitLiquid } from '@/features/habits/components/HabitLiquid';
import { useHabitCheck } from '@/features/habits/hooks/useHabitCheck';
import { compactHabitLabel } from '@/features/habits/utils/habitLabel';
import type { DayMark } from '@/features/habits/utils/habitSchedule';
import { renderModeEmojiIcon } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';
import { F, S, R, W, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { describeHabit } from '@/shared/utils/a11y';

/*
  BUGÜN'ÜN ALIŞKANLIK KUTUSU (2026-11-06, kullanıcı: "tam yakışmıyor, bir üst seviyeye çıkaralım").
  Repolardan: Kado'nun halkası (dolu = kayıtlı), mhabit'in sabit yükseklikli ızgarası, HabitBuilder ve Streak'in son 7 gün izi.
  Kart içinde kart yok: zemin ve çerçeve taşımaz, panelin bir parçası gibi durur. İz bilgi taşır: dün kaçtıysa boş nokta görünür,
  ayrı bir uyarı gerekmez. Biçim durumu söyler (dolu yapıldı, boş kaçtı, kısa çizgi plansız); renk körü de okur.
*/
const RING = 40;
const DOT = 5;

const COPY = {
  tr: { hint: 'Dokun: işaretle · Basılı tut: mola', week: (n: number, of: number) => `son 7 günün ${of} planlı gününde ${n} kez` },
  en: { hint: 'Tap to check · Hold for a break', week: (n: number, of: number) => `done ${n} of ${of} planned days this week` },
};

function DayTrail({ marks, color, theme }: { marks: DayMark[]; color: string; theme: AppTheme }) {
  const reduce = useReduceMotion();
  return (
    <View style={styles.trail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {marks.map((mark, i) => {
        const today = i === marks.length - 1;
        if (mark === 'off') return <View key={i} style={[styles.off, { backgroundColor: theme.onSurfaceMuted + '55' }]} />;
        if (mark === 'done') {
          return today
            // Yalnız bugünün noktası oynar: yapılan şey burada izine dönüşür.
            ? <MotiView key={i} from={{ scale: reduce ? 1 : 0.4 }} animate={{ scale: 1 }} transition={{ type: 'timing', duration: reduce ? 0 : 240 }} style={[styles.dot, { backgroundColor: color }]} />
            : <View key={i} style={[styles.dot, { backgroundColor: color }]} />;
        }
        if (mark === 'rest') return <View key={i} style={[styles.dot, { backgroundColor: theme.warning }]} />;
        return <View key={i} style={[styles.dot, styles.empty, { borderColor: today ? color : theme.onSurfaceMuted }]} />;
      })}
    </View>
  );
}

export interface HabitTileProps {
  item: {
    id: string;
    title?: string;
    color: string;
    emoji?: string;
    isCompleted?: boolean;
    isSkipped?: boolean;
    streak?: number;
    count?: number;
    target?: number;
    weekBadge?: string | null;
    days?: DayMark[];
  };
  theme: AppTheme;
  isDark: boolean;
  lang: 'tr' | 'en';
  onPress: () => void;
  onLongPress: () => void;
}

export const HabitTile = React.memo<HabitTileProps>(({ item, theme, isDark, lang, onPress, onLongPress }) => {
  const { target, isCompleted, count, isSkipped, ratio, burst, press } = useHabitCheck(item, onPress);
  const c = COPY[lang];

  // Bugün işaretlendiği an iz de güncel: kayıt bir kare sonra gelir, nokta beklemez.
  const marks = item.days?.map((m, i, all) => (i === all.length - 1 && isCompleted ? 'done' as const : m));
  const planned = marks?.filter(m => m !== 'off' && m !== 'rest').length ?? 0;
  const doneDays = marks?.filter(m => m === 'done').length ?? 0;

  const meta = isSkipped ? null : target > 1 && !isCompleted && count > 0 ? `${count}/${target}` : item.weekBadge ?? null;
  const track = isSkipped ? theme.warning + '66' : isCompleted ? item.color : theme.onSurface + (isDark ? '33' : '24');
  const iconColor = isSkipped ? theme.warning : ratio >= 0.5 ? theme.onPrimary : theme.onSurfaceVariant;
  const label = item.title ?? '';

  return (
    <Touchable
      onPress={press}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[describeHabit({ doneToday: isCompleted, skipped: isSkipped, streak: item.streak ?? 0 }, label, lang), meta, marks && planned > 0 ? c.week(doneDays, planned) : null].filter(Boolean).join(', ')}
      accessibilityState={{ checked: isCompleted }}
      accessibilityHint={c.hint}
      style={styles.tile}
    >
      <View style={styles.ring}>
        <HabitLiquid size={RING} stroke={B.medium * 2} ratio={ratio} color={item.color} track={track}>
          {isSkipped ? <Coffee size={ICON.sm} color={theme.warning} /> : renderModeEmojiIcon(item.emoji ?? '📌', ICON.sm, iconColor)}
        </HabitLiquid>
        <CompletionBurst trigger={burst} color={item.color} radius={RING / 2} />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.name, { color: isCompleted ? theme.onSurfaceMuted : theme.onSurface }]}>{compactHabitLabel(item.title)}</Text>
        {(marks || meta) && (
          <View style={styles.foot}>
            {marks && <DayTrail marks={marks} color={item.color} theme={theme} />}
            {!!meta && <Text numberOfLines={1} style={[styles.meta, { color: theme.onSurfaceVariant }]}>{meta}</Text>}
          </View>
        )}
      </View>
    </Touchable>
  );
});

HabitTile.displayName = 'HabitTile';

export const tileStyles = StyleSheet.create({
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.sm, paddingVertical: S.xs },
  ring: tileStyles.ring,
  body: { flex: 1, minWidth: 0, gap: S.xs },
  name: { fontSize: F.footnote, fontWeight: W.semibold },
  // En dar ekranda ya da büyük yazıda miktar alta iner, taşmaz.
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: S.xs },
  trail: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  dot: { width: DOT, height: DOT, borderRadius: R.full },
  empty: { borderWidth: B.thin, backgroundColor: 'transparent' },
  off: { width: DOT, height: B.thin, borderRadius: R.full },
  meta: { flexShrink: 1, fontFamily: DISPLAY_FONT.digits, fontSize: F.caption, fontVariant: ['tabular-nums'] },
});
