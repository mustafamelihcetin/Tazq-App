import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, useDerivedValue, withRepeat, withTiming, Easing as ReEasing, type SharedValue } from 'react-native-reanimated';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';

// Odak ekranının arka plan katmanları: zen yıldız alanı ve Skia aurora (nebula).
// Saf görsel bileşenler — oturum durumu okumazlar, yalnız prop alırlar.
interface StarGroupProps {
  timerSize: number;
  duration: number;
  initialVal: number;
  starCount: number;
}

const StarGroup = React.memo(({ timerSize, duration, initialVal, starCount }: StarGroupProps) => {
  const maxRadius = Math.max(200, timerSize * 1.5);

  const starsData = useRef<{ x: number; y: number; size: number; color: string }[] | null>(null);
  if (!starsData.current) {
    starsData.current = Array.from({ length: starCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * (maxRadius - 10);
      const size = 1.0 + Math.random() * 1.6;
      const colors = ['#FFFFFF', '#E3F2FD', '#E0F7FA', '#FFF9C4', '#F3E5F5'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: maxRadius + Math.cos(angle) * distance,
        y: maxRadius + Math.sin(angle) * distance,
        size,
        color,
      };
    });
  }

  const scaleShared = useSharedValue(0.1 + initialVal * 2.9);
  const rotationShared = useSharedValue(0);

  useEffect(() => {
    const initialProgress = initialVal;
    const remainingProgress = 1 - initialProgress;
    const firstDuration = duration * remainingProgress;

    const direction = initialVal < 0.5 ? 1 : -1;
    rotationShared.value = withRepeat(
      withTiming(360 * direction, { duration: duration * 10, easing: ReEasing.linear }),
      -1,
      false
    );

    if (firstDuration > 0) {
      scaleShared.value = withTiming(3.0, { duration: firstDuration, easing: ReEasing.linear }, (finished) => {
        if (finished) {
          scaleShared.value = 0.1;
          scaleShared.value = withRepeat(
            withTiming(3.0, { duration: duration, easing: ReEasing.linear }),
            -1,
            false
          );
        }
      });
    } else {
      scaleShared.value = withRepeat(
        withTiming(3.0, { duration: duration, easing: ReEasing.linear }),
        -1,
        false
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = scaleShared.value;
    let opacity = 0;
    if (scale < 0.6) {
      opacity = (scale - 0.1) / 0.5;
    } else if (scale < 2.0) {
      opacity = 1;
    } else {
      opacity = Math.max(0, 1 - (scale - 2.0) / 1.0);
    }

    return {
      opacity: opacity,
      transform: [
        { scale: scale },
        { rotate: `${rotationShared.value}deg` }
      ],
    };
  });

  return (
    <ReAnimated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: maxRadius * 2,
          height: maxRadius * 2,
        },
        animatedStyle,
      ]}
    >
      {starsData.current?.map((star, idx) => (
        <View
          key={idx}
          style={{
            position: 'absolute',
            left: star.x - star.size / 2,
            top: star.y - star.size / 2,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: star.color,
          }}
        />
      ))}
    </ReAnimated.View>
  );
});

export const Starfield = React.memo(({ active, timerSize }: { active: boolean; timerSize: number }) => {
  if (!active) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]} pointerEvents="none">
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.0} starCount={15} />
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.33} starCount={15} />
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.66} starCount={15} />
    </View>
  );
});

