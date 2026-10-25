import fs from 'fs';
import path from 'path';

/**
 * Kayıt ekranı (2026-10-25, kullanıcı kararı): ana düğme ve bağlantılar MOR (secondary)
 * idi, uygulamanın geri kalanı marka mavisi. Giriş ve kayıt aynı dilde: primary.
 */
it('kayıt ekranında mor (secondary) yok — marka mavisi', () => {
  const src = fs.readFileSync(path.join(__dirname, '../app/register.tsx'), 'utf8');
  expect(src).not.toMatch(/theme\.(on)?[sS]econdary\b/);
});
