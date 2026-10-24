import fs from 'fs';
import path from 'path';
import { RSPRING, SPRING, SPRING_SNAPPY, SPRING_SOFT } from '@/shared/constants/tokens';

/**
 * Hareket disiplininin bekçisi — colorContrast.test.ts'in harekette karşılığı.
 *
 * Neden: worklet'lerde beş farklı elle yazılmış yay vardı (damping 9/15/18/20).
 * Aynı uygulamanın satırları farklı ağırlıkta kayıyordu. Yay artık yalnız
 * RSPRING'den gelir; `withSpring(x, { damping: ... })` yazılırsa bu test kırılır.
 */

const ROOTS = ['app', 'features', 'shared'];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('hareket token\'ları', () => {
  it('RSPRING Moti token\'larıyla aynı fiziği taşır', () => {
    for (const [r, m] of [[RSPRING.default, SPRING], [RSPRING.snappy, SPRING_SNAPPY], [RSPRING.soft, SPRING_SOFT]] as const) {
      expect(r).toEqual({ mass: m.mass, stiffness: m.stiffness, damping: m.damping });
    }
  });

  it('satır içi yay sabiti yazılmaz', () => {
    const root = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    for (const r of ROOTS) {
      for (const f of walk(path.join(root, r))) {
        const src = fs.readFileSync(f, 'utf8');
        if (/withSpring\([^)]*\{[^}]*\b(damping|stiffness)\s*:/.test(src)) offenders.push(path.relative(root, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
