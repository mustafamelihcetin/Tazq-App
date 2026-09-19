import React from 'react';
import { View, Image, type ImageStyle } from 'react-native';
import { UserRound } from 'lucide-react-native';
import type { AppTheme } from '@/shared/constants/Colors';
import { getAvatarSource } from '@/features/user/utils/avatars';

/**
 * KULLANICI AVATARI — seçilmemişse CİNSİYETSİZ siluet.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Avatarı olmayan HERKESE ilk erkek avatarı ("Atlas") veriliyordu: misafire de,
 * avatar seçmemiş her kullanıcıya da. Kimseye sorulmadan bir kimlik giydirmekti.
 * Apple'ın deseni: seçilmemiş fotoğraf yerine nötr bir siluet (Kişiler, Apple
 * Hesabı). Avatar seçilince fotoğraf görünür; seçim profil düzenlemede.
 */
export function UserAvatar({ avatar, size, iconSize, theme, style }: {
  avatar?: string | null;
  size: number;
  /** ICON ölçeğinden (bkz. tokens) — ikon boyutu elle yazılmaz. */
  iconSize: number;
  theme: AppTheme;
  style?: ImageStyle;
}) {
  if (avatar) {
    return <Image source={getAvatarSource(avatar)} style={[{ width: size, height: size }, style]} resizeMode="cover" />;
  }
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceField }, style]}
    >
      <UserRound size={iconSize} color={theme.onSurfaceMuted} strokeWidth={1.75} />
    </View>
  );
}
