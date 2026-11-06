import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Line, LinearGradient, Path, Rect, RoundedRect, Skia, Text as SkText, matchFont, rect, rrect, vec, type SkFont } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { F, ICON, RSPRING, S, W } from '@/shared/constants/tokens';
import { ExamScene } from './PlanExamScenes';
import type { ExamField } from '@/features/modes/utils/planSignature';
import { lutAt, shelfLayout, stepPosition, chainPaid, platesPerSide, polyLut, type Lut } from '@/features/modes/utils/planSignature';

/*
  HEDEFİN SAHNESİ (2026-11-06, kullanıcı: "her moda ayrı, daha kaliteli; kullanıcı bağlansın"). Her sahne o hedefin gerçek ölçüsünü, o hedefin diliyle çizer ve gün içinde tepki verir:
    sınav: alanı belliyse kendi sahnesi (PlanExamScenes); genel sınavda raf: her ders bir kitap, biten konu kitabı alttan doldurur
    tez: kalem, teze ayrılan günler kadar satır yazar; bugünün işi bitince satır uzar
    mülakat: basamaklar kapıya çıkar; aşama = basamak, bugünün işi basamakta ilerletir
    koşu: parkurda geçen zaman kadar ilerlenir, sonda bitiş bayrağı
    güç: haftada çalışılan gün kadar plaka takılır, bar her plakada esner
    genel spor: son 7 günün nabzı; çalışılan gün atım, boş gün düz
    kilo: terazi ibresi başlangıçtan hedefe, yeni tartımda sallanıp oturur
    borç: zincir halkaları ödendikçe kopar
    acil fon: kalkan ay ay dolar
  Hepsi bir kez oynar ve durur; Hareketi Azalt'ta son hâl doğrudan çizilir. Hesap planSignature'da (test edilir), hareket UI iş parçacığında.
*/
export type PlanSceneData =
  | { kind: 'exam'; field: Exclude<ExamField, 'general'>; progress: number; today: number; a11y: string }
  | { kind: 'shelf'; books: { name: string; done: number; total: number }[]; a11y: string }
  | { kind: 'page'; written: number; today: number; a11y: string }
  | { kind: 'stairs'; index: number; total: number; today: number; a11y: string }
  | { kind: 'run'; progress: number; today: number; a11y: string }
  | { kind: 'barbell'; days: number; a11y: string }
  | { kind: 'pulse'; flags: boolean[]; a11y: string }
  | { kind: 'dial'; pct: number; from: string; now: string; to: string; a11y: string }
  | { kind: 'chain'; pct: number; a11y: string }
  | { kind: 'shield'; months: number; total: number; amount: string; goal: string; a11y: string };

const EASE = Easing.out(Easing.cubic);

export function useTo(to: number, opts: { duration?: number; delay?: number; spring?: boolean } = {}) {
  const reduce = useReduceMotion();
  const v = useSharedValue(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { v.value = to; return; }
    const anim = opts.spring ? withSpring(to, RSPRING.sway) : withTiming(to, { duration: opts.duration ?? 900, easing: EASE });
    v.value = withDelay(opts.delay ?? 120, anim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduce]);
  return v;
}

export function Sized({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && <Canvas style={{ width: w, height }}>{children(w)}</Canvas>}
    </View>
  );
}

// ── Sınav ────────────────────────────────────────────
const SHELF_H = 112;
const SHELF_BOOK_H = SHELF_H - 8;

