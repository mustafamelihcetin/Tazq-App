/**
 * SEANS SONU KUTLAMASI — Lottie (bodymovin 5.7) JSON'u KODDAN üretilir.
 *
 * Neden dosya değil: (1) lisans sorusu yok, (2) renkler TEMADAN gelir — hazır bir
 * Lottie dosyası tek renkte donuk kalır, koyu temada yanlış durur, (3) ~3 KB.
 * Oynatıcı Skia Skottie (bkz. shared/components/LottieAnimation) — yeni native modül yok.
 * Doğrulama: lottie-web ile kare kare çizildi (geliştirme sırasında).
 *
 * Sahne (60 fps, 1 sn): dolu daire yayla belirir → tik çizilir → halka dalgası
 * genişleyip söner → sekiz kısa ışın dışa fırlar. Kutlama "bir kez" — döngü yok.
 */

type RGBA = [number, number, number, number];
const rgba = (hex: string): RGBA => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as RGBA;
};

const still = (k: unknown) => ({ a: 0, k });
const ease = { o: { x: [0.33], y: [0] }, i: { x: [0.2], y: [1] } };
/** [kare, değer][] → Lottie anahtar kareleri. */
const anim = (frames: Array<[number, number[]]>) => ({
  a: 1,
  k: frames.map(([t, s], idx) => (idx < frames.length - 1 ? { t, s, ...ease } : { t, s })),
});

const transform = (extra: Record<string, unknown> = {}) => ({
  o: still(100), r: still(0), p: still([100, 100, 0]), a: still([0, 0, 0]), s: still([100, 100, 100]), ...extra,
});
const groupTr = (rotate = 0) => ({ ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(rotate), o: still(100) });
const layer = (ind: number, nm: string, shapes: unknown[], ks = transform()) => ({
  ddd: 0, ind, ty: 4, nm, sr: 1, ks, ao: 0, shapes, ip: 0, op: 60, st: 0, bm: 0,
});

export function buildDoneBurst(fill: string, mark: string, burst: string) {
  const F = rgba(fill), M = rgba(mark), B = rgba(burst);

  const check = layer(1, 'check', [
    {
      ty: 'gr', nm: 'tick', it: [
        { ty: 'sh', ks: still({ i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-22, 1], [-7, 16], [23, -14]], c: false }) },
        { ty: 'st', c: still(M), o: still(100), w: still(9), lc: 2, lj: 2 },
        groupTr(),
      ],
    },
    { ty: 'tm', s: still(0), e: anim([[12, [0]], [30, [100]]]), o: still(0), m: 1 },
  ]);

  const disc = layer(2, 'disc', [
    { ty: 'gr', nm: 'c', it: [{ ty: 'el', p: still([0, 0]), s: still([84, 84]) }, { ty: 'fl', c: still(F), o: still(100), r: 1 }, groupTr()] },
  ], transform({ s: anim([[0, [0, 0, 100]], [12, [112, 112, 100]], [20, [100, 100, 100]]]) }));

  const ring = layer(3, 'ring', [
    { ty: 'gr', nm: 'r', it: [{ ty: 'el', p: still([0, 0]), s: still([84, 84]) }, { ty: 'st', c: still(F), o: still(100), w: still(4), lc: 2, lj: 2 }, groupTr()] },
  // Halka daire BELİRDİKTEN sonra doğar — 0. karede tek başına görünüyordu.
  ], transform({ s: anim([[10, [100, 100, 100]], [40, [190, 190, 100]]]), o: anim([[0, [0]], [9, [0]], [10, [70]], [40, [0]]]) }));

  // Sekiz ışın: her biri merkezden dışa bir çizgi; trim'in başı ve sonu kaydırılarak "fırlar".
  const rays = Array.from({ length: 8 }, (_, i) => ({
    ty: 'gr', nm: `ray${i}`, it: [
      { ty: 'sh', ks: still({ i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], v: [[0, -52], [0, -78]], c: false }) },
      { ty: 'st', c: still(B), o: still(100), w: still(4), lc: 2, lj: 2 },
      groupTr(i * 45 + 22.5),
    ],
  }));
  const burstLayer = layer(4, 'burst', [
    ...rays,
    { ty: 'tm', s: anim([[18, [0]], [36, [100]]]), e: anim([[12, [0]], [28, [100]]]), o: still(0), m: 1 },
  ]);

  return {
    v: '5.7.4', fr: 60, ip: 0, op: 60, w: 200, h: 200, nm: 'tazq-done', ddd: 0, assets: [],
    // İlk katman EN ÜSTTE çizilir: tik, dairenin üstünde.
    layers: [check, disc, ring, burstLayer],
  };
}
