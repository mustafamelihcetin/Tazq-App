import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { F, S, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/*
  "BU CİHAZDA SAKLANIR" — küçük, dürüst not (2026-11-01, kullanıcı: "sunucuda tutulmayan şeyler çok küçük belirtilmeli
  kullanıcıya ilgili kısımlarda"). Hesaba eşitlenmeyen bir ayarın yanında durur: telefon değişince ya da uygulama
  silinince bu ayarların gideceğini kullanıcı baştan bilir. Sağlık verisinde aynı not bir güvencedir.
*/
const COPY = {
  tr: { settings: 'Bu ayarlar yalnız bu cihazda saklanır.', health: 'Sağlık verin yalnız bu cihazda işlenir; sunucuya gönderilmez.' },
  en: { settings: 'These settings are stored on this device only.', health: 'Your health data is processed on this device only and never sent to our servers.' },
};

export function DeviceOnlyNote({ kind = 'settings', language, theme, style }: {
  kind?: 'settings' | 'health'; language: 'tr' | 'en'; theme: AppTheme; style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.xs, marginTop: S.sm }, style]}>
      <Smartphone size={ICON.xs} color={theme.onSurfaceMuted} />
      <Text style={{ flex: 1, fontSize: F.caption, color: theme.onSurfaceMuted, lineHeight: 16 }}>{COPY[language][kind]}</Text>
    </View>
  );
}
