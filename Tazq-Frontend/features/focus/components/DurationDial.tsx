import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { haptic } from '@/shared/utils/haptics';
import { F } from '@/shared/constants/tokens';

/*
  SÜRE KADRANI — süre HALKANIN KENDİSİNDEN seçilir (2026-11-01, kullanıcı: "süre seçimini bir şekilde yuvarlağa
  koyalım ki ekranda kalabalık olmasın · özel sürede 3 dakikayı seçemiyorum, beşer beşer gidiyor").
  Üstteki süre çubuğu ve "Özel" penceresi kalktı. Seans başlamadan halka bir kadrandır:
   · tutamacı (ya da halkanın herhangi bir yerini) çevir → 1 dakikalık adımlar, tam tur 120 dk;
   · 0/120 noktasından taşmaz (tur atlayıp 1'e düşmez), uçta durur;
   · HER DAKİKADA bir tık (saat ayarı gibi; iOS'ta seçim titreşimi); 12 çentik 10'ar dakikayı gösterir.
  HIZ (kullanıcı: "hızlı çekince yavaş yavaş geliyor"): sürüklerken değer YALNIZ bu bileşende yaşar ve büyük
  sayıyı kadran kendisi çizer; odak deposuna (ve tüm ekranın yeniden çizimine) parmak kalkınca BİR kez yazılır.
  Ortadaki dokunuşlar (görev seçimi) kadranı tetiklemez: yalnız halka bandında başlayan sürükleme sayılır.
*/
export const DIAL_MAX = 120;

export function minutesFromPoint(x: number, y: number, size: number): number {
  const c = size / 2;
  let a = Math.atan2(x - c, -(y - c)); // tepeden saat yönüne
  if (a < 0) a += Math.PI * 2;
  return Math.round((a / (Math.PI * 2)) * DIAL_MAX);
}

/** Tur atlamayı engeller: 118 → 2 sıçraması 120'de, 3 → 117 sıçraması 1'de durur. */
export function clampDial(prev: number, next: number): number {
  if (prev > DIAL_MAX * 0.75 && next < DIAL_MAX * 0.25) return DIAL_MAX;
  if (prev < DIAL_MAX * 0.25 && next > DIAL_MAX * 0.75) return 1;
  return Math.min(DIAL_MAX, Math.max(1, next));
}

export function DurationDial({ size, minutes, color, track, onCommit, onDragging, a11yLabel, unit }: {
  size: number; minutes: number; color: string; track: string;
  /** Parmak kalkınca seçilen değer (depoya yazılır). */
  onCommit: (m: number) => void;
  /** Sürükleme başladı/bitti — ekran bu sürede kendi sayacını gizler, sayıyı kadran çizer. */
  onDragging?: (on: boolean) => void;
  a11yLabel: string;
  unit: string;
}) {
  const [live, setLive] = useState(minutes);
  const [dragging, setDragging] = useState(false);
  const last = useRef(minutes);
  const inBand = useRef(false);
  useEffect(() => { if (!dragging) { setLive(minutes); last.current = minutes; } }, [minutes, dragging]);

  const r = size / 2 - 6;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const frac = Math.min(1, live / DIAL_MAX);
  const ang = frac * Math.PI * 2;
  const kx = c + r * Math.sin(ang);
  const ky = c - r * Math.cos(ang);

  const end = () => {
    if (!inBand.current) return;
    inBand.current = false;
    setDragging(false);
    onDragging?.(false);
    if (last.current !== minutes) onCommit(last.current);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(e => {
      const d = Math.hypot(e.x - c, e.y - c);
      inBand.current = d > r * 0.62 && d < r + 22;
      if (inBand.current) { setDragging(true); onDragging?.(true); }
    })
    .onUpdate(e => {
      if (!inBand.current) return;
      const m = clampDial(last.current, minutesFromPoint(e.x, e.y, size));
      if (m === last.current) return;
      haptic.select(); // her dakika bir tık
      last.current = m;
      setLive(m);
    })
    .onFinalize(end);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ position: 'absolute', width: size, height: size, zIndex: 13, alignItems: 'center', justifyContent: 'center' }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={a11yLabel}
        accessibilityValue={{ min: 1, max: DIAL_MAX, now: live }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => onCommit(Math.min(DIAL_MAX, Math.max(1, minutes + (e.nativeEvent.actionName === 'increment' ? 5 : -5))))}
      >
        <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const t = (i / 12) * Math.PI * 2;
            const r1 = r - 14;
            const r2 = r - (i % 3 === 0 ? 22 : 18);
            return <Line key={i} x1={c + r1 * Math.sin(t)} y1={c - r1 * Math.cos(t)} x2={c + r2 * Math.sin(t)} y2={c - r2 * Math.cos(t)} stroke={track} strokeWidth={i % 3 === 0 ? 2 : 1.4} strokeLinecap="round" />;
          })}
          <Circle
            cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${circumference}`} strokeDashoffset={circumference * (1 - frac)}
            transform={`rotate(-90 ${c} ${c})`}
          />
          <Circle cx={kx} cy={ky} r={dragging ? 16 : 13} fill={color} opacity={0.25} />
          <Circle cx={kx} cy={ky} r={8} fill="#FFFFFF" />
        </Svg>
        {dragging && (
          <View pointerEvents="none" style={{ alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: Math.round(size * 0.24), fontWeight: '700', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{live}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: F.footnote, fontWeight: '600', letterSpacing: 1.5 }}>{unit}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}
