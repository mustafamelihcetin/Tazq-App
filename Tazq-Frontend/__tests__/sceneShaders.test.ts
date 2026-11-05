import path from 'path';
import { SCENE_SOURCES, liteShader } from '@/features/focus/utils/sceneShaders';

/*
  SkSL hatası uygulamada sessizce boş ekran verir (compile null döner). Bu test gerçek Skia ile derler ve çizer.
*/
const BIN = path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const init = require('canvaskit-wasm/bin/canvaskit.js');

const UNIFORMS = [12, 64, 64, 0.4, 0.9, 0.6, 0.1, 0.8, 0.7, 0.7, 0.4, 0.9, 0.05, 0.08, 0.2, 0.01, 0.02, 0.06, 0, 0.6, 3, 0, 0];

describe('sahne gölgelendiricileri gerçek Skia ile derlenir', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CK: any;
  beforeAll(async () => {
    // jest-expo'nun TextDecoder'ı utf-16 bilmiyor; CanvasKit açılışta ister.
    (globalThis as { TextDecoder: unknown }).TextDecoder = require('util').TextDecoder;
    CK = await init({ locateFile: (f: string) => path.join(BIN, f) });
  });

  const cases = Object.entries(SCENE_SOURCES).flatMap(([id, src]) => [[`${id}`, src], [`${id} (hafif)`, liteShader(src)]] as [string, string][]);

  it.each(cases)('%s derlenir, doğru uniform alır ve boş olmayan kare çizer', (_name, src) => {
    const errors: string[] = [];
    const fx = CK.RuntimeEffect.Make(src, (e: string) => errors.push(e));
    expect(errors).toEqual([]);
    expect(fx).toBeTruthy();
    expect(fx.getUniformFloatCount()).toBe(UNIFORMS.length);
    const surface = CK.MakeSurface(64, 64);
    const paint = new CK.Paint();
    paint.setShader(fx.makeShader(UNIFORMS));
    surface.getCanvas().drawPaint(paint);
    surface.flush();
    const px = surface.getCanvas().readPixels(0, 0, { width: 64, height: 64, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
    expect(px.some((v: number, i: number) => i % 4 !== 3 && v > 0)).toBe(true);
    surface.delete();
  });

  const lum = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };

  it.each(Object.keys(SCENE_SOURCES))('%s: Zen sayacının durduğu bantta beyaz yazı okunur (en az 4.5:1)', (id) => {
    const lights = { aurora: [0.2, 0.96, 0.63, 0.09, 0.78, 0.72, 0.7, 0.36, 0.96], tide: [0.13, 0.83, 0.93, 0.08, 0.72, 0.65, 0.49, 0.83, 0.99], ember: [1, 0.7, 0.36, 0.85, 0.47, 0.23, 1, 0.91, 0.76], mist: [0.53, 0.71, 0.6, 0.25, 0.44, 0.38, 0.94, 0.87, 0.66] }[id]!;
    const base = { aurora: [0.04, 0.07, 0.19, 0.01, 0.02, 0.06], tide: [0.02, 0.16, 0.23, 0.01, 0.07, 0.11], ember: [0.18, 0.11, 0.07, 0.08, 0.05, 0.03], mist: [0.05, 0.12, 0.1, 0.03, 0.07, 0.05] }[id]!;
    const W = 90, H = 195;
    const fx = CK.RuntimeEffect.Make(SCENE_SOURCES[id as keyof typeof SCENE_SOURCES]);
    for (const growth of [0, 0.5, 1]) {
      const surface = CK.MakeSurface(W, H);
      const paint = new CK.Paint();
      paint.setShader(fx.makeShader([12, W, H, ...lights, ...base, 0, growth, 0, 0, 0]));
      surface.getCanvas().drawPaint(paint);
      surface.flush();
      const y0 = Math.round(H * 0.38), rows = Math.round(H * 0.24);
      const px = surface.getCanvas().readPixels(0, y0, { width: W, height: rows, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
      const ls: number[] = [];
      for (let i = 0; i < px.length; i += 4) ls.push(0.2126 * lum(px[i] * 0.95) + 0.7152 * lum(px[i + 1] * 0.95) + 0.0722 * lum(px[i + 2] * 0.95));
      ls.sort((a, b) => a - b);
      expect(1.05 / (ls[Math.floor(ls.length * 0.95)] + 0.05)).toBeGreaterThanOrEqual(4.5);
      surface.delete();
    }
  });

  it('hafif sürüm oktavları gerçekten azaltır', () => {
    for (const src of Object.values(SCENE_SOURCES)) expect(liteShader(src)).not.toMatch(/(k|n|i) < 4/);
  });
});