// ── Skia nebula ───────────────────────────────────────────────────────────────
// Eski görsel: koyu lacivert taban + 3 yarı-saydam renkli dairenin döndürülüp harmanlanması
// (üst üste katman = overdraw = ısı). Yeni: aynı görünüm tek GPU shader'ı ile, tek draw call,
// overdraw ve maske pass olmadan. Renk merkezleri zamana göre yumuşakça sürüklenir.
const NEBULA_SKSL = `
uniform float u_time;
uniform float2 u_res;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float u_hold;

// Yumuşak, dalgalı ışık perdesi — aurora "curtain". Dalga merkezi zamanla süzülür,
// smoothstep ile geniş/blurlu kenar, hafif dikey çizgilenme perde dokusu verir.
float curtain(float2 uv, float t, float yBase, float amp, float freq, float phase) {
  float center = yBase
    + amp * sin(uv.x * freq + t + phase)
    + amp * 0.45 * sin(uv.x * freq * 2.3 + t * 1.4 + phase);
  float d = abs(uv.y - center);
  float glow = smoothstep(0.32, 0.0, d);
  float streak = 0.86 + 0.14 * sin(uv.x * 34.0 + t * 0.6 + phase);
  return glow * glow * streak;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  // Basılı tutma (nefes al): uv'yi merkeze doğru topla → aurora içe çekilir, bırakınca yayılır.
  uv = mix(uv, float2(0.5, 0.5), u_hold * 0.14);
  float t = u_time * 0.33;

  // Derin uzay tabanı — altta daha koyu
  float3 col = mix(float3(0.05, 0.09, 0.20), float3(0.02, 0.03, 0.09), uv.y);

  // Tutunca perdeler parlar (aurora "yoğunlaşır")
  float boost = 1.0 + u_hold * 0.85;
  col += c2 * curtain(uv, t,        0.44, 0.10, 3.0, 0.0) * 0.55 * boost;
  col += c1 * curtain(uv, t * 1.12, 0.56, 0.12, 2.3, 2.0) * 0.42 * boost;
  col += c3 * curtain(uv, t * 0.9,  0.34, 0.08, 3.6, 4.0) * 0.38 * boost;

  // Merkezde toplanan yumuşak ışık çekirdeği — tut süresince birikir (nefesi topla)
  float core = smoothstep(0.5, 0.0, distance(uv, float2(0.5, 0.5)));
  col += (c1 * 0.4 + float3(0.16, 0.18, 0.26)) * core * core * u_hold * 0.6;

  return half4(col, 1.0);
}
`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// c1=primary, c2=tertiary, c3=secondary (eski blob renkleriyle birebir).
// paused=true iken zaman uniform'u dondurulur → shader yeniden çizmez, GPU boşta (zen/ritual).
/**
 * Shader MODÜL seviyesinde derlenir — bileşen içinde değil.
 *
 * Eskiden `useMemo(() => Skia.RuntimeEffect.Make(NEBULA_SKSL), [])` bileşenin İÇİNDEYDİ.
 * useMemo bileşen ÖRNEĞİ başına saklar, yani:
 *   - Odak ekranına her girişte yeniden derleniyordu (yeni mount = yeni örnek).
 *   - Aynı anda iki Nebula var (zen zemini + daire içi) → aynı shader İKİ KEZ derleniyordu.
 *
 * Modül seviyesinde bir kez derlenir ve tüm örnekler paylaşır. Uygulama ömrü boyunca tek
 * derleme.
 *
 * NOT: bu, ilk girişteki gecikmenin TAMAMINI çözmez — SkSL derlense bile GPU'nun kendi
 * pipeline'ı ilk çizimde oluşur ve bu maliyet doğaldır. O yüzden aurora ayrıca yumuşak
 * açılıyor (bkz. kullanım yeri): kalan gecikme "takılma" değil "beliriş" gibi okunsun.
 */
// try: web'de CanvasKit yüklenmeden modül değerlendirilirse Skia'nın getter'ı fırlatır —
// rota ağacının tamamını düşürmek yerine efekt yok sayılır (aşağıda `!NEBULA_EFFECT` → null).
const NEBULA_EFFECT = (() => {
  try { return Skia.RuntimeEffect.Make(NEBULA_SKSL); } catch { return null; }
})();

// size: kare (daire-içi kullanım). width/height verilirse tam-ekran (zen zemini). speedScale: akış hızı.
export const Nebula = React.memo(({ size, width, height, c1, c2, c3, paused, speedScale = 1, holdSV }: { size: number; width?: number; height?: number; c1: string; c2: string; c3: string; paused: boolean; speedScale?: number; holdSV?: SharedValue<number> }) => {
  const w = width ?? size;
  const h = height ?? size;
  // Derleme modül seviyesinde — bkz. NEBULA_EFFECT.
  const clock = useClock();
  const pausedSV = useSharedValue(paused);
  useEffect(() => { pausedSV.value = paused; }, [paused]);
  const frozen = useSharedValue(0);
  const time = useDerivedValue(() => {
    'worklet';
    // Duraklatıldıysa saati OKUMA → donar (redraw yok). hold değişince uniforms yine de yeniden hesaplanır.
    if (pausedSV.value) return frozen.value;
    const v = (clock.value / 1000) * speedScale;
    frozen.value = v;
    return v;
  });
  const rgb1 = useMemo(() => hexToRgb(c1), [c1]);
  const rgb2 = useMemo(() => hexToRgb(c2), [c2]);
  const rgb3 = useMemo(() => hexToRgb(c3), [c3]);
  const uniforms = useDerivedValue(() => ({
    u_time: time.value,
    u_res: [w, h],
    c1: rgb1,
    c2: rgb2,
    c3: rgb3,
    u_hold: holdSV ? holdSV.value : 0,
  }));
  if (!NEBULA_EFFECT) return null;
  return (
    <Canvas style={{ width: w, height: h }}>
      <Fill>
        <Shader source={NEBULA_EFFECT} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
});
