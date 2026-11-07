import React, { useMemo } from 'react';
import { Circle, Group, Line, LinearGradient, Path, Rect, RoundedRect, Skia, rect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { litCount, type ExamField } from '@/features/modes/utils/planSignature';
import { Sized, useTo } from './PlanSceneKit';

/*
  SINAVIN KENDİ SAHNESİ (2026-11-06, kullanıcı: "katiplikse klavye, hukuksa ona göre bir animasyon"). İlerleme her sahnede gerçek pay: biten konu ya da yolda geçen süre.
    katiplik: klavye, ilerledikçe tuşlar yanar ve tek tek basılır, üstte yazı satırı uzar
    hukuk: terazi, kefeler dengeye yaklaşır, sallanıp oturur; biten iş sağ kefeye sikke olur
    dil: konuşma balonları, satırlar yazılır
    sağlık: kalp alttan dolar, iki kez atar, yanından nabız çizgisi geçer
    sayısal: abaküs, boncuklar tek tek karşıya geçer
    sürücü: yolda araba ilerler, ışık kırmızıdan yeşile döner
    güvenlik: kalkan dolar, yıldız belirir
    bilişim: uçbirim, komut satırları yazılır
    öğretmenlik: kara tahta, tebeşirle satırlar yazılır
  Hepsi bir kez oynar ve durur; bugünün işi bitince biraz daha ilerler. Hareketi Azalt'ta son hâl doğrudan çizilir (bkz. useTo).
*/
const H = 96;

// ── Klavye ───────────────────────────────────────────
const KEY_ROWS = [10, 9, 7];

function Key({ x, y, w, h, order, n, t, on, off }: { x: number; y: number; w: number; h: number; order: number; n: number; t: SharedValue<number>; on: string; off: string }) {
  const q = useDerivedValue(() => Math.max(0, Math.min(1, t.value * n - order)));
  const opacity = useDerivedValue(() => q.value);
  // Basılır ve kalkar: yalnız sırası geldiğinde.
  const transform = useDerivedValue(() => [{ translateY: Math.sin(q.value * Math.PI) * 2 }]);
  return (
    <Group transform={transform}>
      <RoundedRect x={x} y={y} width={w} height={h} r={3} color={off} />
      {order < n && <Group opacity={opacity}><RoundedRect x={x} y={y} width={w} height={h} r={3} color={on} /></Group>}
    </Group>
  );
}

function KeyboardInner({ w, p, accent, track, ink, surface }: { w: number; p: number; accent: string; track: string; ink: string; surface: string }) {
  const total = KEY_ROWS.reduce((a, b) => a + b, 0) + 1;
  const n = litCount(p, total);
  const t = useTo(1, { duration: 300 + n * 45 });
  const gap = 3;
  const keyW = (w - gap * (KEY_ROWS[0] - 1)) / KEY_ROWS[0];
  const keyH = 14;
  const top = 24;
  // Sıra karışık: gerçek yazı gibi, soldan sağa dolan çubuk gibi değil.
  const orderOf = useMemo(() => {
    const ids = Array.from({ length: total }, (_, i) => i);
    return ids.map(i => ({ i, k: Math.sin(i * 91.7) * 1000 % 1 })).sort((a, b) => a.k - b.k).reduce<number[]>((acc, e, o) => { acc[e.i] = o; return acc; }, []);
  }, [total]);
  const typed = useDerivedValue(() => Math.max(0.01, p * t.value));
  const line = useMemo(() => Skia.Path.Make().moveTo(2, 9).lineTo(w - 2, 9), [w]);
  const caret = useDerivedValue(() => 2 + (w - 4) * typed.value);
  let id = 0;
  return (
    <>
      <RoundedRect x={0} y={2} width={w} height={14} r={3} color={surface} />
      <Path path={line} style="stroke" strokeWidth={3} strokeCap="round" color={ink} opacity={0.75} start={0} end={typed} />
      <Group transform={useDerivedValue(() => [{ translateX: caret.value }])}><Rect x={1} y={4} width={1.5} height={10} color={accent} /></Group>
      {KEY_ROWS.map((count, r) => {
        const rowW = count * keyW + (count - 1) * gap;
        const x0 = (w - rowW) / 2;
        return Array.from({ length: count }, (_, k) => {
          const me = id++;
          return <Key key={me} x={x0 + k * (keyW + gap)} y={top + r * (keyH + gap)} w={keyW} h={keyH} order={orderOf[me]} n={n} t={t} on={accent} off={track} />;
        });
      })}
      {(() => { const me = id++; return <Key key={me} x={w * 0.24} y={top + 3 * (keyH + gap)} w={w * 0.52} h={keyH - 2} order={orderOf[me]} n={n} t={t} on={accent} off={track} />; })()}
    </>
  );
}

// ── Hukuk ────────────────────────────────────────────
function ScaleInner({ w, p, accent, track, ink }: { w: number; p: number; accent: string; track: string; ink: string }) {
  const cx = w / 2;
  const beamY = 18;
  const arm = Math.min(w * 0.36, 96);
  const MAX_TILT = 0.3;
  // Eksik kefe yukarıda, yaptıkça iner: tam dengede 0. Yay: sallanıp oturur.
  const bal = useTo(p, { spring: true, delay: 180 });
  const tilt = useDerivedValue(() => -MAX_TILT * (1 - bal.value));
  const beam = useDerivedValue(() => [{ translateX: cx }, { translateY: beamY }, { rotate: tilt.value }]);
  const dy = useDerivedValue(() => Math.sin(tilt.value) * arm);
  const dx = useDerivedValue(() => Math.cos(tilt.value) * arm);
  const left = useDerivedValue(() => [{ translateX: cx - dx.value }, { translateY: beamY - dy.value }]);
  const right = useDerivedValue(() => [{ translateX: cx + dx.value }, { translateY: beamY + dy.value }]);
  const pan = useMemo(() => {
    const q = Skia.Path.Make();
    q.moveTo(-24, 30); q.quadTo(0, 48, 24, 30); q.close();
    return q;
  }, []);
  const strings = useMemo(() => Skia.Path.Make().moveTo(-23, 30).lineTo(0, 0).lineTo(23, 30), []);
  const coins = Math.min(5, litCount(p, 5));
  return (
    <>
      <RoundedRect x={cx - 2} y={beamY} width={4} height={H - beamY - 8} r={2} color={ink} />
      <RoundedRect x={cx - 26} y={H - 8} width={52} height={6} r={3} color={ink} />
      <Group transform={beam}>
        <RoundedRect x={-arm} y={-2} width={arm * 2} height={4} r={2} color={ink} />
      </Group>
      <Circle cx={cx} cy={beamY} r={5} color={accent} />
      <Group transform={left}>
        <Path path={strings} style="stroke" strokeWidth={1} color={ink} />
        <Path path={pan} color={track} />
      </Group>
      <Group transform={right}>
        <Path path={strings} style="stroke" strokeWidth={1} color={ink} />
        {Array.from({ length: coins }, (_, i) => <RoundedRect key={i} x={-9 + (i % 2) * 2} y={27 - i * 3} width={18} height={3} r={1.5} color={accent} />)}
        <Path path={pan} color={accent} />
      </Group>
    </>
  );
}

// ── Dil ──────────────────────────────────────────────
function Bubble({ x, y, bw, bh, tailLeft, p, fill, ink, lines }: { x: number; y: number; bw: number; bh: number; tailLeft: boolean; p: SharedValue<number>; fill: string; ink: string; lines: number }) {
  const tail = useMemo(() => {
    const q = Skia.Path.Make();
    const tx = tailLeft ? x + 14 : x + bw - 14;
    q.moveTo(tx - 7, y + bh - 1); q.lineTo(tx + (tailLeft ? -8 : 8), y + bh + 10); q.lineTo(tx + 7, y + bh - 1); q.close();
    return q;
  }, [x, y, bw, bh, tailLeft]);
  const path = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < lines; i++) {
      const ly = y + 12 + i * ((bh - 20) / Math.max(1, lines - 1));
      q.moveTo(x + 12, ly); q.lineTo(x + bw - 12 - (i === lines - 1 ? bw * 0.25 : 0), ly);
    }
    return q;
  }, [x, y, bw, bh, lines]);
  return (
    <>
      <RoundedRect x={x} y={y} width={bw} height={bh} r={12} color={fill} />
      <Path path={tail} color={fill} />
      <Path path={path} style="stroke" strokeWidth={3} strokeCap="round" color={ink} start={0} end={p} />
    </>
  );
}

