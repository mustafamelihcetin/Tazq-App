import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, BlurMask, mix } from '@shopify/react-native-skia';
import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useEntranceReady, useFirstInSession } from '@/shared/components/EntranceStage';

/*
  MOMENTUM KÜRESİ (2026-10-30, kullanıcı seçti: "nefes alan küçük küre").

  Bu kartın arkasında eskiden sonsuz döngüde nabız atan bir "aura" vardı ve üç sebeple
  kaldırıldı (bkz. MomentumPulse): bilgi taşımıyordu, hata kırmızısı kullanıyordu,
  hiç durmuyordu. Küre bu üçünü yapmaz:
   · BİLGİ: açıklığı ve parlaklığı skorun kendisi — 0'da kapalı sönük bir tomurcuk,
     100'de açılmış parlak bir çiçek. Durduğunda bile skoru "okutur".
   · RENK: skorun kendi ölçeğinden (gri → turuncu → yeşil), çağıran verir.
   · DURUR: ekran açılınca / skor değişince ÜÇ nefes alır, sonra skor seviyesinde durur.
     Yüksek skor biraz daha derin ve canlı nefes alır.
  Hareket azaltılmışsa ve düşük güçte nefes yok, doğrudan skor seviyesi çizilir.
*/

const PETALS = 5;

const Petal = ({ i, c, r, level, color }: { i: number; c: { x: number; y: number }; r: number; level: SharedValue<number>; color: string }) => {
  const transform = useDerivedValue(() => {
    const t = (i * 2 * Math.PI) / PETALS - Math.PI / 2;
    const d = level.value * r * 0.9;
    return [{ translateX: Math.cos(t) * d }, { translateY: Math.sin(t) * d }, { scale: mix(level.value, 0.4, 1) }];
  });
  return <Circle c={c} r={r} color={color} origin={c} transform={transform} />;
};

export function MomentumOrb({ score, color, size = 40, wake = 0 }: { score: number; color: string; size?: number; wake?: number }) {
  const reduce = useReduceMotion();
  const low = useLowPowerGraphics();
  const { isDark } = useAppTheme();
  const s = Math.max(0, Math.min(100, score)) / 100;
  // Taban 0.35: 0 puan da GÖRÜNÜR bir tomurcuktur (0.2'de cihazda hiç seçilmiyordu).
  const rest = 0.35 + 0.6 * s;
  const level = useSharedValue(rest);
  // Üç nefes açılış katmanı kalkınca başlar (eskiden katmanın arkasında bitiyordu).
  const ready = useEntranceReady();
  // Mount nefesi yalnız oturumdaki İLK gösterimde; sekmeden dönüşte canlılığı uyanış nefesi taşır.
  const first = useFirstInSession('home.momentumOrb');
  const mountedBreath = useRef(false);

  useEffect(() => {
    cancelAnimation(level);
    if (reduce || low || !ready) { level.value = withTiming(rest, { duration: 300 }); return; }
    if (!mountedBreath.current) { mountedBreath.current = true; if (!first) { level.value = rest; return; } }
    const depth = 0.12 + 0.12 * s;
    const half = 1700 - 500 * s; // canlı momentum biraz daha hızlı nefes alır
    const ease = Easing.inOut(Easing.sin);
    level.value = withSequence(
      withRepeat(withSequence(
        withTiming(Math.min(1, rest + depth), { duration: half, easing: ease }),
        withTiming(Math.max(0.1, rest - depth * 0.6), { duration: half, easing: ease }),
      ), 3),
      withTiming(rest, { duration: half, easing: ease }),
    );
    return () => cancelAnimation(level);
  }, [rest, reduce, low, ready, first]);

  /*
    UYANIŞ (ekrana dönüş, öne gelme, yenileme): TEK nefes, sonra skor seviyesinde durur.
    Skor değişmediyse sayı yeniden sayılmaz — uyanış "buradayım" der, "değişti" demez.
  */
  const firstWake = useRef(wake);
  useEffect(() => {
    if (wake === firstWake.current || reduce || low) return;
    const half = (1700 - 500 * s) * 0.6;
    const ease = Easing.inOut(Easing.sin);
    cancelAnimation(level);
    level.value = withSequence(
      withTiming(Math.min(1, rest + 0.12 + 0.12 * s), { duration: half, easing: ease }),
      withTiming(rest, { duration: half, easing: ease }),
    );
  // Yalnız UYANIŞTA: skor değişiminin kendi üç nefesi yukarıdaki efektte; burada skoru dinlemek ikisini çakıştırırdı.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wake]);

  /*
    İLK KARE BOYANMIYORDU (cihazda: skor 0 iken küre yok, skor yerleşince çıkıyor). Tuval ilk
    yerleşim tamamlanmadan çiziliyor; yerleşimden sonra BİR ek çizim yeterli. Ölçüm sarmalayıcı
    View'da: yeni mimaride `<Canvas onLayout>` desteklenmiyor (Skia hata verir).
  */
  const [laidOut, setLaidOut] = useState(false);
  const c = useMemo(() => ({ x: size / 2, y: size / 2 }), [size]);
  const blur = size * (low ? 0.04 : 0.07);
  const r = (size / 2 - blur * 1.6) / 2;
  const coreR = useDerivedValue(() => r * mix(level.value, 0.5, 0.9));
  const glow = useDerivedValue(() => 0.2 + 0.3 * level.value);

  return (
    <View onLayout={() => { if (!laidOut) setLaidOut(true); }} style={{ width: size, height: size }} pointerEvents="none" accessible={false}>
    <Canvas key={laidOut ? 'ready' : 'init'} style={{ width: size, height: size }}>
      {/* Hedef halkası: kürenin tam açıldığında ulaşacağı sınır — düşük skor da bir ÖLÇÜ olarak okunur, tek nokta gibi değil. */}
      <Circle c={c} r={r * 1.9} color={color} style="stroke" strokeWidth={1.2} opacity={0.45} />
      <Circle c={c} r={coreR} color={color} opacity={glow}>
        <BlurMask blur={blur * 1.4} style="normal" />
      </Circle>
      {/* Koyu zeminde ışık gibi toplanır (screen). Açık zeminde screen soluk leke, multiply gri tonda
          SİYAH leke yapıyordu (cihazda görüldü) → düz bindirme, yapraklar yarı saydam üst üste biner. */}
      <Group blendMode={isDark ? 'screen' : undefined} opacity={isDark ? 0.75 + 0.25 * s : 0.45 + 0.25 * s}>
        <BlurMask blur={blur} style="solid" />
        {Array.from({ length: PETALS }, (_, i) => (
          <Petal key={i} i={i} c={c} r={r} level={level} color={color} />
        ))}
      </Group>
    </Canvas>
    </View>
  );
}
