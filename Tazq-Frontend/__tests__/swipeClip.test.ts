import fs from 'fs';
import path from 'path';

/**
 * iPad, iki sütunlu görev listesi (2026-10-25, kullanıcı): sağ sütundaki satır sola
 * kaydırılınca sol sütundaki görevlerin ÜSTÜNE biniyordu. Satır kendi hücresinin içinde
 * kaymalı (iOS Mail): kap kırpar, silme düğmesi satırın ALTINDAN açılır.
 */
it('kaydırılan satır kendi hücresinin dışına taşmaz', () => {
  const src = fs.readFileSync(path.join(__dirname, '../shared/components/SwipeableItem.tsx'), 'utf8');
  expect(src).toMatch(/container: \{[^}]*overflow: 'hidden'/);
});