function SpeechInner({ w, p, accent, track, ink, onAccent }: { w: number; p: number; accent: string; track: string; ink: string; onAccent: string }) {
  const a = useTo(Math.max(0.03, p), { duration: 900 });
  const b = useTo(Math.max(0.03, p), { duration: 900, delay: 520 });
  return (
    <>
      <Bubble x={0} y={2} bw={w * 0.6} bh={50} tailLeft p={a} fill={track} ink={ink} lines={3} />
      <Bubble x={w * 0.36} y={46} bw={w * 0.64} bh={36} tailLeft={false} p={b} fill={accent} ink={onAccent} lines={2} />
    </>
  );
}

// ── Sağlık ───────────────────────────────────────────
function HeartInner({ w, p, accent, track }: { w: number; p: number; accent: string; track: string }) {
  const size = 72;
  const cx = w / 2;
  const top = (H - size) / 2 + 2;
  const heart = useMemo(() => {
    const q = Skia.Path.Make();
    const s = size / 2;
    q.moveTo(cx, top + size);
    q.cubicTo(cx - s * 1.4, top + size * 0.55, cx - s * 1.05, top - 2, cx - s * 0.4, top + 2);
    q.cubicTo(cx - s * 0.18, top + 3, cx, top + size * 0.14, cx, top + size * 0.2);
    q.cubicTo(cx, top + size * 0.14, cx + s * 0.18, top + 3, cx + s * 0.4, top + 2);
    q.cubicTo(cx + s * 1.05, top - 2, cx + s * 1.4, top + size * 0.55, cx, top + size);
    q.close();
    return q;
  }, [cx, top]);
  const level = useTo(Math.max(0.03, p), { duration: 1000 });
  const fill = useDerivedValue(() => rect(cx - size, top + size * (1 - level.value), size * 2, size * level.value + 2));
  const trace = useTo(1, { duration: 1300 });
  // Çizgi kalbin önünden geçerken iki kez atar, sonra durur.
  const beat = useDerivedValue(() => {
    const t = trace.value;
    const pulse = t > 0.42 && t < 0.72 ? Math.abs(Math.sin(((t - 0.42) / 0.3) * Math.PI * 2)) : 0;
    const s = 1 + pulse * 0.07;
    return [{ translateX: cx }, { translateY: top + size / 2 }, { scale: s }, { translateX: -cx }, { translateY: -(top + size / 2) }];
  });
  const ecg = useMemo(() => {
    const q = Skia.Path.Make();
    const y = H / 2 + 2;
    q.moveTo(0, y); q.lineTo(cx - size * 0.62, y); q.lineTo(cx - size * 0.55, y - 8); q.lineTo(cx - size * 0.5, y + 7); q.lineTo(cx - size * 0.46, y);
    q.moveTo(cx + size * 0.46, y); q.lineTo(cx + size * 0.5, y - 14); q.lineTo(cx + size * 0.55, y + 10); q.lineTo(cx + size * 0.62, y); q.lineTo(w, y);
    return q;
  }, [w, cx]);
  return (
    <>
      <Path path={ecg} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={accent} start={0} end={trace} />
      <Group transform={beat}>
        <Path path={heart} color={track} />
        <Group clip={heart}><Rect rect={fill} color={accent} /></Group>
      </Group>
    </>
  );
}

