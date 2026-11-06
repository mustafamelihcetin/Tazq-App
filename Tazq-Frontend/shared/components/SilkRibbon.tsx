import React from 'react';
import { Blur, Group, Paint, Path, Vertices, usePathValue, vec } from '@shopify/react-native-skia';
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
  Köşe başına renk (Vertices, üçgen dizini): ışık kesitten kesite pürüzsüz akar.

  KUMAŞ (2026-11-06, kullanıcı: "dokusu belli, yapay, daha kumaş gibi; performansı zorlamadan"). Eskiden her kesit enine tek renkti, dönüşte kuşak iğne ucuna iniyordu, parlama
  beyazdı: plastik şerit. Şimdi enine yedi köşe (kıvrım + boyuna lif), dönüşte daralıp öbür yüzünü gösteren kumaş, kıvrım gölgesi ve kumaşın renginde geniş parlama.
  Doku ya da ek geçiş yok. Zayıf telefonda üç köşe ve az kesit. CanvasKit'te eski/yeni yan yana denendi.

  GİDERKEN TAKILMASIN (2026-11-06): uç ve kuyruk hareket ederken bütün kumaş her karede baştan hesaplanıyordu (yüzlerce köşe + renk metni), üstelik kuyruk ilerledikçe kesitler kayıyordu.
  Artık kumaş yolun TAMAMI için sabit örneklenir ve yalnız dalga fazı değişince hesaplanır; faz çıkıştan önce durur. Uç ve kuyruk yalnız kırpma çizgisini değiştirir: kare başına küçük bir yol.
  Gölge: aynı şekil, kaydırılmış + bulanık, düşük opaklıkta.

  Animasyon değerleri:
    head 0→1 — şeridin ucu yol boyunca ilerler (giriş: kuşak açılarak gelir);
    tail 0→1 — kuyruk yol boyunca ilerler (çıkış: kuşak kendi yolunda akıp gider);
    phase    — dalga ve bükülme fazı (canlılık).
  Tüm hesap UI iş parçacığında (worklet); JS köprüsüne her karede veri gitmez.
*/

/*
  KENAR VE KESİT (2026-11-06, kullanıcı iPad'de "pikselleşme" gördü, saydam köşeyle geçmedi: köşe saydamlığı her yerde uygulanmıyor). Skia Vertices kenar yumuşatması yapmaz.
  Kumaş artık kenar yumuşatmalı bir YOLLA kırpılır: kenar, her çözünürlükte ve her platformda tek geçişle temizdir. Kesit sayısı yol uzunluğundan gelir.
*/
const SEGMENT_PT = 9;
const SEGMENTS_MIN = 48;
const SEGMENTS_MAX = 110;
const SEGMENTS_LOW = 32;
/** Kesit boyunca köşeler: enine kıvrım ve boyuna lif. Zayıf cihazda üç köşe. */
const ROWS_FULL = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
const ROWS_LOW = [-1, 0, 1];
/** Dönüşte en dar görünür pay: kumaş iğne ucuna inmez, kıvrılıp öbür yüzünü gösterir. */
const TURN_MIN = 0.2;
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

