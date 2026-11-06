import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Line, LinearGradient, Oval, Path, RoundedRect, Skia, Text as SkText, matchFont, rect, rrect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { CoinMetal } from '@/shared/constants/Colors';
import { coinHeap, coinsFor } from '@/features/modes/utils/planSignature';

/*
  KUMBARA (2026-11-06, kullanıcı: "domuz olmasın; su değil para girsin; düz yuvarlak çirkin; çok düzenli, torba gibi; uzun sürüyor").
  Biçim: üstü yarıklı teneke silindir, kumbaranın bilinen hâli, ön penceresinden içi görünür. İçeride üst üste, yamuk yatmış sikkeler; yığının boyu biriken paydır.
  Sahne: sikke dönerek düşer, yarıkta kaybolur, yığın büyür, kumbara tabanından çok hafif tıklar. En çok üç sikke, toplam 0,7 sn; bir kez oynar ve durur.
  Para eklenince yalnız yenileri, çekilince yığın azalır. Hareketi Azalt'ta son hâl doğrudan çizilir. Tek zaman değeri: kare başına JS yok.
*/
const ASPECT = 0.8;
const BEATS_MAX = 3;
const BEAT = 190;
const SETTLE = 120;
const METAL = [CoinMetal.deep, CoinMetal.mid, CoinMetal.light, CoinMetal.mid, CoinMetal.deep];
const METAL_POS = [0, 0.3, 0.5, 0.72, 1];
/** Silindirin yandan aldığı ışık: boyadan bağımsız, her vurgu renginde metal gibi durur. */
const TIN_LIGHT = ['rgba(0,0,0,0.30)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.34)'];
const TIN_POS = [0, 0.26, 0.55, 1];

function HeapCoin({ c, rx, ry, thick, edge, beat, base, clock }: { c: { x: number; y: number; angle: number; i: number }; rx: number; ry: number; thick: number; edge: ReturnType<typeof Skia.Path.Make>; beat: number; base: SharedValue<number>; clock: SharedValue<number> }) {
  const q = useDerivedValue(() => (c.i < base.value ? 1 : Math.max(0, Math.min(1, (clock.value - (beat + 1) * BEAT) / SETTLE))));
  const transform = useDerivedValue(() => [{ translateX: c.x }, { translateY: c.y - (1 - q.value) * ry * 2.5 }, { rotate: c.angle }]);
  const opacity = useDerivedValue(() => (q.value > 0 ? 1 : 0));
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={edge}>
        <LinearGradient start={vec(-rx, 0)} end={vec(rx, 0)} colors={[CoinMetal.shade, CoinMetal.deep, CoinMetal.mid, CoinMetal.deep, CoinMetal.shade]} positions={METAL_POS} />
      </Path>
      <Oval x={-rx} y={-ry - thick} width={rx * 2} height={ry * 2}>
        <LinearGradient start={vec(-rx, -ry)} end={vec(rx, ry)} colors={METAL} positions={METAL_POS} />
      </Oval>
      <Oval x={-rx * 0.72} y={-ry * 0.72 - thick} width={rx * 1.44} height={ry * 1.44} style="stroke" strokeWidth={0.8} color={CoinMetal.deep} opacity={0.55} />
    </Group>
  );
}

function FallingCoin({ cx, from, to, r, clock, beats, symbol }: { cx: number; from: number; to: number; r: number; clock: SharedValue<number>; beats: SharedValue<number>; symbol: string }) {
  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }), fontSize: r * 1.15, fontWeight: '700' }), [r]);
  const glyph = useMemo(() => font.measureText(symbol), [font, symbol]);
  const transform = useDerivedValue(() => {
    const b = clock.value / BEAT;
    const local = b - Math.floor(b);
    // Dönerek düşer, yarığa yüzü dönük girer.
    const spin = Math.max(0.16, Math.abs(Math.cos(local * Math.PI * 2)));
    return [{ translateX: cx }, { translateY: from + (to - from) * local * local }, { scaleX: spin }];
  });
  const opacity = useDerivedValue(() => (clock.value / BEAT < beats.value ? 1 : 0));
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={r}>
        <LinearGradient start={vec(-r, -r)} end={vec(r, r)} colors={METAL} positions={METAL_POS} />
      </Circle>
      <Circle cx={0} cy={0} r={r - 0.6} style="stroke" strokeWidth={1.2} color={CoinMetal.deep}>
        <DashPathEffect intervals={[1.1, 1.1]} />
      </Circle>
      <SkText x={-glyph.width / 2} y={glyph.height * 0.36} text={symbol} font={font} color={CoinMetal.shade} />
    </Group>
  );
}

