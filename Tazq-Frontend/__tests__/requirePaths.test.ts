import fs from 'fs';
import path from 'path';

/**
 * Göreli require() yollarının gerçekten çözüldüğünü doğrular.
 *
 * Neden gerekli: TypeScript require()'ı denetlemez (dinamiktir), bu yüzden yanlış bir
 * yol tsc'den temiz geçer. Kod tabanında store'lar arası döngüsel importu kırmak için
 * lazy require kullanılıyor ve bunların 11 tanesi yanlış seviyedeydi ('../../../modes'
 * yerine '../../modes' olmalıydı). Hepsi try/catch içinde olduğu için çalışma anında
 * sessizce başarısız oluyordu: başarımlar buluta hiç gitmiyor, tercihler hiç okunmuyordu.
 *
 * Bu test o sınıfın geri gelmesini engeller.
 */

const SKIP_DIRS = ['node_modules', '.expo', 'android', 'ios', '.git', 'dist', '__tests__', '__mocks__'];
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.mp3', '.png', '/index.ts', '/index.tsx', '/index.js'];
const ROOT = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function findBrokenRequires(): string[] {
  const broken: string[] = [];
  for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /require\(\s*'(\.[^']+)'\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const spec = m[1];
      const abs = path.resolve(path.dirname(file), spec);
      if (!EXTS.some((ext) => fs.existsSync(abs + ext))) {
        const line = src.slice(0, m.index).split('\n').length;
        broken.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${line} -> ${spec}`);
      }
    }
  }
  return broken;
}

describe('goreli require() yollari', () => {
  it('hepsi cozulebilir olmali', () => {
    const broken = findBrokenRequires();
    expect(broken).toEqual([]);
  });
});