function ribbonIndices(segs: number, row: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a = i * row, b = a + row;
    for (let k = 0; k < row - 1; k++) out.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
  }
  return out;
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
  const { x0, y0, x1, y1, amp, waves, twists, width } = path;
  const pathLen = Math.hypot(x1 - x0, y1 - y0);
  const segs = lowPower ? SEGMENTS_LOW : Math.min(SEGMENTS_MAX, Math.max(SEGMENTS_MIN, Math.ceil(pathLen / SEGMENT_PT)));
  const rows = lowPower ? ROWS_LOW : ROWS_FULL;
  const indices = React.useMemo(() => ribbonIndices(segs, rows.length), [segs, rows.length]);
  const [cr, cg, cb] = rgb;

  const mesh = useDerivedValue(() => {
    const pts: { x: number; y: number }[] = [];
    const cols: string[] = [];
    const edgeA: { x: number; y: number }[] = [];
    const edgeB: { x: number; y: number }[] = [];
    const R_ = rows.length;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;      // ana yön
    const px = -uy, py = ux;                  // ana yönün dikliği (dalga ekseni)
    const ph = phase.value;
    const turnNorm = Math.sqrt(1 + TURN_MIN * TURN_MIN);
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      // Orta çizgi: düz yol + dikine dalga.
      const wv = Math.sin(s * waves * Math.PI * 2 + ph);
      const cx = x0 + dx * s + px * amp * wv;
      const cy = y0 + dy * s + py * amp * wv;
      const dw = Math.cos(s * waves * Math.PI * 2 + ph) * waves * Math.PI * 2 * amp;
      let tx = dx + px * dw, ty = dy + py * dw;
      const tm = Math.hypot(tx, ty); tx /= tm; ty /= tm;
      const nx = -ty, ny = tx;                // ekran-içi normal
      // Bükülme: θ yol boyunca döner, faz canlılık verir.
      const th = s * twists * Math.PI * 2 + ph * 0.6 + 0.35;
      const c = Math.cos(th), sn = Math.sin(th);
      const vis = Math.sqrt(c * c + TURN_MIN * TURN_MIN) / turnNorm;
      const half = (width / 2) * vis * (1 + sn * 0.05);
      // İki kenar ayrı, çok hafif dalgalı: cetvelle kesilmiş gibi durmaz.
      const wobA = 1 + Math.sin(s * 23 + ph) * 0.018 + Math.sin(s * 51 + ph * 1.7) * 0.01;
      const wobB = 1 + Math.sin(s * 19 - ph) * 0.018 + Math.sin(s * 47 + ph * 0.7) * 0.01;
      const front = c >= 0;
      // Yüzey normali n = T × B.
      let nX = ty * sn, nY = -tx * sn, nZ = tx * (ny * c) - ty * (nx * c);
      const nm = Math.hypot(nX, nY, nZ) || 1; nX /= nm; nY /= nm; nZ /= nm;
      if (nZ < 0) { nX = -nX; nY = -nY; nZ = -nZ; }
      // Yan dönen kesitte parlama kısılır, kıvrımın içi gölgede kalır.
      const facing = Math.min(1, Math.abs(c) * 1.6);
      const crease = 0.72 + 0.28 * Math.min(1, Math.abs(c) / 0.28);
      const fold = Math.sin(s * 7.3 + ph * 0.5) * 0.16 + Math.sin(s * 13.1 - ph * 0.3) * 0.08;
      const tone = front ? 1 : 0.72;
      for (let k = 0; k < R_; k++) {
        const u = rows[k];
        const off = (u < 0 ? u * wobA : u * wobB) * half;
        pts.push(vec(cx + nx * off, cy + ny * off));
        // Lifler boyuna akar: enine ince, yavaş kayan bantlar. Kumaşı plastikten ayıran bu.
        const streak = Math.sin(u * 5.2 + s * 6 + ph * 0.4) * 0.05 + Math.sin(u * 11 + s * 3) * 0.022;
        const curl = u * 0.5 * (front ? 1 : -1);
        let qx = nX + nx * curl * c + tx * fold + nx * streak, qy = nY + ny * curl * c + ty * fold + ny * streak, qz = nZ + sn * curl;
        const qm = Math.hypot(qx, qy, qz) || 1; qx /= qm; qy /= qm; qz /= qm;
        const diff = Math.max(0, qx * L[0] + qy * L[1] + qz * L[2]);
        const nh = Math.max(0, qx * H[0] + qy * H[1] + qz * H[2]);
        // Geniş, kumaşın kendi renginde parlama: beyaz keskin nokta plastik gösterir.
        const sheen = Math.pow(nh, 14) * 0.5 * facing + Math.pow(nh, 4) * 0.12;
        const hem = 1 - Math.pow(Math.abs(u), 6) * 0.14;
        const k2 = (0.5 + 0.5 * diff) * tone * hem * crease;
        const r = Math.min(255, Math.round(cr * k2 + (cr * 0.5 + 128) * sheen));
        const g = Math.min(255, Math.round(cg * k2 + (cg * 0.5 + 128) * sheen));
        const b = Math.min(255, Math.round(cb * k2 + (cb * 0.5 + 128) * sheen));
        cols.push(`rgb(${r},${g},${b})`);
      }
      edgeA.push({ x: cx - nx * half * wobA, y: cy - ny * half * wobA });
      edgeB.push({ x: cx + nx * half * wobB, y: cy + ny * half * wobB });
    }
    return { pts, cols, edgeA, edgeB };
  });

  // Kumaşın dış çizgisi: kenar yumuşatması bu kırpmadan gelir.
  const outline = usePathValue(path => {
    'worklet';
    const { edgeA, edgeB } = mesh.value;
    const h = Math.max(0, Math.min(1, head.value)) * segs;
    const t = Math.max(0, Math.min(1, tail.value)) * segs;
    if (h - t < 0.02 || edgeA.length < 2) return;
    const at = (e: { x: number; y: number }[], f: number) => {
      const i = Math.min(segs - 1, Math.floor(f));
      const k = f - i;
      return { x: e[i].x + (e[i + 1].x - e[i].x) * k, y: e[i].y + (e[i + 1].y - e[i].y) * k };
    };
    // Uç ve kuyruk yuvarlanır: orta çizgiye doğru daralır, küt kesik görünmez. Kesit arası da süzülür: 9 pt'lik adımlarla zıplamaz.
    const point = (e: { x: number; y: number }[], o: { x: number; y: number }[], f: number) => {
      const p = at(e, f);
      const q = at(o, f);
      const tip = Math.min(1, Math.sqrt(Math.min(f - t, h - f) / 3));
      const w = (1 + tip) / 2;
      return { x: q.x + (p.x - q.x) * w, y: q.y + (p.y - q.y) * w };
    };
    const first = Math.ceil(t), last = Math.floor(h);
    const start = point(edgeA, edgeB, t);
    path.moveTo(start.x, start.y);
    for (let i = first; i <= last; i++) { const p = point(edgeA, edgeB, i); path.lineTo(p.x, p.y); }
    const e1 = point(edgeA, edgeB, h); path.lineTo(e1.x, e1.y);
    const e2 = point(edgeB, edgeA, h); path.lineTo(e2.x, e2.y);
    for (let i = last; i >= first; i--) { const p = point(edgeB, edgeA, i); path.lineTo(p.x, p.y); }
    const e3 = point(edgeB, edgeA, t); path.lineTo(e3.x, e3.y);
    path.close();
  });

  const vertices = useDerivedValue(() => mesh.value.pts);
  const colors = useDerivedValue(() => mesh.value.cols);
  const shadowAt = React.useMemo(() => [{ translateX: width * 0.08 }, { translateY: width * 0.32 }], [width]);

  /*
    Gölge: KATMAN bulanıklığı + grup opaklığı. Vertices üstündeki maske bulanıklığı Android'de
    uygulanmadı ve tepe noktası rengindeki saydamlık yok sayıldı — gölge ikinci, kapkara bir
    kuşak gibi duruyordu (cihazda). Katman filtresi iki platformda da aynı.
  */
  return (
    <Group>
      {!lowPower && (
        <Group opacity={shadow} layer={<Paint><Blur blur={width * 0.28} /></Paint>}>
          <Group transform={shadowAt}><Path path={outline} color="black" /></Group>
        </Group>
      )}
      <Group clip={outline}>
        <Vertices vertices={vertices} colors={colors} indices={indices} mode="triangles" />
      </Group>
    </Group>
  );
}