function Book({ b, name, count, i, n, rise, base, accent, tint, ink, onFill, font }: { b: { x: number; w: number; h: number; share: number }; name: string; count: string; i: number; n: number; rise: SharedValue<number>; base: number; accent: string; tint: string; ink: string; onFill: string; font: SkFont }) {
  // Kitaplar raftan sırayla yükselir, sonra içleri dolar: önce ders, sonra ilerleme.
  const q = useDerivedValue(() => { const t = Math.max(0, Math.min(1, rise.value * (n + 1.5) - i)); return t * (2 - t); });
  const box = useMemo(() => rrect(rect(b.x, base - b.h, b.w, b.h), 3, 3), [b.x, b.w, b.h, base]);
  const fill = useDerivedValue(() => { const h = b.h * b.share * q.value; return rect(b.x, base - h, b.w, h); });
  const filled = useMemo(() => rect(b.x, base - b.h * b.share, b.w, b.h * b.share), [b.x, b.w, b.h, b.share, base]);
  const transform = useDerivedValue(() => [{ translateY: (1 - q.value) * 14 }]);
  const opacity = useDerivedValue(() => (q.value > 0 ? Math.min(1, q.value * 2) : 0));
  const room = b.h - 26;
  // Sırt yazısı sığmazsa kısalır; kitap adı okunmadan raf yine gri kutu olur.
  const label = useMemo(() => {
    let t = name;
    while (t.length > 3 && font.measureText(t).width > room) t = t.slice(0, -1);
    return t === name ? t : `${t.trimEnd()}.`;
  }, [name, font, room]);
  const spine = useMemo(() => [{ translateX: b.x + b.w / 2 + 4 }, { translateY: base - 7 }, { rotate: -Math.PI / 2 }], [b.x, b.w, base]);
  const countW = font.measureText(count).width;
  const writing = (color: string) => (
    <>
      <Group transform={spine}><SkText x={0} y={0} text={label} font={font} color={color} /></Group>
      {b.w >= countW + 6 && <SkText x={b.x + (b.w - countW) / 2} y={base - b.h + 15} text={count} font={font} color={color} />}
    </>
  );
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect rect={box} color={tint} />
      <Group clip={box}>
        <Rect rect={fill} color={accent} />
        {/* Cilt yuvarlağı: düz şerit değil. */}
        <Rect x={b.x} y={base - b.h} width={b.w} height={b.h}><LinearGradient start={vec(b.x, 0)} end={vec(b.x + b.w, 0)} colors={['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.12)']} /></Rect>
      </Group>
      {writing(ink)}
      {b.share > 0 && <Group clip={filled}>{writing(onFill)}</Group>}
    </Group>
  );
}

function ShelfInner({ w, books, accent, ink, onFill, board }: { w: number; books: { name: string; done: number; total: number }[]; accent: string; ink: string; onFill: string; board: string }) {
  const laid = useMemo(() => shelfLayout(books, w, SHELF_BOOK_H), [books, w]);
  const rise = useTo(1, { duration: 500 + books.length * 90 });
  const font = useMemo(() => matchFont({ fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }), fontSize: F.caption, fontWeight: '600' }), []);
  return (
    <>
      {laid.map((b, i) => <Book key={i} b={b} name={books[i].name} count={`${books[i].done}/${books[i].total}`} i={i} n={laid.length} rise={rise} base={SHELF_BOOK_H} accent={accent} tint={accent + '2E'} ink={ink} onFill={onFill} font={font} />)}
      <RoundedRect x={0} y={SHELF_BOOK_H} width={w} height={4} r={2} color={board} />
    </>
  );
}

// ── Tez ──────────────────────────────────────────────
const PAGE_H = 92;
const PAGE_ROWS = 5;
const NIB = Skia.Path.Make().moveTo(0, 0).lineTo(3, -4).lineTo(13, -14).lineTo(16, -11).lineTo(6, -1).close();

