export const AVATAR_MAP: Record<string, any> = {
  m1: require('../assets/avatars/m1.png'),
  m2: require('../assets/avatars/m2.png'),
  m3: require('../assets/avatars/m3.png'),
  m4: require('../assets/avatars/m4.png'),
  f1: require('../assets/avatars/f1.png'),
  f2: require('../assets/avatars/f2.png'),
  f3: require('../assets/avatars/f3.png'),
  f4: require('../assets/avatars/f4.png'),
};

export const AVATAR_CONFIGS = [
  { id: 1, key: 'm1', name: 'Atlas', image: AVATAR_MAP.m1 },
  { id: 2, key: 'm2', name: 'Kai', image: AVATAR_MAP.m2 },
  { id: 3, key: 'm3', name: 'Ren', image: AVATAR_MAP.m3 },
  { id: 4, key: 'm4', name: 'Leo', image: AVATAR_MAP.m4 },
  { id: 5, key: 'f1', name: 'Nova', image: AVATAR_MAP.f1 },
  { id: 6, key: 'f2', name: 'Zara', image: AVATAR_MAP.f2 },
  { id: 7, key: 'f3', name: 'Mila', image: AVATAR_MAP.f3 },
  { id: 8, key: 'f4', name: 'Sera', image: AVATAR_MAP.f4 },
];

export const getAvatarSource = (avatar: string | null): any => {
  if (!avatar) return AVATAR_MAP.m1;
  if (avatar.startsWith('http')) return { uri: avatar };
  return AVATAR_MAP[avatar] ?? AVATAR_MAP.m1;
};
