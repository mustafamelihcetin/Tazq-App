/**
 * Avatar gorselleri — 384px JPEG.
 *
 * Eskiden 1024x1024 PNG'ydi ve 12 dosya toplam 9.5 MB tutuyordu. Ekrandaki EN BUYUK
 * gosterim profil sayfasinda 110pt; 3x yogunluklu bir ekranda 330px eder. Yani
 * kullanicinin hicbir zaman gormedigi 7 kat fazla piksel tasiniyordu.
 *
 * JPEG cunku bu gorsellerde alfa kanali yok ve dairesel kirpma zaten kapsayicida
 * yapiliyor; PNG fotografik icerikte kotu sikisir. Sonuc: 9.5 MB -> 0.25 MB.
 */
export const AVATAR_MAP: Record<string, any> = {
  m1: require('../../../assets/avatars/m1.jpg'),
  m2: require('../../../assets/avatars/m2.jpg'),
  m3: require('../../../assets/avatars/m3.jpg'),
  m4: require('../../../assets/avatars/m4.jpg'),
  m5: require('../../../assets/avatars/m5.jpg'),
  m6: require('../../../assets/avatars/m6.jpg'),
  f1: require('../../../assets/avatars/f1.jpg'),
  f2: require('../../../assets/avatars/f2.jpg'),
  f3: require('../../../assets/avatars/f3.jpg'),
  f4: require('../../../assets/avatars/f4.jpg'),
  f5: require('../../../assets/avatars/f5.jpg'),
  f6: require('../../../assets/avatars/f6.jpg'),
};

export const AVATAR_CONFIGS = [
  { id: 1, key: 'm1', name: 'Atlas', image: AVATAR_MAP.m1 },
  { id: 2, key: 'm2', name: 'Kai', image: AVATAR_MAP.m2 },
  { id: 3, key: 'm3', name: 'Ren', image: AVATAR_MAP.m3 },
  { id: 4, key: 'm4', name: 'Leo', image: AVATAR_MAP.m4 },
  { id: 5, key: 'm5', name: 'Finn', image: AVATAR_MAP.m5 },
  { id: 6, key: 'm6', name: 'Axel', image: AVATAR_MAP.m6 },
  { id: 7, key: 'f1', name: 'Nova', image: AVATAR_MAP.f1 },
  { id: 8, key: 'f2', name: 'Zara', image: AVATAR_MAP.f2 },
  { id: 9, key: 'f3', name: 'Mila', image: AVATAR_MAP.f3 },
  { id: 10, key: 'f4', name: 'Sera', image: AVATAR_MAP.f4 },
  { id: 11, key: 'f5', name: 'Luna', image: AVATAR_MAP.f5 },
  { id: 12, key: 'f6', name: 'Iris', image: AVATAR_MAP.f6 },
];

export const getAvatarSource = (avatar: string | null): any => {
  if (!avatar) return AVATAR_MAP.m1;
  if (avatar.startsWith('http')) return { uri: avatar };
  return AVATAR_MAP[avatar] ?? AVATAR_MAP.m1;
};