function ThesisInner({ w, written, today, accent, paper, ink, line }: { w: number; written: number; today: number; accent: string; paper: string; ink: string; line: string }) {
  const rowY = (i: number) => 21 + i * 14;
  const x0 = 14; const x1 = w - 26;
  const to = Math.min(1, written + (today * 0.5) / PAGE_ROWS);
  const end = useTo(to, { duration: 1000 });
  const pathInk = useMemo(() => {
    const p = Skia.Path.Make();
    for (let r = 0; r < PAGE_ROWS; r++) {
      p.moveTo(x0, rowY(r));
      for (let x = x0 + 3; x <= x1; x += 3) p.lineTo(x, rowY(r) + Math.sin(x * 0.55 + r * 2) * 1.6 + Math.sin(x * 0.13 + r) * 0.8);
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);
  const pen = useDerivedValue(() => {
    const f = Math.min(PAGE_ROWS - 0.001, end.value * PAGE_ROWS);
    const r = Math.floor(f);
    return [{ translateX: x0 + (f - r) * (x1 - x0) }, { translateY: 21 + r * 14 }];
  });
  const fold = useMemo(() => Skia.Path.Make().moveTo(w - 14, 0).lineTo(w, 14).lineTo(w - 14, 14).close(), [w]);
  return (
    <>
      <RoundedRect x={0} y={0} width={w} height={PAGE_H} r={8} color={paper} />
      <Path path={fold} color={line} />
      {Array.from({ length: PAGE_ROWS }, (_, r) => <Line key={r} p1={vec(x0, rowY(r) + 4)} p2={vec(x1, rowY(r) + 4)} color={line} strokeWidth={0.7} />)}
      <Path path={pathInk} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" color={ink} start={0} end={end} />
      <Group transform={pen}><Path path={NIB} color={accent} /></Group>
    </>
  );
}

// ── Mülakat ──────────────────────────────────────────
const STAIR_H = 86;

function StairsInner({ w, index, total, today, accent, track, surface }: { w: number; index: number; total: number; today: number; accent: string; track: string; surface: string }) {
  const doorW = 24;
  const stepW = (w - doorW - 6) / total;
  const riseH = (STAIR_H - 40) / total;
  const heightOf = (i: number) => 12 + i * riseH;
  const pos = useTo(index + Math.min(0.68, today * 0.68), { duration: 500 + index * 320 });
  const walker = useDerivedValue(() => {
    const p = stepPosition(pos.value);
    return [{ translateX: (p.step + p.along) * stepW + stepW * 0.2 }, { translateY: STAIR_H - (12 + (p.step + p.rise) * riseH) - 7 - p.hop * 9 }];
  });
  const last = heightOf(total - 1);
  return (
    <>
      {Array.from({ length: total }, (_, i) => (
        <RoundedRect key={i} x={i * stepW} y={STAIR_H - heightOf(i)} width={stepW + 0.5} height={heightOf(i)} r={i === 0 ? 3 : 2} color={i <= index ? accent : track} opacity={i < index ? 1 : i === index ? 0.55 : 1} />
      ))}
      {/* Kapı: mülakat odası */}
      <RoundedRect x={w - doorW} y={STAIR_H - last - 36} width={doorW} height={36} r={3} style="stroke" strokeWidth={2} color={accent} />
      <Circle cx={w - 7} cy={STAIR_H - last - 17} r={1.8} color={accent} />
      <Line p1={vec(total * stepW, STAIR_H - last)} p2={vec(w, STAIR_H - last)} color={accent} strokeWidth={2} />
      <Group transform={walker}>
        <Circle cx={0} cy={0} r={7} color={surface} />
        <Circle cx={0} cy={0} r={5.5} color={accent} />
      </Group>
    </>
  );
}

// ── Koşu ─────────────────────────────────────────────
const RUN_H = 88;

function RunInner({ w, progress, today, accent, track, surface }: { w: number; progress: number; today: number; accent: string; track: string; surface: string }) {
  const { path, lut } = useMemo(() => {
    const p = Skia.Path.Make();
    const pts: { x: number; y: number }[] = [];
    const P = [[10, 70], [w * 0.42, RUN_H + 18], [w * 0.5, -10], [w - 30, 28]];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60; const u = 1 - t;
      const x = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
      const y = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
      pts.push({ x, y });
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    return { path: p, lut: polyLut(pts) as Lut };
  }, [w]);
  const end = useTo(Math.max(0.02, Math.min(1, progress + today * 0.015)), { duration: 1300 });
  const cx = useDerivedValue(() => lutAt(lut, end.value).x);
  const cy = useDerivedValue(() => lutAt(lut, end.value).y);
  const flag = { x: w - 30, y: 28 };
  return (
    <>
      <Path path={path} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" color={track} />
      <Path path={path} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" color={accent} opacity={0.32} start={0} end={end} />
      <Path path={path} style="stroke" strokeWidth={1.2} color={surface}><DashPathEffect intervals={[6, 6]} /></Path>
      {/* Bitiş bayrağı */}
      <Line p1={vec(flag.x, flag.y)} p2={vec(flag.x, flag.y - 26)} color={accent} strokeWidth={2} strokeCap="round" />
      {Array.from({ length: 6 }, (_, i) => (
        <Rect key={i} x={flag.x + 1 + (i % 3) * 6} y={flag.y - 26 + Math.floor(i / 3) * 6} width={6} height={6} color={(i + Math.floor(i / 3)) % 2 ? surface : accent} />
      ))}
      <Circle cx={cx} cy={cy} r={8} color={surface} />
      <Circle cx={cx} cy={cy} r={6} color={accent} />
    </>
  );
}

// ── Güç ──────────────────────────────────────────────
const BAR_H = 76;
const PLATE_SLOTS = 4;

function Plate({ x, h, side, i, p, n, accent }: { x: number; h: number; side: 1 | -1; i: number; p: SharedValue<number>; n: number; accent: string }) {
  const y = BAR_H / 2 - h / 2;
  const transform = useDerivedValue(() => {
    const t = Math.max(0, Math.min(1, p.value * n - i));
    return [{ translateX: side * (1 - t * (2 - t)) * 70 }];
  });
  const opacity = useDerivedValue(() => (p.value * n - i > 0 ? 1 : 0));
  return <Group transform={transform} opacity={opacity}><RoundedRect x={x} y={y} width={9} height={h} r={2.5} color={accent} /></Group>;
}

function BarbellInner({ w, days, accent, track, bar }: { w: number; days: number; accent: string; track: string; bar: string }) {
  const n = platesPerSide(days, PLATE_SLOTS);
  const p = useTo(1, { duration: 300 + n * 180 });
  const cx = w / 2;
  const sleeve = Math.min(64, w * 0.2);
  const heightOf = (i: number) => 58 - i * 9;
  const xOf = (i: number, side: 1 | -1) => (side === 1 ? cx + sleeve + i * 11 : cx - sleeve - i * 11 - 9);
  // Plaka oturunca bar hafifçe esner, sonra durur.
  const flex = useDerivedValue(() => {
    const beat = p.value * n;
    const s = n > 0 && p.value < 1 ? Math.sin((beat % 1) * Math.PI) * 1.6 : 0;
    return [{ translateY: s }];
  });
  return (
    <Group transform={flex}>
      <RoundedRect x={Math.max(4, cx - sleeve - PLATE_SLOTS * 11 - 16)} y={BAR_H / 2 - 2.5} width={Math.min(w - 8, (sleeve + PLATE_SLOTS * 11 + 16) * 2)} height={5} r={2.5} color={bar} />
      <RoundedRect x={cx - sleeve - 5} y={BAR_H / 2 - 7} width={5} height={14} r={1.5} color={bar} />
      <RoundedRect x={cx + sleeve} y={BAR_H / 2 - 7} width={5} height={14} r={1.5} color={bar} />
      {Array.from({ length: PLATE_SLOTS }, (_, i) => ([1, -1] as const).map(side => (
        <RoundedRect key={`s${i}${side}`} x={xOf(i, side) + (side === 1 ? 5 : 0)} y={BAR_H / 2 - heightOf(i) / 2} width={9} height={heightOf(i)} r={2.5} style="stroke" strokeWidth={1} color={track} />
      )))}
      {Array.from({ length: n }, (_, i) => ([1, -1] as const).map(side => (
        <Plate key={`p${i}${side}`} x={xOf(i, side) + (side === 1 ? 5 : 0)} h={heightOf(i)} side={side} i={i} n={n} p={p} accent={accent} />
      )))}
    </Group>
  );
}

// ── Genel spor ───────────────────────────────────────
const PULSE_H = 70;

function PulseInner({ w, flags, accent, track }: { w: number; flags: boolean[]; accent: string; track: string }) {
  const base = PULSE_H * 0.62;
  const { path, lut } = useMemo(() => {
    const pts: { x: number; y: number }[] = [{ x: 0, y: base }];
    const cell = w / flags.length;
    flags.forEach((on, i) => {
      const c = i * cell + cell / 2;
      if (on) pts.push({ x: c - 10, y: base }, { x: c - 6, y: base - 5 }, { x: c - 3, y: base + 5 }, { x: c + 1, y: base - 34 }, { x: c + 5, y: base + 12 }, { x: c + 9, y: base });
      else pts.push({ x: c - 5, y: base }, { x: c, y: base - 3 }, { x: c + 5, y: base });
    });
    pts.push({ x: w, y: base });
    const p = Skia.Path.Make();
    pts.forEach((q, i) => (i === 0 ? p.moveTo(q.x, q.y) : p.lineTo(q.x, q.y)));
    return { path: p, lut: polyLut(pts) as Lut };
  }, [w, flags, base]);
  const end = useTo(1, { duration: 1300 });
  const cx = useDerivedValue(() => lutAt(lut, end.value).x);
  const cy = useDerivedValue(() => lutAt(lut, end.value).y);
  return (
    <>
      <Line p1={vec(0, base)} p2={vec(w, base)} color={track} strokeWidth={1} />
      <Path path={path} style="stroke" strokeWidth={2.2} strokeJoin="round" strokeCap="round" color={accent} start={0} end={end} />
      <Circle cx={cx} cy={cy} r={3.5} color={accent} />
    </>
  );
}

// ── Kilo ─────────────────────────────────────────────
const DIAL_H = 96;
const TICKS = 10;

function DialInner({ w, pct, accent, track, needle }: { w: number; pct: number; accent: string; track: string; needle: string }) {
  const cx = w / 2; const cy = DIAL_H - 6;
  const R_ = Math.min(w / 2 - 12, DIAL_H - 16);
  const arc = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc({ x: cx - R_, y: cy - R_, width: R_ * 2, height: R_ * 2 }, 180, 180);
    return p;
  }, [cx, cy, R_]);
  const to = Math.max(0, Math.min(1, pct));
  const sweep = useTo(to, { spring: true, delay: 200 });
  const end = useDerivedValue(() => Math.max(0, Math.min(1, sweep.value)));
  const hand = useDerivedValue(() => [{ translateX: cx }, { translateY: cy }, { rotate: Math.PI + Math.PI * sweep.value }]);
  return (
    <>
      <Path path={arc} style="stroke" strokeWidth={8} strokeCap="round" color={track} />
      <Path path={arc} style="stroke" strokeWidth={8} strokeCap="round" color={accent} start={0} end={end} />
      {Array.from({ length: TICKS + 1 }, (_, i) => {
        const a = Math.PI + (Math.PI * i) / TICKS;
        const r0 = R_ - 9; const r1 = R_ - (i % 5 === 0 ? 17 : 13);
        return <Line key={i} p1={vec(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)} p2={vec(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)} color={needle} opacity={0.4} strokeWidth={1.2} strokeCap="round" />;
      })}
      <Group transform={hand}>
        <Line p1={vec(0, 0)} p2={vec(R_ - 20, 0)} color={needle} strokeWidth={2.5} strokeCap="round" />
      </Group>
      <Circle cx={cx} cy={cy} r={5} color={needle} />
    </>
  );
}