// ── Sayısal ──────────────────────────────────────────
const RODS = 4;
const BEADS = 10;

function Bead({ x0, x1, y, r, i, n, t, on, off }: { x0: number; x1: number; y: number; r: number; i: number; n: number; t: SharedValue<number>; on: string; off: string }) {
  const moved = i < n;
  const cx = useDerivedValue(() => {
    if (!moved) return x0;
    const q = Math.max(0, Math.min(1, t.value * n - i));
    return x0 + (x1 - x0) * (q * (2 - q));
  });
  return <Circle cx={cx} cy={y} r={r} color={moved ? on : off} />;
}

function AbacusInner({ w, p, accent, track, ink }: { w: number; p: number; accent: string; track: string; ink: string }) {
  const total = RODS * BEADS;
  const n = litCount(p, total);
  const t = useTo(1, { duration: 300 + n * 28 });
  const pad = 8;
  const rowH = (H - 24) / RODS;
  const r = Math.min(rowH * 0.36, 6.5);
  const step = r * 1.9;
  return (
    <>
      <RoundedRect x={0} y={2} width={w} height={H - 4} r={8} style="stroke" strokeWidth={3} color={ink} />
      {Array.from({ length: RODS }, (_, row) => {
        const y = 12 + row * rowH + rowH / 2;
        return (
          <Group key={row}>
            <Line p1={vec(pad, y)} p2={vec(w - pad, y)} color={ink} strokeWidth={1.5} opacity={0.5} />
            {Array.from({ length: BEADS }, (_, b) => {
              const i = row * BEADS + b;
              // Doluş sırası: her telde sağdan sola: önce en sağa gidecek boncuk.
              return <Bead key={b} x0={pad + r + (BEADS - 1 - b) * step} x1={w - pad - r - b * step} y={y} r={r} i={i} n={n} t={t} on={accent} off={track} />;
            })}
          </Group>
        );
      })}
    </>
  );
}

