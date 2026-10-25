/*
  AVATAR HALKASI PALETİ — tek kaynak (Hoş Geldin ekranı + Profil).

  2026-10-25 (kullanıcı: "renkler yeterince hoş, kaliteli ve özel mi?") — dürüst cevap hayırdı:
  19 renk Tailwind'in hazır -400 tonlarıydı; saf sarı (#FFFF00) kabaydı, kırmızı/fuşya/gül,
  turuncu/bronz/altın ve yeşil/nane/turkuaz birbirinin neredeyse aynısıydı, gümüş beyaz
  zeminde görünmüyordu, Profil'deki kopyada "Gül" iki kez vardı.

  Yeni palet: 11 renk + "Yok" = 12 seçenek (6×2 ızgara, kaydırma yok; 9 renk "az" bulundu), renk çemberini eşit aralıkla dolaşır, doygunluğu kısılmış (toprak/
  mücevher tonları), marka mavisiyle aynı ağırlıkta. Her biri açık ve koyu zeminde halka
  olarak seçilir (bkz. __tests__/avatarRings.test.ts). Kayıtlı eski renkler (sunucuda hex)
  aynen gösterilmeye devam eder — palet yalnız SEÇENEKLERİ değiştirir.
*/

export interface AvatarRing {
  key: string;
  color: string;
  tr: string;
  en: string;
}

export const RING_NONE = 'transparent';

export const AVATAR_RINGS: AvatarRing[] = [
  { key: 'none', color: RING_NONE, tr: 'Yok', en: 'None' },
  { key: 'ocean', color: '#0B6BCB', tr: 'Okyanus', en: 'Ocean' },
  { key: 'sky', color: '#4FA9D8', tr: 'Gök', en: 'Sky' },
  { key: 'lagoon', color: '#14A098', tr: 'Lagün', en: 'Lagoon' },
  { key: 'sage', color: '#5FA36F', tr: 'Adaçayı', en: 'Sage' },
  { key: 'olive', color: '#8C8A3E', tr: 'Zeytin', en: 'Olive' },
  { key: 'amber', color: '#D9A62E', tr: 'Kehribar', en: 'Amber' },
  { key: 'coral', color: '#E0565F', tr: 'Mercan', en: 'Coral' },
  { key: 'rosewood', color: '#C76B98', tr: 'Gül Kurusu', en: 'Rosewood' },
  { key: 'amethyst', color: '#7E63D6', tr: 'Ametist', en: 'Amethyst' },
  { key: 'champagne', color: '#C9AE7C', tr: 'Şampanya', en: 'Champagne' },
  { key: 'graphite', color: '#647084', tr: 'Grafit', en: 'Graphite' },
];

export const hasRing = (color: string | null | undefined): color is string =>
  !!color && color !== RING_NONE;
