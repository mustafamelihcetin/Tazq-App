import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { Separator } from '@/shared/components/Separator';
import { Colors } from '@/shared/constants/Colors';
import { HAIRLINE, S } from '@/shared/constants/tokens';

/**
 * Ayırıcı — iOS'un ince, kesin çizgisi.
 *
 * Uygulamada 31 ayırıcı vardı ve İKİ farklı sözdizimiyle yazılmışlardı. İlk geçişimde
 * `borderBottomWidth` arayıp 13'ünü düzelttim; `height: 1` ile çizilen 18'ini GÖRMEDİM.
 * Aynı işin iki yazımı olduğu sürece taramayla peşinden koşmak beyhude — bu yüzden
 * tek bileşene indirildi.
 */

const ROOT = path.resolve(__dirname, '..');
const theme = Colors.light;

const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

/** toJSON() null | tek | dizi dönebilir — testlerde tek düğüm bekliyoruz. */
const nodeOf = (r: { toJSON: () => any }): any => {
  const j = r.toJSON();
  expect(j).not.toBeNull();
  return Array.isArray(j) ? j[0] : j;
};

describe('Separator', () => {
  it('kalınlığı HAIRLINE — 1pt değil', () => {
    // 1pt iOS'ta @3x ekranda 3 fiziksel piksel: Apple'ın çizgisinin ÜÇ KATI.
    // Gözün "bu iOS değil" dediği kalın çizgi buradan geliyordu.
    const { toJSON } = render(<Separator theme={theme} />);
    expect(styleOf(nodeOf({ toJSON })).height).toBe(HAIRLINE);
    expect(styleOf(nodeOf({ toJSON })).height).toBeLessThan(1);
  });

  it('rengi palet ayırıcısı — outline değil', () => {
    // outline bir NESNENİN sınırıdır (kartın nerede bittiği); separator bir RİTİMDİR
    // (iki satırın nerede ayrıldığı). İnce çizgi belirgin renk ister.
    const { toJSON } = render(<Separator theme={theme} />);
    expect(styleOf(nodeOf({ toJSON })).backgroundColor).toBe(theme.separator);
    expect(styleOf(nodeOf({ toJSON })).backgroundColor).not.toBe(theme.outline);
  });

  it('koyu temada daha belirgin — koyu zeminde çizgi kaybolmasın', () => {
    // Apple da böyle yapar: light 0.29, dark 0.65 alfa.
    expect(Colors.dark.separator).not.toBe(Colors.light.separator);
    const { toJSON } = render(<Separator theme={Colors.dark} />);
    expect(styleOf(nodeOf({ toJSON })).backgroundColor).toBe(Colors.dark.separator);
  });

  it('girinti verilmezse tam genişlik', () => {
    const { toJSON } = render(<Separator theme={theme} />);
    expect(styleOf(nodeOf({ toJSON })).marginLeft).toBe(0);
  });

  it('girinti SOLDAN — iOS ayırıcısı metnin başladığı yerden başlar', () => {
    const { toJSON } = render(<Separator theme={theme} inset={S.md} />);
    expect(styleOf(nodeOf({ toJSON })).marginLeft).toBe(S.md);
  });

  it('ekran okuyucudan gizli — çizgi bilgi değil, ritim', () => {
    const { toJSON } = render(<Separator theme={theme} />);
    expect(nodeOf({ toJSON }).props.accessibilityElementsHidden).toBe(true);
  });
});

describe('ayırıcı disiplini', () => {
  const SKIP = ['node_modules', '.expo', 'android', 'ios', '.git', '__tests__', '__mocks__', 'dist'];

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith('.tsx')) out.push(p);
    }
    return out;
  }

  it('ayırıcı elle çizilmemeli — <Separator /> kullan', () => {
    /**
     * `height: 1` + backgroundColor ile çizilen çizgiler. İSTİSNA: konumlandırılmış
     * minik tik işaretleri (position:absolute + width:6) — onlar bir bölme değil,
     * çarkta seçili satırı gösteren işaret.
     */
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const key = path.relative(ROOT, file).split(path.sep).join('/');
      // Separator'ın kendi dosyası ve doküman yorumları doğal olarak bu deseni içerir.
      if (key === 'shared/components/Separator.tsx') continue;

      const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of src.matchAll(/<View style=\{\{([^}]*height: 1,[^}]*)\}\}/g)) {
        const body = m[1];
        if (!/backgroundColor/.test(body)) continue;
        if (/position:/.test(body)) continue; // tik işareti, ayırıcı değil
        hits.push(`${key}`);
      }
    }
    expect([...new Set(hits)]).toEqual([]);
  });
});
