import React, { useEffect, useMemo } from 'react';
import { Canvas, Skia, Skottie, useClock } from '@shopify/react-native-skia';
import { runOnJS, useDerivedValue, useReducedMotion, useSharedValue, useAnimatedReaction } from 'react-native-reanimated';

/*
  ── LOTTIE, YENİ BAĞIMLILIK OLMADAN ──────────────────────────────────────────
  `lottie-react-native` ayrı bir native modül: dev-client'ı yeniden derlemek ve
  iOS/Android'de iki ayrı oynatıcının (Lottie-iOS / Lottie-Android) farklı
  davranışlarıyla yaşamak demek. Skia 2.x zaten Skottie'yi (Google'ın Lottie
  oynatıcısı) taşıyor — Odak ekranının aurora'sını çizen motorun aynısı. Böylece
  aynı JSON iki platformda piksel piksel aynı çizilir ve tek render yolu kalır.

  Kaynak: LottieFiles'tan indirilen .json (Lottie Simple License — ticari kullanım
  serbest, atıf gerekmez). `require('@/assets/lottie/x.json')` ile verin.

  Hareketi azalt açıksa animasyon OYNATILMAZ, son kare durağan gösterilir: kutlama
  anlamını korur, hareket gitmez. Bitiş geri çağrısı yine de çalışır ki çağıran
  akış (ör. kapanış zamanlayıcısı) takılmasın.
*/

interface Props {
  source: object;
  size: number;
  loop?: boolean;
  /** Döngü yoksa animasyon bittiğinde bir kez çağrılır. */
  onFinish?: () => void;
  /** Oynatıcı yoksa (web: CanvasKit yüklü değil) ya da JSON çözülemezse çizilir. */
  fallback?: React.ReactNode;
}

export const LottieAnimation = React.memo(({ source, size, loop = false, onFinish, fallback = null }: Props) => {
  const reduceMotion = useReducedMotion();
  // JSON'u bir kez ayrıştır — her render'da Make çağırmak yerel bellek sızdırır.
  const animation = useMemo(() => {
    try {
      return Skia.Skottie.Make(JSON.stringify(source));
    } catch {
      return null;
    }
  }, [source]);

  const clock = useClock();
  const start = useSharedValue(-1);
  const totalFrames = animation ? Math.max(1, Math.round(animation.duration() * animation.fps())) : 1;
  const fps = animation ? animation.fps() : 30;

  const frame = useDerivedValue(() => {
    if (reduceMotion) return totalFrames - 1;
    if (start.value < 0) start.value = clock.value;
    const f = ((clock.value - start.value) / 1000) * fps;
    return loop ? f % totalFrames : Math.min(f, totalFrames - 1);
  });

  const finished = useSharedValue(false);
  useAnimatedReaction(
    () => frame.value >= totalFrames - 1,
    (done) => {
      if (done && !loop && !finished.value && onFinish) {
        finished.value = true;
        runOnJS(onFinish)();
      }
    },
  );

  useEffect(() => () => animation?.dispose?.(), [animation]);

  if (!animation) return <>{fallback}</>;
  const box = Skia.XYWHRect(0, 0, size, size);
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Skottie animation={animation} frame={frame} transform={fitTransform(animation, box.width, box.height)} />
    </Canvas>
  );
});

// Skottie animasyonu kendi doğal boyutunda çizer; kutuya orantılı sığdırıp ortalarız.
function fitTransform(anim: { size(): { width: number; height: number } }, w: number, h: number) {
  const s = anim.size();
  const k = Math.min(w / s.width, h / s.height);
  return [{ translateX: (w - s.width * k) / 2 }, { translateY: (h - s.height * k) / 2 }, { scale: k }];
}