// ── Borç ─────────────────────────────────────────────
const CHAIN_H = 64;
const LINKS = 10;

function Link({ x, y, w, h, i, paid, p, n, accent, ghost }: { x: number; y: number; w: number; h: number; i: number; paid: boolean; p: SharedValue<number>; n: number; accent: string; ghost: string }) {
  const q = useDerivedValue(() => (paid ? Math.max(0, Math.min(1, p.value * (n + 1) - i)) : 0));
  const transform = useDerivedValue(() => [{ translateY: q.value * q.value * 26 }, { rotate: (i % 2 ? 1 : -1) * q.value * 0.5 }]);
  const opacity = useDerivedValue(() => 1 - q.value);
  const box = rrect(rect(x, y, w, h), h / 2, h / 2);
  return (
    <>
      {paid && <Group><RoundedRect rect={box} style="stroke" strokeWidth={1} color={ghost}><DashPathEffect intervals={[2, 3]} /></RoundedRect></Group>}
      <Group transform={transform} origin={vec(x + w / 2, y + h / 2)} opacity={opacity}>
        <RoundedRect rect={box} style="stroke" strokeWidth={3} color={accent} />
      </Group>
    </>
  );
}

function ChainInner({ w, pct, accent, ghost }: { w: number; pct: number; accent: string; ghost: string }) {
  const n = chainPaid(pct, LINKS);
  const p = useTo(1, { duration: 300 + n * 130, delay: 200 });
  const step = w / LINKS;
  const midY = 22;
  return (
    <>
      {Array.from({ length: LINKS }, (_, i) => (
        <Link key={i} i={i} n={n} p={p} paid={i < n} accent={accent} ghost={ghost}
          x={i * step - (i % 2 ? 0 : 2)} y={midY - (i % 2 ? 3 : 8)} w={step + 2} h={i % 2 ? 6 : 16} />
      ))}
    </>
  );
}

