import React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useFocusStore, focusClock } from '@/features/focus/store/useFocusStore';
import { sparseProgress } from '@/features/focus/utils/focusScenes';
import { RollingDigits } from '@/shared/components/RollingDigits';
import { S } from '@/shared/constants/tokens';

const OPEN_LAP_SECONDS = 3600;

export const CountdownText = React.memo(({ timerSize, colonColor, reduceMotion, a11yLabel, hidden }: { hidden: boolean; timerSize: number; colonColor: string; reduceMotion?: boolean; a11yLabel: (m: number) => string }) => {
  // Zen'de görünmezken saniyelik çizim yok; görünür olunca son değer anında tazelenir.
  const live = useFocusStore(s => (hidden ? -1 : focusClock(s)));
  const keptSeconds = React.useRef(live < 0 ? focusClock(useFocusStore.getState()) : live);
  if (live >= 0) keptSeconds.current = live;
  const seconds = keptSeconds.current;
  const isActive = useFocusStore(s => s.isActive);
  const big = Math.round(timerSize * 0.205);
  const mid = Math.round(timerSize * 0.185);
  // İki nokta: Sakin mod'da sabit; normalde sert blink (0.2↔1) yerine nazik kımıltı (0.55↔0.85) —
  // saniyeliği yaşam belirtisi kalsın ama göz köşesinde rahatsız etmesin.
  const colonOpacity = reduceMotion ? 0.7 : ((isActive && seconds % 2 === 1) ? 0.55 : 0.85);
  // Kayma YALNIZ saniyelik tikte (bir önceki değerden 1 eksik). Süre kadranla/ön ayarla değişince anında yazılır:
  // dört rakam birden kayarken sayaç da görünür olunca iki değer üst üste görünüyordu.
  const lastSec = React.useRef(seconds);
  const tick = Math.abs(lastSec.current - seconds) === 1;
  React.useEffect(() => { lastSec.current = seconds; }, [seconds]);
  /*
    Ekran okuyucu kalan süreyi DAKİKA olarak okur. Etiket bilerek burada: ana ekranda
    olsaydı her dakika 2000+ satırlık ağaç yeniden render olurdu (bkz. yukarıdaki not).
  */
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={a11yLabel(Math.ceil(seconds / 60))} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Rakamlar KAYAR (react-bits Counter → RollingDigits); Sakin mod'da kaymaz. */}
      <RollingDigits value={Math.floor(seconds / 60).toString().padStart(2, '0')} fontSize={big} textStyle={[styles.timerText, styles.timerGlow, { color: '#FFFFFF' }]} reduceMotion={reduceMotion} instant={!tick} />
      {/* ':' rakamlarla DİKEY ORTALI — satır 'center', böylece küçük iki nokta tabana düşmez.
          Küçük hizalama payı: optik olarak tam ortaya oturması için minik yukarı nudge. */}
      <Text style={[styles.timerText, { color: colonColor, fontSize: mid, marginHorizontal: S.xxs, opacity: colonOpacity, includeFontPadding: false, textAlignVertical: 'center' }]}>:</Text>
      <RollingDigits value={(seconds % 60).toString().padStart(2, '0')} fontSize={big} textStyle={[styles.timerText, styles.timerGlow, { color: '#FFFFFF' }]} reduceMotion={reduceMotion} instant={!tick} />
    </View>
  );
});

// SVG halka + zen yörünge Animated.Value'ları saniyeye göre besler (kendisi görünmez).
// Animated.Value güncellemesi native/JS animasyon düğümünü tazeler; React re-render gerektirmez.
// Zen'de (sparse) yörünge saniyede bir değil adımlı ve yumuşak gider: göz fark etmez, pil kazanır.
export const ProgressDriver = React.memo(({ progressAnim, nativeProgressAnim, sparse }: { progressAnim: Animated.Value; nativeProgressAnim: Animated.Value; sparse: boolean }) => {
  // Serbest sürede halka dolmaz: saatte bir tur atar.
  const progress = useFocusStore(s => (s.openSession && s.sessionKind === 'focus'
    ? sparseProgress(OPEN_LAP_SECONDS, OPEN_LAP_SECONDS - ((s.totalSeconds - s.seconds) % OPEN_LAP_SECONDS), sparse)
    : sparseProgress(s.totalSeconds, s.seconds, sparse)));
  React.useEffect(() => {
    progressAnim.setValue(progress);
    if (sparse) Animated.timing(nativeProgressAnim, { toValue: progress, duration: 1200, easing: Easing.linear, useNativeDriver: true }).start();
    else nativeProgressAnim.setValue(progress);
  }, [progress, sparse]);
  return null;
});

const styles = StyleSheet.create({
  timerText: { fontWeight: '200', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  timerGlow: { textShadowColor: 'rgba(150,180,255,0.45)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
});
