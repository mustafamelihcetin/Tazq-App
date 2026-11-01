import React from 'react';
import { View, type ImageStyle } from 'react-native';
import type { AppTheme } from '@/shared/constants/Colors';
import { AuraAvatar } from '@/features/user/components/AuraAvatar';
import { useWeekGlow } from '@/features/user/hooks/useWeekGlow';
import { useAuthStore } from '@/features/user';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

/**
 * KULLANICI AVATARI — seçilmemişse CİNSİYETSİZ siluet.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Avatarı olmayan HERKESE ilk erkek avatarı ("Atlas") veriliyordu: misafire de,
 * avatar seçmemiş her kullanıcıya da. Kimseye sorulmadan bir kimlik giydirmekti.
 * Apple'ın deseni: seçilmemiş fotoğraf yerine nötr bir siluet (Kişiler, Apple
 * Hesabı). Avatar seçilince fotoğraf görünür; seçim profil düzenlemede.
 */
/*
 * 2026-11-01: HERKES kişiye özel AURA (bkz. AuraAvatar). Siluet "isimsiz profil" gibi soğuktu; 3B karakterler
 * kimliğe uymuyordu. Kayıtlı eski avatar değeri ARTIK ÇİZİLMEZ — çoğu kullanıcıda o değer seçim değil, eski
 * kurulumun varsayılanıydı ("m1") ve ikisi ayırt edilemiyor. `avatar` prop'u çağıranlar bozulmasın diye duruyor.
 */
export function UserAvatar({ size, theme, style, animated = false }: {
  avatar?: string | null;
  size: number;
  /** Eski siluet ikonu içindi; aura kendi ölçeğini kullanır. Çağıranlar bozulmasın diye duruyor. */
  iconSize?: number;
  theme: AppTheme;
  style?: ImageStyle;
  /** Aura yavaşça döner (yalnız profil gibi büyük yerlerde). */
  animated?: boolean;
}) {
  const name = useAuthStore(s => s.user?.name) ?? useSessionStore.getState().guestProfile?.name ?? null;
  const glow = useWeekGlow();
  const mark = usePrefsStore(s => s.auraMark);
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden', borderRadius: size / 2 }, style]}>
      <AuraAvatar name={name} accent={theme.primary} size={size} glow={glow} animated={animated} mark={mark} />
    </View>
  );
}
