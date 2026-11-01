import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Blur, Fill, Text as SkText, useFont, RadialGradient, vec, Path as SkPath, Skia } from '@shopify/react-native-skia';
import type { AuraMark } from '@/features/modes/store/usePrefsStore';
import { useSharedValue, withRepeat, withTiming, Easing, useDerivedValue, cancelAnimation } from 'react-native-reanimated';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/*
  AURA AVATAR — herkesin profil işareti (2026-11-01, kullanıcı: "avatar olayı objektif ne diyorsun · baş harf soğuk
  olmaz mı · her user'ı içine çeksin · vurguyu yeşil yapınca çok patlak oldu, eli ayağı düzgün olmalı").

  Neden 3B karakterler değil: kimlik sade (gümüş yazı, gece zemini); karakterler oyun havası veriyor, küçük yuvarlakta
  yüz seçilmiyor, 12 hazır yüz kimseyi temsil etmiyordu. Neden düz baş harf değil: "isimsiz profil" gibi soğuk.

  RENK DİSİPLİNİ (ilk sürüm parlak vurgularda bağırıyordu — doygunluk olduğu gibi + 25–55° ton kayması):
   · zemin: vurgu tonunda KOYU MÜREKKEP (açılıştaki gece zemini gibi)
   · lekeler: vurgu rengi KISILMIŞ doygunlukla (35–55), yanında yalnız YAKIN komşu ton (±14°) ve soğuk gümüş parıltı
   → hangi renk seçilirse seçilsin sakin, uyumlu, markanın mürekkep aurası.
  KİŞİYE ÖZEL: leke yerleri addan türetilir. CANLI BİLGİ: `glow` (0..1) = son 7 günün tutarlılığı.
  HARF: Skia ile tuvalin içinde, glifin GERÇEK sınırları ölçülerek ortalanır (RN metni yazı tipi boşlukları yüzünden
  küçük boyutta kayıyordu). Harf yerine simge ya da boş aura seçilebilir (`mark`, bkz. AURA_GLYPHS).
*/

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m.slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Auranın harfi — YALNIZ adın ilk harfi ("Osman Çilingir → OÇ" gibi istenmeyen kısaltmalar olmasın).
 */
