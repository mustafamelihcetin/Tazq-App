/*
  ── VURGULAMA GEOMETRİSİ — saf fonksiyonlar (test edilir) ─────────────────────────
  react-native-copilot'un `svg` örtüsü ile aynı yöntem: tam ekran bir dikdörtgen +
  içinde yuvarlak bir delik, `fillRule="evenodd"`. Dört ayrı dikdörtgenle (copilot'un
  `view` örtüsü) yapılan delik Android'de animasyonda takılıyor — kütüphanenin kendi notu.
  joyride'ın `spotlightPadding` (10) karşılığı: hedefin çevresinde nefes payı.
*/

export type Rect = { x: number; y: number; width: number; height: number };
type Screen = { width: number; height: number };
/** Görünür bant: üstte durum çubuğu/başlık, altta sekme çubuğu. */
type Band = { top: number; bottom: number };

/** Hedef + pay; ekrana ve görünür banda kırpılmış delik. */
export function spotRect(target: Rect, pad: number, screen: Screen, band: Band): Rect {
  const x = Math.max(0, target.x - pad);
  const y = Math.max(band.top, target.y - pad);
  const right = Math.min(screen.width, target.x + target.width + pad);
  const bottom = Math.min(screen.height - band.bottom, target.y + target.height + pad);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

export type HoleCorners = 'all' | 'top' | 'bottom';

/**
 * Tam ekran + yuvarlak delik — `fillRule="evenodd"` ile delik boş kalır.
 * `corners`: bölüm bir kartın üst/alt yarısıysa yalnız o taraftaki köşeler yuvarlanır;
 * kart orada bitmediği için diğer köşeler keskin kalır (yoksa kartın içine kesik açılır).
 */
export function holePath(r: Rect, radius: number, screen: Screen, corners: HoleCorners = 'all'): string {
  'worklet'; // delik her karede UI thread'de yeniden çizilir (bkz. SpotlightTour)
  const rad = Math.max(0, Math.min(radius, r.width / 2, r.height / 2));
  const rt = corners === 'bottom' ? 0 : rad;
  const rb = corners === 'top' ? 0 : rad;
  const { x, y, width: w, height: h } = r;
  const outer = `M0 0H${screen.width}V${screen.height}H0Z`;
  let hole = `M${x + rt} ${y}H${x + w - rt}`;
  if (rt) hole += `A${rt} ${rt} 0 0 1 ${x + w} ${y + rt}`;
  hole += `V${y + h - rb}`;
  if (rb) hole += `A${rb} ${rb} 0 0 1 ${x + w - rb} ${y + h}`;
  hole += `H${x + rb}`;
  if (rb) hole += `A${rb} ${rb} 0 0 1 ${x} ${y + h - rb}`;
  hole += `V${y + rt}`;
  if (rt) hole += `A${rt} ${rt} 0 0 1 ${x + rt} ${y}`;
  return outer + hole + 'Z';
}

/**
 * Balonun yeri: altta yer varsa ALTA (okuma yönü: önce öğe, sonra açıklama), yoksa
 * ÜSTE; ikisine de sığmıyorsa (çok uzun hedef) görünür bandın dibine yaslanır.
 */
export function placeTip(
  hole: Rect,
  tipH: number,
  screen: Screen,
  band: Band,
  gap: number,
): { y: number; side: 'below' | 'above' | 'inside' } {
  const below = hole.y + hole.height + gap;
  if (below + tipH <= screen.height - band.bottom) return { y: below, side: 'below' };
  const above = hole.y - gap - tipH;
  if (above >= band.top) return { y: above, side: 'above' };
  return { y: Math.max(band.top, screen.height - band.bottom - tipH - gap), side: 'inside' };
}

/**
 * Balonun yatay yeri ve okun x'i: balon ekrana sığacak şekilde hedefin ortasına
 * hizalanır (telefonda ekran − 2×kenar, tablette en fazla `maxW`); ok hedefin
 * ortasını gösterir ama balonun yuvarlak köşesine girmez.
 */
export function placeTipX(hole: Rect, screenW: number, margin: number, maxW: number, corner: number): { x: number; width: number; arrowX: number } {
  const width = Math.min(screenW - margin * 2, maxW);
  const cx = hole.x + hole.width / 2;
  const x = Math.min(Math.max(margin, cx - width / 2), screenW - margin - width);
  const arrowX = Math.min(Math.max(corner + 6, cx - x), width - corner - 6);
  return { x, width, arrowX };
}