export function MoneyBox({ pct, height, color, body, surface, glint, symbol }: { pct: number; height: number; color: string; body: string; surface: string; glint: string; symbol: string }) {
  const reduce = useReduceMotion();
  const H = height;
  const W_ = Math.round(H * ASPECT);
  const top = H * 0.24;        // üst yüzün ortası
  const lidRy = W_ * 0.15;     // üst yüzün yarı yüksekliği (perspektif)
  const bottom = H - lidRy - 1;
  const win = { x: W_ * 0.17, y: top + H * 0.13, w: W_ * 0.66, h: bottom - top - H * 0.17 };
  const rx = W_ * 0.115;
  const ry = rx * 0.4;
  const thick = H * 0.018;

  const can = useMemo(() => {
    const p = Skia.Path.Make();
    // Taban yarım elips: köşesiz, kesik durmaz.
    p.moveTo(0, top);
    p.lineTo(0, bottom);
    p.cubicTo(0, bottom + lidRy * 0.74, W_ * 0.28, bottom + lidRy, W_ / 2, bottom + lidRy);
    p.cubicTo(W_ * 0.72, bottom + lidRy, W_, bottom + lidRy * 0.74, W_, bottom);
    p.lineTo(W_, top);
    p.close();
    return p;
  }, [W_, top, bottom, lidRy]);
  const edge = useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({ x: -rx, y: -ry, width: rx * 2, height: ry * 2 });
    p.addRect({ x: -rx, y: -thick, width: rx * 2, height: thick });
    return p;
  }, [rx, ry, thick]);

  const slots = useMemo(() => coinHeap({ x: win.x, y: win.y, w: win.w, h: win.h, rx, ry }), [win.x, win.y, win.w, win.h, rx, ry]);
  const shown = coinsFor(pct, slots.length);
  const windowBox = useMemo(() => rrect(rect(win.x, win.y, win.w, win.h), H * 0.05, H * 0.05), [win.x, win.y, win.w, win.h, H]);
  // Sikke yarığın altında kaybolur: düşüşü yalnız üst yüze kadar çizilir.
  const above = useMemo(() => rect(0, 0, W_, top), [W_, top]);

  const clock = useSharedValue(0);
  const base = useSharedValue(reduce ? shown : 0);
  const beats = useSharedValue(0);
  const prev = useRef(0);

  useEffect(() => {
    const before = prev.current;
    prev.current = shown;
    if (reduce || shown <= before) { base.value = shown; beats.value = 0; return; }
    const n = Math.min(BEATS_MAX, shown - before);
    base.value = before;
    beats.value = n;
    clock.value = 0;
    clock.value = withTiming(n * BEAT + SETTLE, { duration: n * BEAT + SETTLE, easing: Easing.linear });
  }, [shown, reduce, base, beats, clock]);

  const press = useDerivedValue(() => {
    const b = clock.value / BEAT - 1;
    const hit = b >= 0 && b < beats.value ? Math.exp(-(b % 1) * 5) : 0;
    return [
      { translateX: W_ / 2 }, { translateY: H },
      { scaleX: 1 + 0.012 * hit }, { scaleY: 1 - 0.018 * hit },
      { translateX: -W_ / 2 }, { translateY: -H },
    ];
  });

  const total = Math.max(1, shown);
  const groupOf = (i: number) => Math.min(BEATS_MAX - 1, Math.floor((i * Math.min(BEATS_MAX, total)) / total));

  return (
    <View style={{ width: W_, height: H }}>
      <Canvas style={{ width: W_, height: H }}>
        <Group transform={press}>
          <Path path={can} color={color} />
          <Path path={can}>
            <LinearGradient start={vec(0, 0)} end={vec(W_, 0)} colors={TIN_LIGHT} positions={TIN_POS} />
          </Path>
          {/* Teneke kabartmaları: kutunun alt ve üst kuşağı. */}
          <Line p1={vec(0, top + H * 0.075)} p2={vec(W_, top + H * 0.075)} color="rgba(0,0,0,0.18)" strokeWidth={1} />
          <Line p1={vec(0, bottom - H * 0.022)} p2={vec(W_, bottom - H * 0.022)} color="rgba(0,0,0,0.18)" strokeWidth={1} />

          {/* Pencere */}
          <RoundedRect rect={windowBox} color={body} />
          <Group clip={windowBox}>
            {slots.slice(0, shown).map((c, i) => (
              <HeapCoin key={i} c={{ ...c, i }} rx={rx} ry={ry} thick={thick} edge={edge} beat={groupOf(i)} base={base} clock={clock} />
            ))}
          </Group>
          <RoundedRect rect={windowBox} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.25)" />
          <Line p1={vec(win.x + win.w * 0.16, win.y + win.h * 0.5)} p2={vec(win.x + win.w * 0.42, win.y + win.h * 0.1)} color={glint} strokeWidth={2} strokeCap="round" opacity={0.65} />

          {/* Üst yüz ve yarık */}
          {/* Kapak: dışta kıvrık kenar, içte biraz çökük yüz; gerçek teneke kapağı gibi. */}
          <Oval x={0} y={top - lidRy} width={W_} height={lidRy * 2} color={color} />
          <Oval x={0} y={top - lidRy} width={W_} height={lidRy * 2} color="rgba(255,255,255,0.30)" />
          <Oval x={W_ * 0.05} y={top - lidRy * 0.84} width={W_ * 0.9} height={lidRy * 1.68} color={color} />
          <Oval x={W_ * 0.05} y={top - lidRy * 0.84} width={W_ * 0.9} height={lidRy * 1.68}>
            <LinearGradient start={vec(0, top - lidRy)} end={vec(0, top + lidRy)} colors={['rgba(0,0,0,0.20)', 'rgba(255,255,255,0.14)']} />
          </Oval>
          {/* Yarık: derinliği olan ince açıklık, altında ışık alan ağız. */}
          <RoundedRect x={W_ * 0.3} y={top - H * 0.012} width={W_ * 0.4} height={H * 0.024} r={H * 0.012} color="rgba(0,0,0,0.78)" />
          <RoundedRect x={W_ * 0.3} y={top + H * 0.014} width={W_ * 0.4} height={1} r={0.5} color="rgba(255,255,255,0.45)" />
          <Group clip={above}>
            <FallingCoin cx={W_ / 2} from={-H * 0.12} to={top + H * 0.06} r={H * 0.082} clock={clock} beats={beats} symbol={symbol} />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
