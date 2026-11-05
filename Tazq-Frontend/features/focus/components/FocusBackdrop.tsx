import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, PixelRatio, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { sceneOf, type FocusSceneId } from '@/features/focus/utils/focusScenes';
import type { SceneWorld } from '@/features/focus/hooks/useSceneWorld';
import { NEBULA_SKSL, TIDE_SKSL, EMBER_SKSL, MIST_SKSL, SCENE_SOURCES, liteShader } from '@/features/focus/utils/sceneShaders';

// Odak ekranının arka plan katmanı: dört sahnenin Skia gölgelendiricisi.
// Saf görsel bileşenler — oturum durumu okumazlar, yalnız prop alırlar.
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
const LITE_EFFECTS: Partial<Record<FocusSceneId, ReturnType<typeof compile>>> = {};
const liteEffect = (id: FocusSceneId) => {
  if (!(id in LITE_EFFECTS)) LITE_EFFECTS[id] = compile(liteShader(SCENE_SOURCES[id]));
  return LITE_EFFECTS[id] ?? SCENE_EFFECTS[id];
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

/*
  PİL BÜTÇESİ (2026-11-05, kullanıcı: "performans, şarj, tüm cihazlar"). Sahne ağır akar; 120 Hz ekranda saniyede 120 kez tam ekran hesap boşa gider.
  · Kare: normal 30, tam ekran 24 (sinema hızı). Saat yalnız adımda ilerler; değer değişmezse Skia çizmez.
  · Çözünürlük: doku yumuşak, 3x ekranda her pikseli hesaplamak gerekmez. Tam ekran 1.5x (3x ekranda piksel işi 4'te 1), küçük alan 2x.
  · Duraklayınca, uygulama arka plandayken: kare döngüsü tamamen durur (eskiden kartlardaki donuk sahneler bile her kare uyanıyordu).
*/
export const AMBIENT_FPS = 24;
const DEFAULT_FPS = 30;
const FULL_DENSITY = 1.5;
const SMALL_DENSITY = 2;
/** Bu pt² üstü tam ekran sayılır. */
const FULL_AREA = 150000;

export const Nebula = React.memo(({ size, width, height, c1, c2, c3, paused, speedScale = 1, holdSV, scene = 'aurora', base = sceneOf('aurora').base, lowFps = false, fps = DEFAULT_FPS, world, sky = false }: { world?: SceneWorld; sky?: boolean; size: number; width?: number; height?: number; c1: string; c2: string; c3: string; paused: boolean; speedScale?: number; holdSV?: SharedValue<number>; scene?: FocusSceneId; base?: [string, string]; lowFps?: boolean; fps?: number }) => {
  const w = width ?? size;
  const h = height ?? size;
  // Düşük güçte yarım çözünürlük; diğerlerinde ekran yoğunluğu sınırı. Ekranda büyütülür, doku yumuşak olduğu için fark edilmez.
  const density = w * h > FULL_AREA ? FULL_DENSITY : SMALL_DENSITY;
  const k = lowFps ? LOW_RES : Math.min(1, density / PixelRatio.get());
  // Aşağı yuvarlanırsa kenarda ince boşluk kalır, altındaki açık zemin çizgi gibi görünür. Fazlası kırpılır.
  const rw = Math.max(1, Math.ceil(w * k) + 1);
  const rh = Math.max(1, Math.ceil(h * k) + 1);
  // Derleme modül seviyesinde — bkz. NEBULA_EFFECT.
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => sub.remove();
  }, []);
  const stepMs = useSharedValue(lowFps ? LOW_FPS_STEP_MS : 1000 / fps);
  const speed = useSharedValue(speedScale);
  useEffect(() => { stepMs.value = lowFps ? LOW_FPS_STEP_MS : 1000 / fps; speed.value = speedScale; }, [lowFps, fps, speedScale]);
  const time = useSharedValue(0);
  const pending = useSharedValue(0);
  // Saat kendi kendine birikir: durup devam edince sahne sıçramaz.
  // İşlev sabit olmalı: değişirse kütüphane her çizimde döngüyü söküp yeniden kurar, saat takılır.
  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    const next = pending.value + (info.timeSincePreviousFrame ?? 0);
    if (next < stepMs.value) { pending.value = next; return; }
    pending.value = next % stepMs.value;
    time.value += (next / 1000) * speed.value;
  }, []);
  const frame = useFrameCallback(onFrame, false);
  const running = !paused && foreground;
  useEffect(() => { frame.setActive(running); }, [running]);
  const rgb1 = useMemo(() => hexToRgb(c1), [c1]);
  const rgb2 = useMemo(() => hexToRgb(c2), [c2]);
  const rgb3 = useMemo(() => hexToRgb(c3), [c3]);
  const b0 = useMemo(() => hexToRgb(base[0]), [base[0]]);
  const b1 = useMemo(() => hexToRgb(base[1]), [base[1]]);
  const effect = (lowFps ? liteEffect(scene) : SCENE_EFFECTS[scene]) ?? NEBULA_EFFECT;
  const uniforms = useDerivedValue(() => ({
    u_time: time.value,
    u_res: [rw, rh],
    c1: rgb1,
    c2: rgb2,
    c3: rgb3,
    base0: b0,
    base1: b1,
    u_hold: holdSV ? holdSV.value : 0,
    u_growth: world ? world.growth.value : 1,
    u_lights: world ? world.lights.value : 0,
    u_born: world ? world.born.value : 0,
    u_sky: sky ? 1 : 0,
  }));
  if (!effect) return null;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: base[1] }}>
    <Canvas style={{ width: rw, height: rh, transform: [{ scale: 1 / k }], transformOrigin: 'top left' }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
    </View>
  );
});