// ── Acil fon ─────────────────────────────────────────
const SHIELD = 92;

function ShieldInner({ months, total, accent, track, surface }: { months: number; total: number; accent: string; track: string; surface: string }) {
  const W_ = SHIELD * 0.86;
  const shape = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(W_ / 2, 2);
    p.cubicTo(W_ * 0.72, 12, W_ * 0.9, 14, W_ - 2, 14);
    p.cubicTo(W_ - 2, SHIELD * 0.58, W_ * 0.82, SHIELD * 0.8, W_ / 2, SHIELD - 2);
    p.cubicTo(W_ * 0.18, SHIELD * 0.8, 2, SHIELD * 0.58, 2, 14);
    p.cubicTo(W_ * 0.1, 14, W_ * 0.28, 12, W_ / 2, 2);
    p.close();
    return p;
  }, [W_]);
  const n = Math.max(1, total);
  const level = useTo(Math.max(0, Math.min(1, months / n)), { duration: 1100 });
  const fill = useDerivedValue(() => rect(0, SHIELD * (1 - level.value), W_, SHIELD * level.value));
  return (
    <Canvas style={{ width: W_, height: SHIELD }}>
      <Path path={shape} color={track} />
      <Group clip={shape}>
        <Rect rect={fill} color={accent} />
        <Rect rect={fill}><LinearGradient start={vec(0, 0)} end={vec(W_, 0)} colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.14)']} /></Rect>
        {Array.from({ length: n - 1 }, (_, i) => <Line key={i} p1={vec(0, (SHIELD * (i + 1)) / n)} p2={vec(W_, (SHIELD * (i + 1)) / n)} color={surface} strokeWidth={1.5} />)}
      </Group>
    </Canvas>
  );
}

