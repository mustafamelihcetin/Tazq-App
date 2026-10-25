import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, useDerivedValue, withRepeat, withTiming, Easing as ReEasing, type SharedValue } from 'react-native-reanimated';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { sceneOf, type FocusSceneId } from '@/features/focus/utils/focusScenes';

// Odak ekranının arka plan katmanları: zen yıldız alanı ve Skia aurora (nebula).
// Saf görsel bileşenler — oturum durumu okumazlar, yalnız prop alırlar.
interface StarGroupProps {
  timerSize: number;
  colors: string[];
  duration: number;
  initialVal: number;
  starCount: number;
}

const StarGroup = React.memo(({ timerSize, duration, initialVal, starCount, colors }: StarGroupProps) => {
  const maxRadius = Math.max(200, timerSize * 1.5);

  const starsData = useRef<{ x: number; y: number; size: number; color: string }[] | null>(null);
  if (!starsData.current) {
    starsData.current = Array.from({ length: starCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * (maxRadius - 10);
      const size = 1.0 + Math.random() * 1.6;
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

// Yıldız tonları sahneden (bkz. focusScenes.stars) — Kor'da sıcak kıvılcım, Gelgit'te camgöbeği.
export const Starfield = React.memo(({ active, timerSize, colors }: { active: boolean; timerSize: number; colors: string[] }) => {
  if (!active) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]} pointerEvents="none">
      <StarGroup key={`${colors[1]}-a`} timerSize={timerSize} duration={12000} initialVal={0.0} starCount={15} colors={colors} />
      <StarGroup key={`${colors[1]}-b`} timerSize={timerSize} duration={12000} initialVal={0.33} starCount={15} colors={colors} />
      <StarGroup key={`${colors[1]}-c`} timerSize={timerSize} duration={12000} initialVal={0.66} starCount={15} colors={colors} />
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
uniform float3 base0;
uniform float3 base1;
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
  float3 col = mix(base0, base1, uv.y);

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


// ── Sahne shader'ları (bkz. features/focus/utils/focusScenes.ts) ─────────────────
// Ortak arayüz: u_time, u_res, c1..c3, base0/base1, u_hold. Teknik referans react-bits
// arka planları; kod SkSL'de yeniden yazıldı. Her biri u_hold'a (nefes tutma) kendi
// biçiminde cevap verir.
const SCENE_HEAD = `
uniform float u_time;
uniform float2 u_res;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float3 base0;
uniform float3 base1;
uniform float u_hold;
float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float vnoise(float2 p) {
  float2 i = floor(p); float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + float2(1.7, 9.2); a *= 0.5; }
  return v;
}
`;

// GELGİT — üç katmanlı dalga yüzeyi (alttan yükselen renk) + tepeden süzülen kostik ağı.
// Tutunca dalgalar sakinleşir (genlik düşer), su aydınlanır.
const TIDE_SKSL = SCENE_HEAD + `
half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float t = u_time * 0.4;
  float calm = 1.0 - u_hold * 0.6;
  float3 col = mix(base0, base1, uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y = 0.38 + fi * 0.16
      + calm * (0.05 * sin(uv.x * 4.0 + t * (1.0 + fi * 0.3) + fi * 1.7)
      + 0.025 * sin(uv.x * 9.0 - t * 1.3 + fi));
    float body = smoothstep(y - 0.015, y + 0.22, uv.y);
    float crest = smoothstep(0.03, 0.0, abs(uv.y - y));
    float3 c = i == 0 ? c3 : (i == 1 ? c1 : c2);
    col = mix(col, col * 0.55 + c * 0.22, body * 0.55);
    col += c * crest * 0.35;
  }
  float cx = sin(uv.x * 22.0 + t * 1.8 + sin(uv.y * 14.0 + t));
  float cy = sin(uv.y * 19.0 - t * 1.4 + sin(uv.x * 11.0 - t * 0.8));
  float caustic = pow(max(cx * cy, 0.0), 3.0);
  col += c3 * caustic * (0.28 + u_hold * 0.3) * (1.0 - uv.y * 0.8);
  // Kabarcıklar: dipten yükselir, sağa sola salınır; yalnız KENARI ışır (içi saydam).
  // Kare hücreler (en-boy düzeltmesi): uzun ekranda kabarcık çubuğa dönmesin.
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = float2(sq.x * 5.0, sq.y * 5.0 + t * 0.9);
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id);
  float2 o = float2((h - 0.5) * 0.5 + 0.12 * sin(t * 1.6 + h * 30.0), fract(h * 5.31) - 0.5) * 0.7;
  float rad = 0.06 + 0.06 * fract(h * 3.7);
  float d = length(f - o);
  float rim = smoothstep(rad + 0.025, rad, d) - smoothstep(rad, rad - 0.025, d);
  col += c3 * rim * step(0.62, h) * 0.75 * uv.y;
  return half4(col, 1.0);
}
`;

// KOR — nefes alan sıcak çekirdek + yukarı süzülen kıvılcımlar (hücre başına tek kıvılcım).
// Tutunca çekirdek büyür ve ısınır.
const EMBER_SKSL = SCENE_HEAD + `
half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float t = u_time * 0.5;
  float3 col = mix(base0, base1, uv.y);
  float2 q = uv - float2(0.5, 0.5);
  q.x *= u_res.x / u_res.y;
  float r = length(q);
  float breath = 0.5 + 0.5 * sin(t * 0.9);
  // Sıkı çekirdek + geniş, alçak hale: düz turuncu disk değil, derinliği olan bir kor.
  float grow = 0.40 + 0.07 * breath + u_hold * 0.15;
  float glow = smoothstep(grow, 0.0, r);
  float halo = smoothstep(grow * 1.9, 0.0, r);
  col += c2 * halo * halo * 0.16;
  col += c1 * glow * glow * glow * (0.50 + 0.20 * breath + u_hold * 0.35);
  col += c3 * smoothstep(grow * 0.35, 0.0, r) * 0.22;
  float flick = fbm(float2(uv.x * 3.0, uv.y * 3.0 - t * 0.6));
  col += c2 * flick * glow * 0.25;
  // Kare hücreler (en-boy düzeltmesi): kıvılcım dikey çizgiye dönmesin.
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = float2(sq.x * 8.0, sq.y * 8.0 + t * 1.3);
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id);
  float2 o = float2(h - 0.5, fract(h * 7.13) - 0.5) * 0.6;
  float spark = smoothstep(0.09, 0.0, length(f - o)) * step(0.7, h);
  spark *= 0.6 + 0.4 * sin(t * 6.0 + h * 40.0);
  col += c3 * spark * (1.0 - uv.y) * 1.1;
  return half4(col, 1.0);
}
`;

// SİS — alan bükmeli gürültü (domain warp): katmanlar birbirinin içinden ağır ağır akar.
// Tutunca sis incelir, ışık arkadan sızar.
const MIST_SKSL = SCENE_HEAD + `
half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float t = u_time * 0.12;
  float3 col = mix(base0, base1, uv.y);
  float2 p = uv * float2(2.4, 3.0);
  float2 w = float2(fbm(p + float2(t, t * 0.6)), fbm(p + float2(5.2 - t * 0.8, 1.3 + t)));
  float n = fbm(p + w * 1.6 + float2(t * 0.5, 0.0));
  float density = smoothstep(0.25, 0.85, n) * (1.0 - u_hold * 0.45);
  col = mix(col, mix(c2, c1, n), density * 0.75);
  float halo = smoothstep(0.75, 0.0, distance(uv, float2(0.5, 0.35)));
  col += c3 * halo * halo * (0.10 + u_hold * 0.35);
  // Ateşböcekleri: hücresinde rastgele gezinir, kendi ritminde yanıp söner; sisin içinden parlar.
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = sq * 5.0;
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id + 3.1);
  float2 o = 0.3 * float2(sin(u_time * 0.35 + h * 20.0), cos(u_time * 0.27 + h * 13.0));
  float d = length(f - o);
  float pulse = 0.5 + 0.5 * sin(u_time * (1.2 + h) + h * 30.0);
  float fly = smoothstep(0.14, 0.0, d) * step(0.6, h) * pulse;
  col += (c3 * 0.8 + c1 * 0.4) * fly * (1.0 - density * 0.4);
  return half4(col, 1.0);
}
`;

const compile = (src: string) => { try { return Skia.RuntimeEffect.Make(src); } catch { return null; } };

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

/** Sahne → derlenmiş shader. Modül seviyesinde, bir kez (bkz. NEBULA_EFFECT notu). */
const SCENE_EFFECTS: Record<FocusSceneId, ReturnType<typeof compile>> = {
  aurora: NEBULA_EFFECT,
  tide: compile(TIDE_SKSL),
  ember: compile(EMBER_SKSL),
  mist: compile(MIST_SKSL),
};

// size: kare (daire-içi kullanım). width/height verilirse tam-ekran (zen zemini). speedScale: akış hızı.
/*
  DÜŞÜK GÜÇLÜ CİHAZ: 8 KARE/SN (2026-10-25, kullanıcı: "eklediğin şeyler statik görünüyor").
  Bu cihazlarda shader tek kareye DONDURULUYORDU (her Skia karesi bir sürücü istisnası, bkz.
  useLowPowerGraphics) — yani Aurora dahil hiçbir sahne hareket etmiyordu. Dondurmak yerine
  zaman 125 ms'de bir ilerletilir: sahneler zaten yavaş aktığı için akış sürer, çizim yükü
  ~7,5 kat azdır.
*/
const LOW_FPS_STEP_MS = 125;
/** Düşük güçte çizim çözünürlüğü (ekranda 1/LOW_RES kat büyütülür). */
const LOW_RES = 0.5;

export const Nebula = React.memo(({ size, width, height, c1, c2, c3, paused, speedScale = 1, holdSV, scene = 'aurora', base = sceneOf('aurora').base, lowFps = false }: { size: number; width?: number; height?: number; c1: string; c2: string; c3: string; paused: boolean; speedScale?: number; holdSV?: SharedValue<number>; scene?: FocusSceneId; base?: [string, string]; lowFps?: boolean }) => {
  const w = width ?? size;
  const h = height ?? size;
  // Düşük güç: yarım çözünürlükte çiz, ekranda büyüt (piksel işi ~4 kat az; doku zaten yumuşak).
  const k = lowFps ? LOW_RES : 1;
  const rw = Math.max(1, Math.round(w * k));
  const rh = Math.max(1, Math.round(h * k));
  // Derleme modül seviyesinde — bkz. NEBULA_EFFECT.
  const clock = useClock();
  const pausedSV = useSharedValue(paused);
  useEffect(() => { pausedSV.value = paused; }, [paused]);
  const frozen = useSharedValue(0);
  const lowFpsSV = useSharedValue(lowFps);
  useEffect(() => { lowFpsSV.value = lowFps; }, [lowFps]);
  const stepped = useSharedValue(0);
  useEffect(() => {
    if (!lowFps || paused) return;
    const id = setInterval(() => { stepped.value += (LOW_FPS_STEP_MS / 1000) * speedScale; }, LOW_FPS_STEP_MS);
    return () => clearInterval(id);
  }, [lowFps, paused, speedScale]);
  const time = useDerivedValue(() => {
    'worklet';
    // Duraklatıldıysa saati OKUMA → donar (redraw yok). hold değişince uniforms yine de yeniden hesaplanır.
    if (pausedSV.value) return frozen.value;
    // Düşük güç: saat yerine adım değeri — yalnız adımda değişir, yalnız adımda çizilir.
    if (lowFpsSV.value) { frozen.value = stepped.value; return stepped.value; }
    const v = (clock.value / 1000) * speedScale;
    frozen.value = v;
    return v;
  });
  const rgb1 = useMemo(() => hexToRgb(c1), [c1]);
  const rgb2 = useMemo(() => hexToRgb(c2), [c2]);
  const rgb3 = useMemo(() => hexToRgb(c3), [c3]);
  const b0 = useMemo(() => hexToRgb(base[0]), [base[0]]);
  const b1 = useMemo(() => hexToRgb(base[1]), [base[1]]);
  const effect = SCENE_EFFECTS[scene] ?? NEBULA_EFFECT;
  const uniforms = useDerivedValue(() => ({
    u_time: time.value,
    u_res: [rw, rh],
    c1: rgb1,
    c2: rgb2,
    c3: rgb3,
    base0: b0,
    base1: b1,
    u_hold: holdSV ? holdSV.value : 0,
  }));
  if (!effect) return null;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
    <Canvas style={{ width: rw, height: rh, transform: [{ scale: 1 / k }], transformOrigin: 'top left' }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
    </View>
  );
});
