import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Circle, Path, Group, BlurMask, Skia } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { sceneOf, lightsFor, LIGHT_NAMES } from '@/features/focus/utils/focusScenes';
import { S, R, F } from '@/shared/constants/tokens';

/*
  BU HAFTANIN GÖKYÜZÜ — ışık toplamanın koleksiyonu (bkz. focusScenes.lightsFor).

  Her gün bir sütun; o günün ışıkları, güne ÖZGÜ sabit bir düzende (tohumlu) yerleşip ince
  çizgilerle bir takımyıldıza bağlanır. Aynı gün her açılışta aynı şekli çizer (rastgele
  zıplamaz). Zemin ve ışık rengi seçili sahneden.

  PERFORMANS: tek Skia tuvali, sürekli animasyon YOK. Gün başına en çok 12 ışık çizilir.

  DOĞUŞ (2026-10-30, kullanıcı seçti): açılışta günler soldan sağa sırayla doğar; her günün
  yıldızları ışıltıyla (bulanık hale) belirir ve takımyıldız çizgisi yıldızdan yıldıza
  ÇİZİLEREK ilerler. Tek saat (`t`) hepsini sürer; bittiğinde gökyüzü durağan kalır.
  Hareket azaltılmışsa ilk karede tam çizilir; düşük güçte hale bulanıklığı yok.
*/
const DAY_DELAY = 0.11;   // günler arası gecikme (t biriminde)
const DAY_SPAN = 0.34;    // bir günün doğuş süresi (t biriminde)
const REVEAL_MS = 2200;

/** Günün yerel ilerleyişi 0..1. */
function dayProgress(t: number, d: number) {
  'worklet';
  return Math.max(0, Math.min(1, (t - d * DAY_DELAY) / DAY_SPAN));
}

type Pt = { x: number; y: number; r: number };

const Star = ({ p, d, i, n, t, core, halo, low }: { p: Pt; d: number; i: number; n: number; t: SharedValue<number>; core: string; halo: string; low: boolean }) => {
  // Yıldız, çizgi kendisine ulaştığında doğar.
  const at = n <= 1 ? 0 : i / (n - 1);
  const k = useDerivedValue(() => Math.max(0, Math.min(1, (dayProgress(t.value, d) - at * 0.8) / 0.2)));
  const r = useDerivedValue(() => p.r * (0.4 + 0.6 * k.value + 0.35 * Math.sin(Math.PI * k.value)));
  const hr = useDerivedValue(() => p.r * 2.8 * k.value);
  return (
    <Group opacity={k}>
      <Circle cx={p.x} cy={p.y} r={hr} color={halo} opacity={0.22}>
        {!low && <BlurMask blur={3} style="normal" />}
      </Circle>
      <Circle cx={p.x} cy={p.y} r={r} color={core} />
    </Group>
  );
};

const Constellation = ({ pts, d, t, line }: { pts: Pt[]; d: number; t: SharedValue<number>; line: string }) => {
  const path = useMemo(() => {
    const pa = Skia.Path.Make();
    pts.forEach((p, i) => (i === 0 ? pa.moveTo(p.x, p.y) : pa.lineTo(p.x, p.y)));
    return pa;
  }, [pts]);
  const end = useDerivedValue(() => Math.min(1, dayProgress(t.value, d) / 0.8));
  if (pts.length < 2) return null;
  return <Path path={path} style="stroke" strokeWidth={0.8} color={line} opacity={0.32} start={0} end={end} />;
};

const MAX_PER_DAY = 12;
const COPY = {
  tr: { title: 'Haftanın gökyüzü', total: (n: number, l: string) => `${n} ${l}`, empty: 'Odaklandıkça burada takımyıldızların belirecek.' },
  en: { title: "The week's sky", total: (n: number, l: string) => `${n} ${l}`, empty: 'Your constellations will appear here as you focus.' },
};

/** Güne özgü sabit sözde-rastgele (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function WeekSky({ focusPerDay, dayKeys, language }: { focusPerDay: number[]; dayKeys: string[]; language: 'tr' | 'en' }) {
  const reduce = useReduceMotion();
  const scene = sceneOf(usePrefsStore((s) => s.focusScene));
  const c = COPY[language];
  const [w, setW] = useState(0);
  const H = 120;
  const total = focusPerDay.reduce((a, m) => a + lightsFor(m), 0);
  const names = LIGHT_NAMES[scene.id];
  const label = language === 'tr' ? names.tr : total === 1 ? names.enOne : names.en;

  const days = useMemo(() => {
    if (w === 0) return [];
    const colW = w / 7;
    return focusPerDay.map((m, d) => {
      const n = Math.min(MAX_PER_DAY, lightsFor(m));
      const rnd = seeded(parseInt((dayKeys[d] ?? `${d}`).replace(/-/g, ''), 10) || d + 1);
      const pts = Array.from({ length: n }, () => ({ x: d * colW + colW * (0.2 + 0.6 * rnd()), y: 14 + (H - 28) * rnd(), r: 1.4 + 1.4 * rnd() }));
      pts.sort((a, b) => a.y - b.y);
      return pts;
    });
  }, [w, focusPerDay, dayKeys]);

  const low = useLowPowerGraphics();
  const tEnd = 6 * DAY_DELAY + DAY_SPAN;
  const t = useSharedValue(reduce ? tEnd : 0);
  useEffect(() => {
    if (w === 0) return;
    if (reduce) { t.value = tEnd; return; }
    t.value = 0;
    t.value = withTiming(tEnd, { duration: REVEAL_MS, easing: Easing.out(Easing.quad) });
  }, [w, focusPerDay.join(','), reduce]);

  return (
    <View style={styles.card}>
      <LinearGradient colors={scene.zen.slice(0, 3) as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.head}>
        <Text style={styles.title}>{c.title}</Text>
        {total > 0 && <Text style={[styles.total, { color: scene.stars[1] }]}>{c.total(total, label)}</Text>}
      </View>
      <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {total === 0 ? (
          <Text style={styles.empty}>{c.empty}</Text>
        ) : (
          <Canvas style={{ width: w, height: H }}>
            {days.map((pts, d) => (
              <Group key={d}>
                <Constellation pts={pts} d={d} t={t} line={scene.stars[1]} />
                {pts.map((p, i) => (
                  <Star key={i} p={p} d={d} i={i} n={pts.length} t={t} core={scene.stars[0]} halo={scene.stars[1]} low={low} />
                ))}
              </Group>
            ))}
          </Canvas>
        )}
      </View>
      <View style={styles.days}>
        {(language === 'tr' ? ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((l, i) => (
          <Text key={i} style={styles.dayLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, overflow: 'hidden', padding: S.md, gap: S.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: F.subhead, fontWeight: '700' },
  total: { fontSize: F.caption, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.6)', fontSize: F.caption, textAlign: 'center', marginTop: S.xl },
  days: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: F.caption2, fontWeight: '600' },
});
