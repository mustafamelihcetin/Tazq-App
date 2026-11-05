import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Circle } from 'react-native-svg';
import { Pause } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { focusClock } from '@/features/focus/store/useFocusStore';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, B, W, ICON, FAB_SIZE } from '@/shared/constants/tokens';

/*
  CANLI ODAK KAPSÜLÜ (2026-11-01, kullanıcı: "aktif seans varken X'e bastım; bugün sayfasına attı ama en aşağıya
  ve süre akmaya devam ediyor — daha şık, modern ve premium olmalıydı").
  Eskiden süren seans listenin İÇİNDE bir karttı (DynamicIsland) — sayfanın ortasında kayboluyordu.
  Şimdi müzik uygulamalarının mini oynatıcısı gibi YÜZER; konumu ekrana göre FocusIsland verir (tüm uygulamada
  tek gösterge). Halka kalan süreyi, renk mola/odak ayrımını,
  "duraklatıldı" durumu da kendisini söyler. Dokununca odağa döner. Saniyelik render yalnız bu kapsülde.
*/
const SIZE = FAB_SIZE;

const COPY = {
  tr: { break: 'Mola', focus: 'Odak', paused: 'Duraklatıldı', onBreak: 'Mola sürüyor', focusing: 'Odak sürüyor', hint: 'Odak ekranına döner' },
  en: { break: 'Break', focus: 'Focus', paused: 'Paused', onBreak: 'On a break', focusing: 'Focusing', hint: 'Returns to the focus screen' },
};

export function LiveFocusPill() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const c = COPY[language === 'en' ? 'en' : 'tr'];
  const router = useRouter();
  const isActive = useFocusStore(s => s.isActive);
  const seconds = useFocusStore(s => s.seconds);
  const total = useFocusStore(s => s.totalSeconds);
  const openSession = useFocusStore(s => s.openSession);
  const sessionKind = useFocusStore(s => s.sessionKind);
  const task = useFocusStore(s => s.currentTask);
  const isBreak = useFocusStore(s => s.sessionKind === 'break' || (s.pomodoroMode && s.pomodoroPhase === 'break'));
  const started = isActive || total - seconds > 0;
  if (!started || seconds <= 0) return null;

  const shown = focusClock({ openSession, sessionKind, totalSeconds: total, seconds });
  const mm = Math.floor(shown / 60);
  const ss = shown % 60;
  const time = `${mm}:${ss.toString().padStart(2, '0')}`;
  const tint = isBreak ? theme.tertiary : theme.primary;
  const frac = total > 0 ? 1 - seconds / total : 0;
  const r = 15;
  const circ = 2 * Math.PI * r;
  const title = task || (isBreak ? c.break : c.focus);
  const status = !isActive ? c.paused : isBreak ? c.onBreak : c.focusing;

  return (
    <MotiView
      // Aşağıdan doğar: sekme çubuğunun üstünden çıkar, tepeden inmez.
      from={{ opacity: 0, translateY: 24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18 }}
      pointerEvents="box-none"
    >
      <Touchable
        onPress={() => router.push('/focus')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${status}: ${title}, ${time}`}
        accessibilityHint={c.hint}
        style={[styles.pill, {
          backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
          borderColor: tint + '40',
          shadowColor: tint,
        }]}
      >
        <View style={styles.ring}>
          <Svg width={36} height={36}>
            <Circle cx={18} cy={18} r={r} stroke={tint + '26'} strokeWidth={3} fill="none" />
            <Circle cx={18} cy={18} r={r} stroke={tint} strokeWidth={3} fill="none" strokeLinecap="round"
              strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - frac)} transform="rotate(-90 18 18)" />
          </Svg>
          {!isActive
            ? <View style={StyleSheet.absoluteFill} pointerEvents="none"><View style={styles.center}><Pause size={ICON.xs} color={tint} fill={tint} /></View></View>
            : <MotiView pointerEvents="none" style={[styles.dot, { backgroundColor: tint }]} from={{ opacity: 0.35, scale: 0.8 }} animate={{ opacity: 1, scale: 1.15 }} transition={{ type: 'timing', duration: 1100, loop: true }} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.status, { color: tint }]}>{status}</Text>
        </View>
        <Text style={[styles.time, { color: theme.onSurface }]}>{time}</Text>
      </Touchable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: SIZE, borderRadius: R.full, borderWidth: B.thin, flexDirection: 'row', alignItems: 'center', gap: S.smd,
    paddingLeft: S.sm, paddingRight: S.md,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 8,
  },
  ring: { width: 36, height: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 15, top: 15, width: 6, height: 6, borderRadius: R.full },
  title: { fontSize: F.footnote, fontWeight: W.semibold },
  status: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.xxs },
  time: { fontSize: F.callout, fontWeight: W.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
});
