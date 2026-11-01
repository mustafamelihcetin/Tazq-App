import fs from 'fs';
import path from 'path';

/*
  TEK KARARTMA (2026-11-01, kullanıcı: "tüm popuplar tek tip, bizim tarzımız"). Pencere zeminleri 0.4–0.6 arası beş
  farklı opaklıkta ve kimi bulanıktı. Artık hepsi SCRIM jetonu. Bilinçli istisna: bağlam menüsü (PeekMenu) — iOS'ta
  basılı tutunca açılan menü bulanık zeminde açılır.
*/
const ROOT = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'node_modules' || e.name === '__tests__' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.tsx') ? [path.join(d, e.name)] : []);

describe('pencere karartması tek jeton', () => {
  it('modal dosyalarında tam ekran zemin elle karartılmaz', () => {
    const offenders: string[] = [];
    for (const f of ['app', 'features', 'shared'].flatMap(d => walk(path.join(ROOT, d)))) {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      if (rel.endsWith('PeekMenu.tsx')) continue;
      const src = fs.readFileSync(f, 'utf8');
      if (!src.includes('<Modal')) continue;
      src.split('\n').forEach((l, i) => {
        if (/backgroundColor: 'rgba\(0,\s*0,\s*0,\s*0\.\d+\)'/.test(l) && (/\b(overlay|backdrop|scrim)\w*\s*:/i.test(l) || l.includes('flex: 1'))) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