export function initialsOf(name?: string | null): string {
  const first = (name ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
  return [...first][0]?.toLocaleUpperCase('tr') ?? '';
}

/** Vurgu renginden sakin aura paleti (saf, test edilebilir). */
export function auraPalette(accent: string, seed: number, glow: number) {
  const [h0, s0] = hexToHsl(accent);
  const neutral = s0 < 15;
  const h = neutral ? 228 : h0; // nötr vurgu (grafit): markanın gümüş-mürekkep tonu
  const sat = neutral ? 18 : clamp(s0 * 0.55, 35, 55);
  const near = (seed % 2 ? 1 : -1) * 14; // yakın komşu ton, yönü addan
  const g = clamp(glow, 0, 1);
  return {
    sat,
    base: hsl(h, neutral ? 26 : clamp(sat * 0.6, 22, 34), 10 + g * 4),
    blobs: [
      hsl(h, sat, 50, 0.55 + 0.35 * g),              // ana renk
      hsl(h + near, sat * 0.85, 44, 0.4 + 0.35 * g), // yakın komşu
      hsl(220, 14, 70, 0.18 + 0.22 * g),             // soğuk gümüş parıltı
    ],
  };
}

/**
 * Harfe alternatif işaretler — 24'lük kutuda dolu şekiller; tuvalde ölçülüp tam ortalanır. Her biri bir değer
 * (kullanıcı: "şekiller daha anlamlı ve daha çok olmalı"): yıldız=odak, ay=gece, güneş=sabah, yaprak=büyüme,
 * damla=akış, parıltı=fikir, dağ=hedef, dalga=sakinlik, kalp=özen, şimşek=enerji, alev=seri, ok=yön.
 */
export const AURA_GLYPHS: Record<Exclude<AuraMark, 'initial' | 'none'>, string> = {
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z M11 1h2v3.5h-2z M11 19.5h2V23h-2z M1 11h3.5v2H1z M19.5 11H23v2h-3.5z M4.2 5.6l1.4-1.4 2.5 2.5-1.4 1.4z M15.9 17.3l1.4-1.4 2.5 2.5-1.4 1.4z M4.2 18.4l2.5-2.5 1.4 1.4-2.5 2.5z M15.9 6.7l2.5-2.5 1.4 1.4-2.5 2.5z',
  leaf: 'M5 19C5 10 10 4 20 4c0 10-6 15-15 15z',
  drop: 'M12 2.5c3.5 4.5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.5 8.5 7 12 2.5z',
  spark: 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z',
  mountain: 'M2 20L9.5 7l4.2 7 2.8-4L22 20z',
  wave: 'M2 13c2.5-3.2 5-3.2 7.5 0s5 3.2 7.5 0c1.7-2.1 3.3-2.6 5-1.5V19H2z',
  heart: 'M12 21s-8.5-5.4-8.5-11.2A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6C20.5 15.6 12 21 12 21z',
  bolt: 'M13.5 2L4 14h7l-1.5 8L19 10h-7z',
  flame: 'M12 2c1 4.2 6 6.3 6 12.2a6 6 0 0 1-12 0c0-3.2 1.9-5.3 3-7.2 0 2.1 1 3.3 2.1 3.3 0-3.2-.1-5.4.9-8.3z',
  arrow: 'M12 2l7.5 19L12 16.8 4.5 21z',
};

export function AuraAvatar({ name, accent, size, glow = 0.6, animated = false, mark = 'initial' }: {
  name?: string | null; accent: string; size: number; glow?: number; animated?: boolean; mark?: AuraMark;
}) {
  const reduce = useReduceMotion();
  const seed = hash(name || 'tazq');
  const pal = useMemo(() => auraPalette(accent, seed, glow), [accent, seed, glow]);

  const blobs = useMemo(() => {
    const rnd = (k: number) => ((seed >>> (k * 3)) % 1000) / 1000;
    return [
      { x: 0.3 + rnd(2) * 0.25, y: 0.28 + rnd(3) * 0.2, r: 0.5 },
      { x: 0.55 + rnd(4) * 0.2, y: 0.5 + rnd(5) * 0.2, r: 0.44 },
      { x: 0.35 + rnd(6) * 0.3, y: 0.22 + rnd(7) * 0.15, r: 0.26 },
    ].map((p, i) => ({ ...p, color: pal.blobs[i] }));
  }, [seed, pal]);

  const t = useSharedValue(0);
  const move = animated && !reduce;
  useEffect(() => {
    if (!move) { t.value = 0; return; }
    t.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [move, t]);
  const c = size / 2;
  const rot = useDerivedValue(() => [{ rotate: t.value * Math.PI * 2 }], [t]);

  const letter = mark === 'initial' ? initialsOf(name) : '';
  const font = useFont(PlusJakartaSans_800ExtraBold, Math.round(size * 0.44));
  // Glifin GERÇEK sınırlarına göre tam ortala (yazı tipinin üst/alt boşlukları hesaba girmez).
  /*
    İŞARETİN KENDİ HAREKETİ (kullanıcı: "statik istemiyorum hiçbirini") — her işaret, anlamına uygun, HEP açık, hafif:
    yıldız pırıldar · ay sallanır · güneş döner · yaprak sapından sallanır · damla süzülür · parıltı atar ·
    dağ yükselir · dalga akar · kalp çift vurur · şimşek çakar · alev titrer · ok ileri itilir · harf nefes alır.
    Ayrı saat (4 sn): auranın yavaş dönüşünden bağımsız. Hareketi Azalt → durur.
  */
  const mt = useSharedValue(0);
  useEffect(() => {
    if (reduce || mark === 'none') { mt.value = 0; return; }
    mt.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(mt);
  }, [reduce, mark, mt]);
  const u = size / 24; // bir "şekil birimi"
  const markTf = useDerivedValue(() => {
    const p = mt.value * Math.PI * 2;
    const sn = Math.sin(p);
    switch (mark) {
      case 'star': return [{ scale: 1 + 0.08 * Math.max(0, Math.sin(p * 2)) }, { rotate: 0.12 * sn }];
      case 'moon': return [{ rotate: 0.16 * sn }];
      case 'sun': return [{ rotate: mt.value * Math.PI * 2 * 0.25 }];
      case 'leaf': return [{ rotate: 0.14 * sn }];
      case 'drop': return [{ translateY: 0.9 * u * sn }];
      case 'spark': return [{ scale: 1 + 0.1 * Math.abs(Math.sin(p)) }, { rotate: 0.4 * sn }];
      case 'mountain': return [{ translateY: -0.6 * u * Math.max(0, sn) }];
      case 'wave': return [{ translateX: 0.9 * u * sn }];
      case 'heart': { const b = (mt.value * 2) % 1; return [{ scale: 1 + 0.1 * (Math.exp(-((b - 0.1) ** 2) / 0.002) + 0.6 * Math.exp(-((b - 0.25) ** 2) / 0.002)) }]; }
      case 'bolt': { // çakma: hızlı parlar, yavaş söner (sert opaklık sıçraması "bozuk" görünüyordu)
        const f = (mt.value * 2) % 1;
        const flash = f < 0.08 ? f / 0.08 : Math.exp(-(f - 0.08) * 9);
        return [{ scale: 1 + 0.08 * flash }];
      }
      case 'flame': return [{ scaleY: 1 + 0.07 * Math.sin(p * 3) }, { scaleX: 1 - 0.03 * Math.sin(p * 3) }];
      case 'arrow': return [{ translateY: -0.8 * u * Math.max(0, Math.sin(p * 2)) }];
      default: return [{ scale: 1 + 0.045 * sn }];
    }
  }, [mark, u]);
  const markOpacity = useDerivedValue(() => {
    if (mark === 'bolt') { const f = (mt.value * 2) % 1; const flash = f < 0.08 ? f / 0.08 : Math.exp(-(f - 0.08) * 9); return 0.72 + 0.28 * flash; }
    if (mark === 'star') return 0.85 + 0.15 * Math.max(0, Math.sin(mt.value * Math.PI * 4));
    return 1;
  }, [mark]);
  const pos = useMemo(() => {
    if (!font || !letter) return null;
    const b = font.measureText(letter);
    return { x: c - b.width / 2 - b.x, y: c - b.height / 2 - b.y };
  }, [font, letter, c]);
  // Simge işareti: yolun GERÇEK sınırlarına göre ölçeklenip ortalanır (harfle aynı optik büyüklük).
  const glyph = useMemo(() => {
    if (mark === 'initial' || mark === 'none') return null;
    const path = Skia.Path.MakeFromSVGString(AURA_GLYPHS[mark]);
    if (!path) return null;
    const b = path.computeTightBounds();
    const k = (size * 0.4) / Math.max(b.width, b.height);
    const m = Skia.Matrix();
    m.translate(c - (b.x + b.width / 2) * k, c - (b.y + b.height / 2) * k);
    m.scale(k, k);
    path.transform(m);
    return path;
  }, [mark, size, c]);

  return (
    <View style={{ width: size, height: size }}>
      {/* Kırpma kenarında 1 px'lik açık şerit kalmasın (iOS yuvarlama): tuval her yönden 1 px taşar. */}
      <Canvas style={{ position: 'absolute', left: -1, top: -1, width: size + 2, height: size + 2 }}>
        <Group transform={[{ translateX: 1 }, { translateY: 1 }]}>
          <Fill color={pal.base} />
          <Group origin={{ x: c, y: c }} transform={rot}>
            {blobs.map((b, i) => (
              <Circle key={i} cx={b.x * size} cy={b.y * size} r={b.r * size} color={b.color}>
                <Blur blur={size * 0.16} />
              </Circle>
            ))}
          </Group>
          {/* Kenarı hafifçe koyulaştıran vinyet: aura ortada toplanır, kenar "kesik" görünmez. */}
          <Circle cx={c} cy={c} r={c}>
            <RadialGradient c={vec(c, c)} r={c} colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.28)']} positions={[0, 0.62, 1]} />
          </Circle>
          <Group origin={{ x: c, y: c }} transform={markTf} opacity={markOpacity}>
            {pos && font && <SkText x={pos.x} y={pos.y} text={letter} font={font} color="rgba(255,255,255,0.94)" />}
            {glyph && <SkPath path={glyph} color="rgba(255,255,255,0.92)" />}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}
