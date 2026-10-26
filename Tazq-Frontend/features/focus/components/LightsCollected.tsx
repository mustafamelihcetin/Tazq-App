import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { S, F, R } from '@/shared/constants/tokens';

/*
  SEANS SONU — TOPLANAN IŞIKLAR. Işıklar sırayla (kademeli) belirir: her biri küçük bir
  parıltıyla yükselip yerine oturur; ardından "+N yıldız" yazısı gelir. Yerel sürücü, en çok
  18 ışık; "hareketi azalt" → hepsi anında.
*/
export function LightsCollected({ count, label, color, textColor, visible }: { count: number; label: string; color: string; textColor: string; visible: boolean }) {
  const reduce = useReduceMotion();
  const n = Math.min(count, 18);
  const vals = useRef(Array.from({ length: 18 }, () => new Animated.Value(0))).current;
  const caption = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || n === 0) return;
    if (reduce) { vals.forEach((v) => v.setValue(1)); caption.setValue(1); return; }
    vals.forEach((v) => v.setValue(0)); caption.setValue(0);
    Animated.sequence([
      Animated.delay(500),
      Animated.stagger(70, vals.slice(0, n).map((v) => Animated.spring(v, { toValue: 1, damping: 9, stiffness: 180, mass: 0.6, useNativeDriver: true }))),
      Animated.timing(caption, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [visible, n, reduce]);

  if (n === 0) return null;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={label}>
      <View style={styles.row}>
        {vals.slice(0, n).map((v, i) => (
          <Animated.View
            key={i}
            style={[styles.light, {
              backgroundColor: color,
              shadowColor: color,
              opacity: v,
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
            }]}
          />
        ))}
      </View>
      <Animated.Text style={[styles.caption, { color: textColor, opacity: caption }]}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: S.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: S.xs, maxWidth: 220 },
  light: { width: 8, height: 8, borderRadius: R.full, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  caption: { fontSize: F.caption, fontWeight: '600' },
});