// ── Sürücü ───────────────────────────────────────────
function DriveInner({ w, p, accent, track, ink, surface, lamps }: { w: number; p: number; accent: string; track: string; ink: string; surface: string; lamps: readonly [string, string, string] }) {
  const roadY = H - 26;
  const end = w - 40;
  const x = useTo(Math.max(0.03, p), { duration: 1300 });
  const car = useDerivedValue(() => [{ translateX: 8 + (end - 56) * x.value }, { translateY: roadY - 2 }]);
  const stage = p >= 2 / 3 ? 2 : p >= 1 / 3 ? 1 : 0;
  return (
    <>
      <RoundedRect x={0} y={roadY} width={w} height={22} r={4} color={track} />
      {Array.from({ length: Math.floor(w / 26) }, (_, i) => <Rect key={i} x={6 + i * 26} y={roadY + 10} width={14} height={2} color={surface} />)}
      {/* Işık: sınav yaklaştıkça değil, bildikçe yeşerir. */}
      <RoundedRect x={w - 26} y={4} width={20} height={52} r={5} color={ink} />
      <Rect x={w - 18} y={56} width={4} height={roadY - 56} color={ink} />
      {lamps.map((c, i) => <Circle key={i} cx={w - 16} cy={14 + i * 16} r={5.5} color={c} opacity={i === stage ? 1 : 0.22} />)}
      <Group transform={car}>
        <RoundedRect x={0} y={-12} width={44} height={12} r={4} color={accent} />
        <RoundedRect x={9} y={-22} width={24} height={12} r={4} color={accent} />
        <RoundedRect x={12} y={-19} width={8} height={7} r={1.5} color={surface} />
        <RoundedRect x={22} y={-19} width={8} height={7} r={1.5} color={surface} />
        <Circle cx={11} cy={1} r={5} color={ink} />
        <Circle cx={33} cy={1} r={5} color={ink} />
      </Group>
    </>
  );
}

// ── Güvenlik ─────────────────────────────────────────
function BadgeInner({ w, p, accent, track, surface }: { w: number; p: number; accent: string; track: string; surface: string }) {
  const bw = 76; const x0 = (w - bw) / 2;
  const shape = useMemo(() => {
    const q = Skia.Path.Make();
    q.moveTo(x0 + bw / 2, 2);
    q.cubicTo(x0 + bw * 0.72, 12, x0 + bw * 0.9, 13, x0 + bw - 2, 13);
    q.cubicTo(x0 + bw - 2, H * 0.58, x0 + bw * 0.82, H * 0.8, x0 + bw / 2, H - 2);
    q.cubicTo(x0 + bw * 0.18, H * 0.8, x0 + 2, H * 0.58, x0 + 2, 13);
    q.cubicTo(x0 + bw * 0.1, 13, x0 + bw * 0.28, 12, x0 + bw / 2, 2);
    q.close();
    return q;
  }, [x0]);
  const star = useMemo(() => {
    const q = Skia.Path.Make();
    const c = { x: x0 + bw / 2, y: H * 0.45 };
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 7.5 : 17;
      if (i === 0) q.moveTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); else q.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    }
    q.close();
    return q;
  }, [x0]);
  const level = useTo(Math.max(0.03, p), { duration: 1100 });
  const fill = useDerivedValue(() => rect(x0, H * (1 - level.value), bw, H * level.value));
  return (
    <>
      <Path path={shape} color={track} />
      <Group clip={shape}>
        <Rect rect={fill} color={accent} />
        <Rect x={x0} y={0} width={bw} height={H}><LinearGradient start={vec(x0, 0)} end={vec(x0 + bw, 0)} colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.12)']} /></Rect>
      </Group>
      <Path path={star} color={surface} />
    </>
  );
}

