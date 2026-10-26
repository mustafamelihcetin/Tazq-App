import { FOCUS_SCENES, sceneOf, sceneLights, sceneAccent, sceneTheme } from '@/features/focus/utils/focusScenes';

/** Odak sahneleri: en az 3, her biri farklı palet; Aurora eski görünümü (tema renkleri) korur. */
const theme = { primary: '#0A84FF', tertiary: '#10B981', secondary: '#8B5CF6' };

describe('focusScenes', () => {
  it('en az 3 sahne, kimlikler tekil, iki dilde ad ve açıklama', () => {
    expect(FOCUS_SCENES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(FOCUS_SCENES.map((s) => s.id)).size).toBe(FOCUS_SCENES.length);
    for (const s of FOCUS_SCENES) expect([s.tr, s.en, s.descTr, s.descEn].every((x) => x.length > 0)).toBe(true);
  });

  it('Aurora tema renklerini kullanır (eski görünüm birebir)', () => {
    expect(sceneLights(sceneOf('aurora'), theme)).toEqual([theme.primary, theme.tertiary, theme.secondary]);
    expect(sceneAccent(sceneOf('aurora'), theme.primary)).toBe(theme.primary);
  });

  it('diğer sahnelerin paleti birbirinden ve Aurora\'dan farklı', () => {
    const palettes = FOCUS_SCENES.map((s) => sceneLights(s, theme).join(','));
    expect(new Set(palettes).size).toBe(FOCUS_SCENES.length);
  });

  it('bilinmeyen kimlik Aurora\'ya düşer', () => {
    expect(sceneOf('yok').id).toBe('aurora');
    expect(sceneOf(undefined).id).toBe('aurora');
  });

  it('sahne vurgusu ekranın ana rengi olur; Aurora paleti değiştirmez', () => {
    const base = { primary: '#0A84FF', onPrimary: '#FFFFFF', background: '#000000' };
    expect(sceneTheme(sceneOf('aurora'), base)).toBe(base);
    expect(sceneTheme(sceneOf('ember'), base)).toEqual({ ...base, primary: '#F59E0B', onPrimary: '#0B0B0F', background: '#170A12' });
  });
});

import { sceneSheetTheme, mixHex } from '@/features/focus/utils/focusScenes';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

describe('sceneSheetTheme — seans sonu ve odak pencereleri sahneyi izler', () => {
  const light = { primary: '#0B6BCB', onPrimary: '#FFFFFF', primaryContainer: '#DBEAFE', onPrimaryContainer: '#0A3D62', surface: '#FFFFFF' };
  const dark = { ...light, primary: '#0A84FF', surface: '#09090B' };

  it('Aurora uygulama temasını değiştirmez', () => {
    expect(sceneSheetTheme(sceneOf('aurora'), light, false)).toBe(light);
  });

  it.each(['tide', 'ember', 'mist'])('%s: açık zeminde vurgu metin olarak okunur, düğme yazısı okunur', (id) => {
    const t = sceneSheetTheme(sceneOf(id), light, false);
    expect(contrast(t.primary, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(t.primaryContainer).toMatch(/^#[0-9A-F]{6}$/);
  });

  it.each(['tide', 'ember', 'mist'])('%s: koyu zeminde parlak vurgu, düğmede koyu yazı', (id) => {
    const t = sceneSheetTheme(sceneOf(id), dark, true);
    expect(t.primary).toBe(sceneOf(id).accent);
    expect(contrast(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('mixHex uçlar', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });
});

import { lightsFor, LIGHT_NAMES } from '@/features/focus/utils/focusScenes';

describe('ışık toplama', () => {
  it('her 5 dakika bir ışık; eksik dakika ışık vermez', () => {
    expect(lightsFor(0)).toBe(0);
    expect(lightsFor(4)).toBe(0);
    expect(lightsFor(5)).toBe(1);
    expect(lightsFor(25)).toBe(5);
    expect(lightsFor(-3)).toBe(0);
  });
  it('her sahnenin ışığının iki dilde adı var', () => {
    for (const s of FOCUS_SCENES) expect(LIGHT_NAMES[s.id].tr && LIGHT_NAMES[s.id].en).toBeTruthy();
  });
});
