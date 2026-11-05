import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Circle, Oval, Path, Group, BlurMask, Skia } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Sun, Moon } from 'lucide-react-native';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { sceneOf, sceneLights, LIGHT_NAMES } from '@/features/focus/utils/focusScenes';
import { Nebula } from '@/features/focus/components/FocusBackdrop';
import { skyDayLine, skyDayTasks, skyDelta, skyDuration, skyStars, skyStory, skyTop, skyWeek, type SkySession } from '@/features/report/weekSky';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  HAFTANIN GÖKYÜZÜ (v3, 2026-11-01).

  v2 veriyi anlamlı kıldı ama kartı GRAFİĞE çevirdi (saat çizgileri, eksen yazıları, "yıldız = seans"
  açıklaması); kullanıcı: "mistik ve gökyüzü imajını kaybetti". v3 anlamı korur, ızgarayı kaldırır:
   · Zemin odak ekranının AURORASI (Nebula, durağan tek kare — sürekli shader yok). Düşük güçte gradyan.
   · Saat ekseni ÇİZGİSİZ: tepeden süzülen şafak ışığı + köşelerde soluk güneş (sabah) ve ay (gece).
     Yükseklik yine saattir (model: features/report/weekSky.ts), ama bir eksen gibi okunmaz.
   · Sabit, soluk TOZ yıldızları gökyüzü dokusudur; veri yıldızlarından ayrışır (hale yok, minik).
   · Veri yıldızı = seans (büyüklük süre); uzun seansın ışıltı haçı var. Çizgi = haftanın yolu.
   · Bugün = yumuşak bir ışık huzmesi. Açıklama ekran okuyucu etiketinde (görsel gürültü değil).

  DOĞUŞ (2026-10-30, kullanıcı seçti — korunuyor): çizgi yıldızdan yıldıza ÇİZİLEREK ilerler; yıldız
  çizgi ona varınca ışıltıyla belirir. Tek saat; bitince durağan. Hareket azaltılmışsa ilk karede tam.
*/
const REVEAL_MS = 2400;
const H = 180;
const PAD = 12;
/** En büyük yıldızın parıltısı ~35 birim yayılır (yarıçap 7 × 3.2 + bulanıklık payı). */
const OVERSCAN = 40;
const DUST = 46;
const CLEAN_MIN_MINUTES = 10;
const GLINT_MIN = 0.55; // ~27 dk ve üstü seanslarda ışıltı haçı

const Star = ({ x, y, r, at, t, core, halo, glint, low }: { x: number; y: number; r: number; at: number; t: SharedValue<number>; core: string; halo: string; glint: boolean; low: boolean }) => {
  const k = useDerivedValue(() => Math.max(0, Math.min(1, (t.value - at) / 0.08)));
  const rr = useDerivedValue(() => r * (0.4 + 0.6 * k.value + 0.35 * Math.sin(Math.PI * k.value)));
  const hr = useDerivedValue(() => r * 3.2 * k.value);
  const hrMid = useDerivedValue(() => hr.value * 0.66);
  const hrIn = useDerivedValue(() => hr.value * 0.4);
  const ray = useMemo(() => {
    const p = Skia.Path.Make();
    const L = r * 3.4;
    p.moveTo(x - L, y); p.lineTo(x + L, y); p.moveTo(x, y - L); p.lineTo(x, y + L);
    return p;
  }, [x, y, r]);
  return (
    <Group opacity={k}>
      {low ? (
        // Zayıf cihazda bulanıklık yok: iç içe soluk halkalar aynı parıltıyı neredeyse bedavaya verir.
        <>
          <Circle cx={x} cy={y} r={hr} color={halo} opacity={0.08} />
          <Circle cx={x} cy={y} r={hrMid} color={halo} opacity={0.14} />
          <Circle cx={x} cy={y} r={hrIn} color={halo} opacity={0.24} />
        </>
      ) : (
        <Circle cx={x} cy={y} r={hr} color={halo} opacity={0.42}>
          <BlurMask blur={6} style="normal" />
        </Circle>
      )}
      {glint && <Path path={ray} style="stroke" strokeWidth={0.7} color={core} opacity={0.45} />}
      <Circle cx={x} cy={y} r={rr} color={core} />
    </Group>
  );
};

