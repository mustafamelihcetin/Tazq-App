import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, runOnJS } from 'react-native-reanimated';

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
  /** Geçişsiz yaz (büyük sıçrama). */
  instant?: boolean;
  fontSize: number;
  textStyle: StyleProp<TextStyle>;
  countsDown: boolean;
  reduceMotion?: boolean;
}

const Digit = React.memo(({ digit, fontSize, textStyle, countsDown, reduceMotion, instant }: DigitProps) => {
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(digit);
  const p = useSharedValue(1);

  useEffect(() => {
    if (last.current === digit) return;
    const old = last.current;
    last.current = digit;
    // ANINDA yazılan durumlar: hareketi azalt ya da büyük sıçrama (süre değişti — saniyelik tik değil).
    if (reduceMotion || instant) { setPrev(null); p.value = 1; return; }
    setPrev(old);
    p.value = 0;
    // Bitince eski rakam TAMAMEN kaldırılır (2026-11-01): yalnız saydamlığı sıfırlanıyordu; animasyon bir kare
    // takılınca (ör. ses yüklenirken) iki değer üst üste kalıyordu ("24:00 üstüne 15:00 binmiş").
    p.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }, done => { if (done) runOnJS(setPrev)(null); });
  }, [digit, reduceMotion, instant]);

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
  /** Geçişsiz yaz: değer bir saniyelik tik değil, sıçrama (ör. süre kadranla değişti). */
  instant?: boolean;
}

export const RollingDigits = React.memo(({ value, fontSize, textStyle, countsDown = true, reduceMotion, instant }: Props) => {
  const style = [textStyle, { fontSize }];
  return (
    <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {value.split('').map((ch, i) => (
        <Digit key={i} digit={ch} fontSize={fontSize} textStyle={style} countsDown={countsDown} reduceMotion={reduceMotion} instant={instant} />
      ))}
    </View>
  );
});