// ── Bilişim ve öğretmenlik ───────────────────────────
function WrittenBoardInner({ w, p, bg, ink, caret, prompt, handwriting }: { w: number; p: number; bg: string; ink: string; caret: string; prompt: boolean; handwriting: boolean }) {
  const widths = [0.55, 0.8, 0.42, 0.68, 0.3];
  const rowY = (i: number) => 18 + i * 15;
  const x0 = prompt ? 26 : 14;
  const room = w - x0 - 14;
  const path = useMemo(() => {
    const q = Skia.Path.Make();
    widths.forEach((f, r) => {
      q.moveTo(x0, rowY(r));
      for (let x = x0 + 3; x <= x0 + room * f; x += 3) q.lineTo(x, rowY(r) + (handwriting ? Math.sin(x * 0.5 + r * 2) * 1.8 : 0));
    });
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, x0, handwriting]);
  const end = useTo(Math.max(0.03, p), { duration: 1100 });
  const totalW = widths.reduce((a, b) => a + b, 0);
  const pos = useDerivedValue(() => {
    let left = end.value * totalW; let r = 0;
    while (r < widths.length - 1 && left > widths[r]) { left -= widths[r]; r++; }
    return [{ translateX: x0 + room * Math.min(left, widths[r]) + 3 }, { translateY: 18 + r * 15 - 5 }];
  });
  return (
    <>
      <RoundedRect x={0} y={0} width={w} height={H} r={8} color={bg} />
      {prompt && widths.map((_, r) => <Path key={r} path={Skia.Path.Make().moveTo(12, rowY(r) - 4).lineTo(17, rowY(r)).lineTo(12, rowY(r) + 4)} style="stroke" strokeWidth={1.5} color={caret} opacity={0.75} />)}
      <Path path={path} style="stroke" strokeWidth={handwriting ? 2 : 3} strokeCap="round" strokeJoin="round" color={ink} start={0} end={end} />
      <Group transform={pos}><Rect x={0} y={0} width={handwriting ? 3 : 6} height={10} color={caret} /></Group>
    </>
  );
}

// ── Seçici ───────────────────────────────────────────
export function ExamScene({ field, progress, today, accent }: { field: Exclude<ExamField, 'general'>; progress: number; today: number; accent: string }) {
  const { theme, isDark } = useAppTheme();
  // Bugünün işi de sahnede görünür: konu bitmeden de yapılan iş boşa gitmesin.
  const p = Math.max(0, Math.min(1, progress + today * 0.06));
  const track = theme.surfaceContainerHigh;
  const ink = theme.onSurfaceMuted;
  return (
    <Sized height={H}>
      {w => {
        switch (field) {
          case 'typing': return <KeyboardInner w={w} p={p} accent={accent} track={track} ink={theme.onSurfaceVariant} surface={track} />;
          case 'law': return <ScaleInner w={w} p={p} accent={accent} track={track} ink={ink} />;
          case 'language': return <SpeechInner w={w} p={p} accent={accent} track={track} ink={theme.onSurfaceVariant} onAccent={theme.onPrimary} />;
          case 'health': return <HeartInner w={w} p={p} accent={accent} track={track} />;
          case 'numeric': return <AbacusInner w={w} p={p} accent={accent} track={track} ink={ink} />;
          case 'driving': return <DriveInner w={w} p={p} accent={accent} track={track} ink={ink} surface={theme.surfaceCard} lamps={[theme.error, theme.warning, theme.success]} />;
          case 'security': return <BadgeInner w={w} p={p} accent={accent} track={track} surface={theme.surfaceCard} />;
          case 'tech': return <WrittenBoardInner w={w} p={p} bg={isDark ? track : theme.onSurface} ink={isDark ? theme.onSurfaceVariant : theme.surfaceCard} caret={accent} prompt handwriting={false} />;
          case 'teaching': return <WrittenBoardInner w={w} p={p} bg={accent} ink={theme.onPrimary} caret={theme.onPrimary} prompt={false} handwriting />;
        }
      }}
    </Sized>
  );
}
