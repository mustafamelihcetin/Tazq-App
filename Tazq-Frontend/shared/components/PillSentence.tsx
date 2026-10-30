import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W } from '@/shared/constants/tokens';

/*
  HAPLI CÜMLE — ana sayfanın "yaşayan cümlesi"nin dili, ortak (2026-10-30). Kullanıcı Haftalık
  Merkez için: "daha tatlı, uyumlu olmalı; renkler de tipler de". Orada vurgu mavi kalın yazıydı,
  rakamlar eş aralıklı teknik yazı; ana sayfada ise yumuşak zeminli haplar — iki ayrı dil.
  Artık cümle kuran her ekran bunu kullanır: düz kelimeler + vurgu HAP (kendi renginin açık
  zemini, aynı renkte yazı). Noktalama hapın hemen ardına yapışır.
*/

export type PillPart = string | { em: string; color?: string };

export function PillSentence({ parts, size = 'title' }: { parts: PillPart[]; size?: 'title' | 'body' }) {
  const { theme, isDark } = useAppTheme();
  const word = size === 'title' ? styles.wordTitle : styles.wordBody;
  return (
    <View style={styles.sentence} accessible accessibilityLabel={parts.map(p => (typeof p === 'string' ? p : p.em)).join('')}>
      {parts.map((p, i) => {
        if (typeof p !== 'string') {
          const c = p.color ?? theme.primary;
          return (
            <View key={i} style={[styles.pill, { backgroundColor: c + (isDark ? '26' : '17') }]}>
              <Text style={[word, { color: c }]}>{p.em}</Text>
            </View>
          );
        }
        return p.split(' ').filter(Boolean).map((w, wi) => (
          <Text key={`${i}-${wi}`} style={[word, { color: theme.onSurface }, /^[,.;:—]/.test(w) && wi === 0 && !p.startsWith(' ') && { marginLeft: -S.xs }]}>{w}</Text>
        ));
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: S.xs, rowGap: S.xs },
  wordTitle: { fontSize: F.title3, fontWeight: W.semibold, letterSpacing: -0.2 },
  wordBody: { fontSize: F.body, fontWeight: W.medium, letterSpacing: -0.1 },
  pill: { borderRadius: R.sm, paddingHorizontal: S.xs, paddingVertical: S.xxs },
});