// ── Seçici ───────────────────────────────────────────
export function PlanScene({ scene, accent }: { scene: PlanSceneData; accent: string }) {
  const { theme } = useAppTheme();
  const track = theme.surfaceContainerHigh;
  const box = { accessible: true, accessibilityLabel: scene.a11y };
  switch (scene.kind) {
    case 'exam': return <View {...box}><ExamScene field={scene.field} progress={scene.progress} today={scene.today} accent={accent} /></View>;
    case 'shelf': return <View {...box}><Sized height={SHELF_H}>{w => <ShelfInner w={w} books={scene.books} accent={accent} ink={theme.onSurface} onFill={theme.onPrimary} board={theme.onSurfaceMuted} />}</Sized></View>;
    case 'page': return <View {...box}><Sized height={PAGE_H}>{w => <ThesisInner w={w} written={scene.written} today={scene.today} accent={accent} paper={track} ink={theme.onSurfaceVariant} line={theme.outlineVariant} />}</Sized></View>;
    case 'stairs': return <View {...box}><Sized height={STAIR_H}>{w => <StairsInner w={w} index={scene.index} total={scene.total} today={scene.today} accent={accent} track={track} surface={theme.surfaceCard} />}</Sized></View>;
    case 'run': return <View {...box}><Sized height={RUN_H}>{w => <RunInner w={w} progress={scene.progress} today={scene.today} accent={accent} track={track} surface={theme.surfaceCard} />}</Sized></View>;
    case 'barbell': return <View {...box}><Sized height={BAR_H}>{w => <BarbellInner w={w} days={scene.days} accent={accent} track={theme.outlineVariant} bar={theme.onSurfaceMuted} />}</Sized></View>;
    case 'pulse': return <View {...box}><Sized height={PULSE_H}>{w => <PulseInner w={w} flags={scene.flags} accent={accent} track={track} />}</Sized></View>;
    case 'chain': return <View {...box}><Sized height={CHAIN_H}>{w => <ChainInner w={w} pct={scene.pct} accent={accent} ghost={theme.outlineVariant} />}</Sized></View>;
    case 'dial':
      return (
        <View {...box} style={{ gap: S.xs }}>
          <Sized height={DIAL_H}>{w => <DialInner w={w} pct={scene.pct} accent={accent} track={track} needle={theme.onSurface} />}</Sized>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{scene.from}</Text>
            <Text style={{ fontSize: F.callout, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{scene.now}</Text>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{scene.to}</Text>
          </View>
        </View>
      );
    case 'shield':
      return (
        <View {...box} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <ShieldInner months={scene.months} total={scene.total} accent={accent} track={track} surface={theme.surfaceCard} />
          <View style={{ flex: 1, gap: S.xxs }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: accent }}>{scene.amount}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs }}>
              {scene.months >= scene.total && <Check size={ICON.xs} color={accent} />}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{scene.goal}</Text>
            </View>
          </View>
        </View>
      );
  }
}
