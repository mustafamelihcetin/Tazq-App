import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate } from 'react-native-reanimated';

/*
  ── AKAN RAKAMLAR (SwiftUI .numericText(countsDown:) karşılığı) ───────────────
  İlk sürüm react-bits Counter gibi pencere + 0–9 şeridiydi. Cihaz dışı ölçümde iki
  sorun çıktı: parlamaya (textShadow) yer açmak için pencere büyüdü, gelen rakam
  uzaktan "uçarak" giriyordu; 25:00→24:59'da üç rakam birden uçunca sakin ekranda
  kalabalık oluşuyordu. Kırpma da komşu rakamların yarısını gösteriyordu.

  Apple'ın kendi zamanlayıcı geçişi daha az hareket eder: rakam KISA bir mesafe
  kayarak solar, yenisi aynı yönden süzülerek gelir. Pencere/kırpma yok → parlama
  korunur, komşu rakam hiç görünmez. Geri sayımda yeni rakam ÜSTTEN iner.

  Hareketi azalt: geçiş yok, rakam doğrudan yazılır.
*/

interface DigitProps {
  digit: string;
  fontSize: number;
  textStyle: StyleProp<TextStyle>;
  countsDown: boolean;
  reduceMotion?: boolean;
}

const Digit = React.memo(({ digit, fontSize, textStyle, countsDown, reduceMotion }: DigitProps) => {
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(digit);
  const p = useSharedValue(1);

  useEffect(() => {
    if (last.current === digit) return;
    const old = last.current;
    last.current = digit;
    if (reduceMotion) { setPrev(null); p.value = 1; return; }
    setPrev(old);
    p.value = 0;
    p.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [digit, reduceMotion]);

  // Kayma mesafesi rakam boyunun ~üçte biri: hareket "akış" olarak okunur, uçuş olarak değil.
  const dist = fontSize * 0.32 * (countsDown ? 1 : -1);
  const inStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [-dist, 0]) }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [0, dist]) }],
  }));

  return (
    <View>
      <Animated.View style={inStyle}>
        <Text style={textStyle}>{digit}</Text>
      </Animated.View>
      {prev !== null && (
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, outStyle]} pointerEvents="none">
          <Text style={textStyle}>{prev}</Text>
        </Animated.View>
      )}
    </View>
  );
});

interface Props {
  /** Yalnız rakamlar ("05", "25"). */
  value: string;
  fontSize: number;
  textStyle: StyleProp<TextStyle>;
  /** Geri sayım (varsayılan): yeni rakam üstten iner. */
  countsDown?: boolean;
  reduceMotion?: boolean;
}

export const RollingDigits = React.memo(({ value, fontSize, textStyle, countsDown = true, reduceMotion }: Props) => {
  const style = [textStyle, { fontSize }];
  return (
    <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {value.split('').map((ch, i) => (
        <Digit key={i} digit={ch} fontSize={fontSize} textStyle={style} countsDown={countsDown} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
});
