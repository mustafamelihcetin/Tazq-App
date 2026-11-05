import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { Touchable } from '@/shared/components/Touchable';
import { BreathOrb } from '@/features/breath/components/BreathOrb';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { F, S, W } from '@/shared/constants/tokens';

/*
  DÖNÜŞ NEFESİ (2026-11-06). Katı modda uzun ayrılıktan dönüşte saat durmuştur.
  Azarlama ya da soru yok: bir nefes, sonra sayaç kendiliğinden sürer. Fikir Reef'in "mindful launch" bekleyişinden;
  biz uygulama açılışını engelleyemediğimiz için aynı anı dönüşe koyuyoruz. Dokununca beklemeden sürer.
*/
const BREATH_MS = 3000;
const ORB = 140;
const INK = '#FFFFFF';
const SCRIM = 'rgba(0,0,0,0.82)';
const COPY = {
  tr: { title: 'Geri geldin', body: 'Sen yokken saat durdu.', skip: 'Devam et' },
  en: { title: 'You are back', body: 'The clock stopped while you were away.', skip: 'Continue' },
};

export function ReturnBreath({ language, onDone }: { language: 'tr' | 'en'; onDone: () => void }) {
  const reduce = useReduceMotion();
  const level = useSharedValue(reduce ? 0.6 : 0);
  const c = COPY[language];
  useEffect(() => {
    if (!reduce) level.value = withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) });
    const id = setTimeout(onDone, BREATH_MS);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: reduce ? 0 : 300 }} style={[StyleSheet.absoluteFill, styles.wrap]}>
      <Touchable accessibilityRole="button" accessibilityLabel={`${c.title}. ${c.body} ${c.skip}`} accessibilityLiveRegion="polite" activeOpacity={1} onPress={onDone} style={styles.touch}>
        {!reduce && <BreathOrb id="sigh" size={ORB} level={level} />}
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.body}>{c.body}</Text>
      </Touchable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: SCRIM, zIndex: 50, elevation: 50 },
  touch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.sm, paddingHorizontal: S.xl },
  title: { fontSize: F.title, fontWeight: W.semibold, color: INK, textAlign: 'center' },
  body: { fontSize: F.footnote, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
});
