import fs from 'fs';
import path from 'path';

/*
  TEMBEL REQUIRE YOLLARI GERÇEK (2026-11-01). `try { require('@/…') } catch {}` içindeki yol yanlışsa Metro bunu
  "isteğe bağlı" sayar, derleme bozulmaz; çalışırken her seferinde patlar ve hata yutulur. Böyle bulundu:
  completeTask, taşınmış bir depoyu (useCompletionStore) eski yolundan istiyordu → Gün ekranı, odak özeti,
  toplu tamamlama ve bildirimden bitirilen plan görevleri plan ilerlemesine HİÇ yazılmıyordu.
*/
const ROOT = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (['node_modules', '__tests__', '.expo'].includes(e.name) ? [] : walk(path.join(d, e.name))) : /\.(tsx?|js)$/.test(e.name) ? [path.join(d, e.name)] : []);
const exists = (p: string) => ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx'].some(ext => fs.existsSync(p + ext)) || fs.existsSync(p);

describe("'@/' ile yapılan her require gerçek bir dosyaya çıkar", () => {
  it('çözülmeyen yol yok', () => {
    const bad: string[] = [];
    for (const f of ['app', 'features', 'shared'].flatMap(d => walk(path.join(ROOT, d)))) {
      // Yorumlar atlanır (örnek yollar orada yaşar).
      const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(/require\('@\/([^']+)'\)/g)) {
        if (!exists(path.join(ROOT, m[1]))) bad.push(`${path.relative(ROOT, f).split(path.sep).join('/')} → @/${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
