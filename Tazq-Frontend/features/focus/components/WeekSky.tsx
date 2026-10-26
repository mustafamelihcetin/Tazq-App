import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { sceneOf, lightsFor, LIGHT_NAMES } from '@/features/focus/utils/focusScenes';
import { S, R, F } from '@/shared/constants/tokens';

/*
  BU HAFTANIN GÖKYÜZÜ — ışık toplamanın koleksiyonu (bkz. focusScenes.lightsFor).

  Her gün bir sütun; o günün ışıkları, güne ÖZGÜ sabit bir düzende (tohumlu) yerleşip ince
  çizgilerle bir takımyıldıza bağlanır. Aynı gün her açılışta aynı şekli çizer (rastgele
  zıplamaz). Zemin ve ışık rengi seçili sahneden.

  PERFORMANS: tek SVG, sürekli animasyon YOK. Açılışta günler sırayla belirir (yerel sürücü,
  günde bir Animated.View). Gün başına en çok 12 ışık çizilir.
*/

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

  const reveal = useRef(Array.from({ length: 7 }, () => new Animated.Value(reduce ? 1 : 0))).current;
  useEffect(() => {
    if (reduce || w === 0) return;
    reveal.forEach((v) => v.setValue(0));
    Animated.stagger(110, reveal.map((v) => Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }))).start();
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
          days.map((pts, d) => (
            <Animated.View key={d} style={[StyleSheet.absoluteFill, { opacity: reveal[d], transform: [{ translateY: reveal[d].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
              <Svg width={w} height={H}>
                {pts.slice(1).map((p, i) => (
                  <Line key={`l${i}`} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} stroke={scene.stars[1]} strokeOpacity={0.28} strokeWidth={0.8} />
                ))}
                {pts.map((p, i) => (
                  <React.Fragment key={`p${i}`}>
                    <Circle cx={p.x} cy={p.y} r={p.r * 2.6} fill={scene.stars[1]} fillOpacity={0.14} />
                    <Circle cx={p.x} cy={p.y} r={p.r} fill={scene.stars[0]} />
                  </React.Fragment>
                ))}
              </Svg>
            </Animated.View>
          ))
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
