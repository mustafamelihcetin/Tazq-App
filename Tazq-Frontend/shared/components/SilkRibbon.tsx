import React from 'react';
import { Blur, Group, Paint, Vertices, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/*
  İPEK KUŞAK — gerçek 3B ışıklandırmalı, bükülen şerit (açılış ekranı için, 2026-10-31).
  Kullanıcı: "kuşaklar 3 boyutlu, ultra gerçekçi olmalı, dümdüz gelmemeli".

  Model: ekranda dalgalı bir orta çizgi C(s) (s: 0..1). Şerit bu çizgi boyunca kendi ekseninde
  döner (twist). Her kesitte:
    · teğet T (2B), ekran-içi normal N, bükülme açısı θ(s);
    · şeridin genişlik yönü B = (N·cosθ, sinθ) → görünen yarı genişlik = w·cosθ (bükülünce daralır);
    · yüzey normali n = T × B (3B) → Blinn-Phong: ortam + dağınık + saten parlaması;
    · n.z < 0 → ARKA yüz: aynı kumaşın daha koyu tonu (gerçek kurdele gibi).
  Köşe başına renk (Vertices, triangleStrip): ışık kesitten kesite pürüzsüz akar.
  Gölge: aynı şekil, kaydırılmış + bulanık, düşük opaklıkta.

  Animasyon değerleri:
    head 0→1 — şeridin ucu yol boyunca ilerler (giriş: kuşak açılarak gelir);
    tail 0→1 — kuyruk yol boyunca ilerler (çıkış: kuşak kendi yolunda akıp gider);
    phase    — dalga ve bükülme fazı (canlılık).
  Tüm hesap UI iş parçacığında (worklet); JS köprüsüne her karede veri gitmez.
*/

/** Kesit sayısı: 64 akıcı büküm; zayıf cihazda 36 (göz farkı az, işlem yarıya iner). */
const SEGMENTS = 64;
const SEGMENTS_LOW = 36;
/** Işık: sol üstten, ekrana doğru. Görüş: ekrandan dışarı. */
const L = (() => { const x = -0.45, y = -0.62, z = 0.64; const m = Math.hypot(x, y, z); return [x / m, y / m, z / m]; })();
const H = (() => { const x = L[0], y = L[1], z = L[2] + 1; const m = Math.hypot(x, y, z); return [x / m, y / m, z / m]; })();

export interface RibbonPath {
  /** Başlangıç ve bitiş noktaları (ekran dışından ekran dışına). */
  x0: number; y0: number; x1: number; y1: number;
  /** Dalga genliği (pt) ve dalga sayısı (yol boyunca). */
  amp: number; waves: number;
  /** Bükülme turu sayısı (yol boyunca). */
  twists: number;
  /** Şerit genişliği (pt). */
  width: number;
}

export function SilkRibbon({ path, rgb, head, tail, phase, shadow = 0.22, lowPower = false }: {
  path: RibbonPath;
  /** Kumaşın rengi (0-255). */
  rgb: [number, number, number];
  head: SharedValue<number>; tail: SharedValue<number>; phase: SharedValue<number>;
  shadow?: number;
  /** Zayıf cihaz: daha az kesit, bulanık gölge yok. */
  lowPower?: boolean;
}) {
  const segs = lowPower ? SEGMENTS_LOW : SEGMENTS;
  const { x0, y0, x1, y1, amp, waves, twists, width } = path;
  const [cr, cg, cb] = rgb;

  const mesh = useDerivedValue(() => {
    const h = Math.max(0, Math.min(1, head.value));
    const t = Math.max(0, Math.min(1, tail.value));
    const pts: { x: number; y: number }[] = [];
    const cols: string[] = [];
    if (h - t < 0.002) return { pts: [vec(0, 0), vec(0, 0), vec(0, 0)], cols: ['transparent', 'transparent', 'transparent'] };
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;      // ana yön
    const px = -uy, py = ux;                  // ana yönün dikliği (dalga ekseni)
    const ph = phase.value;
    for (let i = 0; i <= segs; i++) {
      const s = t + ((h - t) * i) / segs;
      // Orta çizgi: düz yol + dikine dalga.
      const wv = Math.sin(s * waves * Math.PI * 2 + ph);
      const cx = x0 + dx * s + px * amp * wv;
      const cy = y0 + dy * s + py * amp * wv;
      // Teğet (türev): düz yol + dalganın türevi.
      const dw = Math.cos(s * waves * Math.PI * 2 + ph) * waves * Math.PI * 2 * amp;
      let tx = dx + px * dw, ty = dy + py * dw;
      const tm = Math.hypot(tx, ty); tx /= tm; ty /= tm;
      const nx = -ty, ny = tx;                // ekran-içi normal
      // Bükülme: θ yol boyunca döner, faz canlılık verir.
      const th = s * twists * Math.PI * 2 + ph * 0.6 + 0.35;
      const c = Math.cos(th), sn = Math.sin(th);
      // Genişlik yönü B (3B) ve görünen yarı genişlik.
      const bx = nx * c, by = ny * c, bz = sn;
      const hw = (width / 2) * c;
      // Hafif perspektif: kameraya yaklaşan kenar biraz büyür.
      const persp = 1 + bz * 0.06;
      pts.push(vec(cx + nx * hw * persp, cy + ny * hw * persp));
      pts.push(vec(cx - nx * hw * persp, cy - ny * hw * persp));
      // Yüzey normali n = T × B (T = (tx, ty, 0)).
      let nX = ty * bz - 0 * by, nY = 0 * bx - tx * bz, nZ = tx * by - ty * bx;
      const nm = Math.hypot(nX, nY, nZ) || 1; nX /= nm; nY /= nm; nZ /= nm;
      const back = nZ < 0;
      if (back) { nX = -nX; nY = -nY; nZ = -nZ; }
      const diff = Math.max(0, nX * L[0] + nY * L[1] + nZ * L[2]);
      // Yan dönen (görünen genişliği ~0) kesit neredeyse görünmez: parlaması da görünürlüğüyle
      // orantılı. Kısılmasa bükülme noktalarında beyaz üçgenler beliriyordu (cihazda).
      const facing = Math.min(1, Math.abs(c) * 1.6);
      const spec = Math.pow(Math.max(0, nX * H[0] + nY * H[1] + nZ * H[2]), 36) * facing;
      // Saten: geniş, yumuşak ikinci bir parlama (kumaş lifleri ışığı dağıtır).
      const sheen = Math.pow(Math.max(0, nX * H[0] + nY * H[1] + nZ * H[2]), 6) * 0.18 * facing;
      const tone = back ? 0.62 : 1;
      const k = (0.34 + 0.66 * diff) * tone;
      const hi = (spec * 0.85 + sheen) * 255;
      const r = Math.min(255, Math.round(cr * k + hi));
      const g = Math.min(255, Math.round(cg * k + hi));
      const b = Math.min(255, Math.round(cb * k + hi));
      // Uçlar yumuşak: ilk/son kesitler hafif saydam (kesik kenar görünmesin).
      const edge = Math.min(1, i / 3, (segs - i) / 3);
      const a = (0.35 + 0.65 * edge).toFixed(3);
      cols.push(`rgba(${r},${g},${b},${a})`);
      cols.push(`rgba(${r},${g},${b},${a})`);
    }
    return { pts, cols };
  });

  const vertices = useDerivedValue(() => mesh.value.pts);
  const colors = useDerivedValue(() => mesh.value.cols);
  const shadowVerts = useDerivedValue(() => mesh.value.pts.map(p => vec(p.x + width * 0.08, p.y + width * 0.32)));
  const shadowCols = useDerivedValue(() => mesh.value.pts.map(() => 'black'));

  /*
    Gölge: KATMAN bulanıklığı + grup opaklığı. Vertices üstündeki maske bulanıklığı Android'de
    uygulanmadı ve tepe noktası rengindeki saydamlık yok sayıldı — gölge ikinci, kapkara bir
    kuşak gibi duruyordu (cihazda). Katman filtresi iki platformda da aynı.
  */
  return (
    <Group>
      {!lowPower && (
        <Group opacity={shadow} layer={<Paint><Blur blur={width * 0.28} /></Paint>}>
          <Vertices vertices={shadowVerts} colors={shadowCols} mode="triangleStrip" />
        </Group>
      )}
      <Vertices vertices={vertices} colors={colors} mode="triangleStrip" />
    </Group>
  );
}