const COPY = {
  tr: {
    title: 'Haftanın gökyüzü',
    total: (n: number, l: string) => `${n} ${l}`,
    empty: 'Her odak seansın bu gökyüzüne bir yıldız olarak düşer.',
    a11yHow: 'Her yıldız bir odak seansı; yukarısı sabah, aşağısı gece; büyük yıldız uzun seans',
    legend: 'Her yıldız bir seans · ışıltılısı kesintisiz · güne dokun',
    days: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'],
  },
  en: {
    title: "The week's sky",
    total: (n: number, l: string) => `${n} ${l}`,
    empty: 'Every focus session lands in this sky as a star.',
    a11yHow: 'Each star is a focus session; higher is morning, lower is night; bigger is longer',
    legend: 'Each star is a session · sparkling means uninterrupted · tap a day',
    days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  },
};

/** Gökyüzü dokusu: güne değil karta bağlı sabit sözde-rastgele (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function WeekSky({ sessions, dayKeys, language, timed = true, todayKey, bleed = false, bottomInset = 0, children }: {
  sessions: SkySession[]; dayKeys: string[]; language: 'tr' | 'en'; timed?: boolean; todayKey?: string;
  /** Kart değil, pencerenin kendisi: kenar çizgisi yok (kullanıcı: "iç kenarlar çok solid"). */
  bleed?: boolean; bottomInset?: number; children?: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  const low = useLowPowerGraphics();
  const { theme } = useAppTheme();
  const scene = sceneOf(usePrefsStore((s) => s.focusScene));
  const [c1, c2, c3] = sceneLights(scene, theme);
  const c = COPY[language];
  const [w, setW] = useState(0);
  const [card, setCard] = useState({ w: 0, h: 0 });

  const stars = useMemo(() => skyStars(sessions, dayKeys, timed), [sessions, dayKeys, timed]);
  const story = useMemo(() => skyStory(sessions, dayKeys, language, timed), [sessions, dayKeys, language, timed]);
  const names = LIGHT_NAMES[scene.id];
  const label = language === 'tr' ? names.tr : stars.length === 1 ? names.enOne : names.en;
  const todayIdx = todayKey ? dayKeys.indexOf(todayKey) : -1;
  const week = useMemo(() => skyWeek(sessions, dayKeys, todayKey, timed), [sessions, dayKeys, todayKey, timed]);
  const delta = skyDelta(week.delta, language);
  const [picked, setPicked] = useState<number | null>(null);
  // Hafta değişince (rapor hafta seçicisi) eski seçim anlamsız kalır.
  useEffect(() => setPicked(null), [dayKeys[0]]); // dizi kimliği değil tarih: her çizimde yeni dizi gelse seçim silinirdi
  const glowIdx = picked ?? todayIdx;

  const pts = useMemo(() => stars.map((st, i) => ({
    x: st.x01 * w,
    y: PAD + st.y01 * (H - 2 * PAD),
    r: 2.4 + 4.6 * st.size,
    // Işıltı kesintisiz seansı anlatır; eski kayıtlarda bilinmediği için süre kuralı kalır.
    glint: st.clean === null ? st.size >= GLINT_MIN : st.clean && st.minutes >= CLEAN_MIN_MINUTES,
    at: stars.length <= 1 ? 0 : (i / (stars.length - 1)) * 0.92,
  })), [stars, w]);

  const dust = useMemo(() => {
    const rnd = seeded(7);
    return Array.from({ length: DUST }, () => ({ x: rnd() * w, y: rnd() * H, r: 0.4 + rnd() * 0.6, o: 0.18 + rnd() * 0.3 }));
  }, [w]);

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    pts.forEach((q, i) => (i === 0 ? p.moveTo(q.x, q.y) : p.lineTo(q.x, q.y)));
    return p;
  }, [pts]);

  const t = useSharedValue(reduce ? 1 : 0);
  const sig = stars.map(s => `${s.day}:${s.minutes}`).join(',');
  useEffect(() => {
    if (w === 0) return;
    if (reduce) { t.value = 1; return; }
    t.value = 0;
    t.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.quad) });
  }, [w, sig, reduce]);
  const lineEnd = useDerivedValue(() => Math.min(1, t.value / 0.92));

  return (
    <View
      style={[styles.card, bleed ? { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: Math.max(bottomInset, S.md) } : { borderRadius: R.lg }]}
      onLayout={(e) => setCard({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <LinearGradient colors={scene.zen.slice(0, 3) as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Aurora bandı: sahnenin ışık renkleriyle durağan çapraz pus — HER cihazda (zayıfta tek mistik katman). */}
      <LinearGradient colors={[c1 + '2E', 'transparent', c2 + '24', 'transparent']} locations={[0, 0.35, 0.65, 1]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* Aurora zemini — odak ekranının dili; durağan tek kare. Zayıf cihazda yok. */}
      {!low && card.w > 0 && (
        <View style={[StyleSheet.absoluteFill, { opacity: scene.zenOpacity }]} pointerEvents="none">
          <Nebula size={0} width={card.w} height={card.h} c1={c1} c2={c2} c3={c3} scene={scene.id} base={scene.base} paused sky />
        </View>
      )}
      {/* Şafak: gökyüzünün üstü (sabah) hafifçe aydınlık — saat eksenini çizgisiz söyler. */}
      <LinearGradient colors={[scene.stars[3] ?? scene.stars[1], 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={[StyleSheet.absoluteFill, { opacity: 0.1 }]} pointerEvents="none" />

      <View style={styles.head}>
        <Text style={styles.title}>{c.title}</Text>
        {stars.length > 0 && <Text style={[styles.total, { color: scene.stars[1] }]}>{c.total(stars.length, label)}</Text>}
      </View>
      {stars.length > 0 && (
        <View>
          <Text style={styles.sum}>{skyDuration(week.totalMinutes, language)}</Text>
          {delta ? <Text style={styles.delta}>{delta}</Text> : null}
          {skyTop(week, language) ? <Text numberOfLines={1} style={styles.delta}>{skyTop(week, language)}</Text> : null}
        </View>
      )}
      {/* Güne dokununca o günün dökümü; yoksa haftanın tek cümlesi. Yer değişmesin diye aynı satır. */}
      {picked !== null
        ? <Text accessibilityLiveRegion="polite" style={styles.story}>{[skyDayLine(week.days[picked], dayKeys[picked], language, timed), skyDayTasks(week.days[picked], language)].filter(Boolean).join('\n')}</Text>
        : story ? <Text style={styles.story}>{story}</Text> : null}

      <View accessible accessibilityRole="image" accessibilityLabel={[c.title, story ?? c.empty, stars.length > 0 ? c.a11yHow : ''].filter(Boolean).join('. ')} style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {/* Tuval veri alanından taşar: parıltı ve ışıltı haçı kenarda kare gibi kesilmesin (kullanıcı: "parıltısı çok keskin kesilmiş"). */}
        <Canvas pointerEvents="none" style={{ position: 'absolute', left: -OVERSCAN, top: -OVERSCAN, width: w + OVERSCAN * 2, height: H + OVERSCAN * 2 }}>
          <Group transform={[{ translateX: OVERSCAN }, { translateY: OVERSCAN }]}>
          {/* Bugün: köşesiz, her yönde solan aydınlık. Düşük güçte bulanıklık yok; orada günün adı kalın yazılır, yeter. */}
          {glowIdx >= 0 && w > 0 && !low && (
            <Oval x={(glowIdx / 7) * w} y={0} width={w / 7} height={H} color={scene.stars[1]} opacity={picked !== null ? 0.26 : 0.16}>
              <BlurMask blur={w / 18} style="normal" />
            </Oval>
          )}
          {dust.map((d, i) => <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} color={scene.stars[0]} opacity={d.o} />)}
          {/* Takımyıldız: bulanık ikiz hafif parıltı verir (düşük güçte yok). */}
          {pts.length > 1 && (low
            ? <Path path={path} style="stroke" strokeWidth={4} color={c1} opacity={0.1} start={0} end={lineEnd} />
            : (
              <Path path={path} style="stroke" strokeWidth={3} color={c1} opacity={0.22} start={0} end={lineEnd}>
                <BlurMask blur={4} style="normal" />
              </Path>
            ))}
          {pts.length > 1 && <Path path={path} style="stroke" strokeWidth={0.8} color={scene.stars[1]} opacity={0.5} start={0} end={lineEnd} />}
          {pts.map((q, i) => (
            <Star key={i} x={q.x} y={q.y} r={q.r} at={q.at} t={t} core={scene.stars[0]} halo={c1} glint={q.glint} low={low} />
          ))}
          </Group>
        </Canvas>
        {timed && stars.length > 0 && (
          <>
            <View style={[styles.mark, { top: 0 }]} pointerEvents="none"><Sun size={ICON.xs} color="#FFFFFF" /></View>
            <View style={[styles.mark, { bottom: 0 }]} pointerEvents="none"><Moon size={ICON.xs} color="#FFFFFF" /></View>
          </>
        )}
        {stars.length === 0 && <Text style={styles.empty}>{c.empty}</Text>}
      </View>

      <View style={styles.days}>
        {c.days.map((l, i) => {
          const on = picked === i;
          const min = week.days[i]?.minutes ?? 0;
          const key = dayKeys[i];
          return (
            <Touchable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={key && week.days[i] ? skyDayLine(week.days[i], key, language, timed) : l}
              onPress={() => setPicked(on ? null : i)}
              style={styles.day}
            >
              <Text style={[styles.dayLabel, (i === todayIdx || on) && styles.dayToday]}>{l}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dayMin, on && styles.dayToday]}>{min > 0 ? Math.round(min) : '–'}</Text>
            </Touchable>
          );
        })}
      </View>
      {stars.length > 0 && <Text style={styles.legend}>{c.legend}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: S.md, gap: S.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: F.title3, fontWeight: '700' },
  total: { fontSize: F.caption, fontWeight: '700' },
  story: { color: 'rgba(255,255,255,0.82)', fontSize: F.footnote, fontWeight: '500', lineHeight: 19 },
  empty: { position: 'absolute', left: 0, right: 0, top: H / 2 - S.md, color: 'rgba(255,255,255,0.7)', fontSize: F.footnote, textAlign: 'center', paddingHorizontal: S.lg },
  mark: { position: 'absolute', left: 0, opacity: 0.35 },
  days: { flexDirection: 'row' },
  day: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: S.xxs },
  dayMin: { color: 'rgba(255,255,255,0.6)', fontSize: F.caption2, fontWeight: '500', fontVariant: ['tabular-nums'] },
  sum: { color: '#FFFFFF', fontSize: F.display, fontWeight: '700', fontVariant: ['tabular-nums'] },
  delta: { color: 'rgba(255,255,255,0.7)', fontSize: F.caption, fontWeight: '500' },
  legend: { color: 'rgba(255,255,255,0.5)', fontSize: F.caption2, textAlign: 'center' },
  dayLabel: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: F.caption2, fontWeight: '600' },
  dayToday: { color: '#FFFFFF', fontWeight: '700' },
});
