import fs from 'fs';
import path from 'path';

/*
  PENCERELER YAN DÖNÜNCE DE ÇALIŞIR (2026-11-01, kullanıcı: "tablette yan yatırınca modal aşağı kayıp kapanmıyor,
  hiçbir modalda olmamalı"). iPad uygulamayı döndürüyor ama RN Modal varsayılan olarak yalnız dikey destekliyor;
  dönünce pencere kayıyor ve kapanmıyordu. Her <Modal> iki yönü de bildirmeli.
*/
const roots = ['app', 'features', 'shared'];
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
});

it('her Modal yatay yönü de destekler', () => {
  const bad: string[] = [];
  for (const f of roots.flatMap(r => walk(path.join(__dirname, '..', r)))) {
    const s = fs.readFileSync(f, 'utf8');
    const opens = s.match(/<Modal(\s|$)/g)?.length ?? 0;
    const ok = s.match(/<Modal supportedOrientations=\{\['portrait', 'landscape'\]\}/g)?.length ?? 0;
    if (opens !== ok) bad.push(path.relative(path.join(__dirname, '..'), f));
  }
  expect(bad).toEqual([]);
});
