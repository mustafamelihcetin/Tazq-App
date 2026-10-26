import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { lightsFor, MAX_RING_LIGHTS } from '@/features/focus/utils/focusScenes';
import { R } from '@/shared/constants/tokens';

/*
  SEANS İÇİ IŞIKLAR — odak "oyunu"nun görünen yüzü (bkz. focusScenes → lightsFor).

  Her 5 odak dakikasında dairenin çevresine sahnenin bir ışığı doğar: önce bir parıltı
  halkası açılır ve söner, ışık yaylı bir ölçekle yerine oturur. Halka çok yavaş döner.

  PERFORMANS (kullanıcı: "her cihazda optimize"):
   · Mağaza seçicisi TAM SAYI döndürür → bileşen saniyede değil, yalnız yeni ışıkta çizilir.
   · Bütün hareket RN Animated + yerel sürücü (dönüş, ölçek, saydamlık) → JS iş parçacığı boşta.
   · Işık başına iki View; en çok 18 ışık. Skia/shader yok, düşük güçlü cihazda da ucuz.
   · "Hareketi azalt" → dönüş yok, doğuş animasyonu yok; ışıklar yine görünür.
*/

const DOT = 5;

export const FocusLights = React.memo(({ size, color, active }: { size: number; color: string; active: boolean }) => {
  const reduce = useReduceMotion();
  const count = useFocusStore((s) => Math.min(MAX_RING_LIGHTS, lightsFor((s.totalSeconds - s.seconds) / 60)));
  const spin = useRef(new Animated.Value(0)).current;
  const prev = useRef(count);

  useEffect(() => {
    if (reduce || !active) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 240000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, active]);

  const born = count > prev.current ? count - 1 : -1;
  useEffect(() => { prev.current = count; }, [count]);

  if (count === 0) return null;
  const r = size / 2 - 14;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
    >
      {Array.from({ length: count }, (_, i) => {
        const a = (i / MAX_RING_LIGHTS) * Math.PI * 2 - Math.PI / 2;
        return (
          <Light key={i} x={size / 2 + r * Math.cos(a)} y={size / 2 + r * Math.sin(a)} color={color} fresh={i === born && !reduce} />
        );
      })}
    </Animated.View>
  );
});

function Light({ x, y, color, fresh }: { x: number; y: number; color: string; fresh: boolean }) {
  const s = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const flash = useRef(new Animated.Value(fresh ? 1 : 0)).current;
  useEffect(() => {
    if (!fresh) return;
    Animated.parallel([
      Animated.spring(s, { toValue: 1, damping: 8, stiffness: 160, mass: 0.7, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View style={{ position: 'absolute', left: x - 12, top: y - 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* doğuş parıltısı: genişleyip sönen halka */}
      <Animated.View style={[styles.flash, { borderColor: color, opacity: flash, transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [2.2, 0.6] }) }] }]} />
      <Animated.View style={[styles.halo, { backgroundColor: color, transform: [{ scale: s }] }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ scale: s }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flash: { position: 'absolute', width: 14, height: 14, borderRadius: R.full, borderWidth: 1.5 },
  halo: { position: 'absolute', width: DOT * 3, height: DOT * 3, borderRadius: R.full, opacity: 0.22 },
  dot: { width: DOT, height: DOT, borderRadius: R.full },
});
