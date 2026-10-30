import fs from 'fs';
import path from 'path';

/**
 * Rol seçici sayfa düzeyinde olmalı (2026-10-31, cihazda: "role basıyorum hiçbir şey olmuyor").
 * İlk sürüm "kullanıcı sil" modalının İÇİNE bağlanmıştı; o modal kapalıyken seçici hiç çizilmiyordu.
 */
describe('admin rol seçici', () => {
  const src = fs.readFileSync(path.join(__dirname, '../app/admin.tsx'), 'utf8');
  it('hiçbir <Modal> içinde değil', () => {
    const at = src.indexOf('<RolePicker');
    expect(at).toBeGreaterThan(-1);
    const before = src.slice(0, at);
    const opened = (before.match(/<Modal\b/g) ?? []).length;
    const closed = (before.match(/<\/Modal>/g) ?? []).length;
    expect(opened).toBe(closed);
  });
});
