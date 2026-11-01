import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { B, F, ICON, R, S } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { TazqLogo } from '@/shared/components/TazqLogo';

/*
  GİRİŞ / KAYIT ORTAK PARÇALARI (2026-11-01, kullanıcı: "login ekranını son tarzımıza ve yapımıza uygun
  güncelle; hesapsız giriş özendirilmemeli").

  Kararlar:
   · Marka: TazqLogo — açılış ekranıyla aynı malzemeli yazı (açıkta grafit, koyuda gümüş).
   · Sosyal giriş ÖNCE ve TAM GENİŞLİK: telefonda en hızlı yol; Apple da kendi düğmesinin diğerleri
     kadar görünür olmasını şart koşar (HIG). Apple düğmesi siyah/beyaz (temaya ters), Google yüzey + çerçeve.
   · Alan: tek dolgu yüzeyi, odakta marka rengi çerçeve; simge yalnız ipucu.
   · Google/Apple işaretleri tek yerde (eskiden giriş ve kayıtta kopyaydı).
*/

export const AUTH_COPY = {
  tr: {
    google: 'Google ile devam et',
    apple: 'Apple ile devam et',
    orEmail: 'veya e-postayla',
    email: 'E-posta adresi',
    password: 'Şifre',
  },
  en: {
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    orEmail: 'or with email',
    email: 'Email address',
    password: 'Password',
  },
};

export const GoogleMark = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.11c-.22-.67-.35-1.39-.35-2.11s.13-1.44.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.83z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </Svg>
);

export const AppleMark = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.88 3.5-.84 1.58.11 2.81.7 3.56 1.81-3.33 1.94-2.76 6.5.42 7.79-.81 1.6-1.57 3.12-2.56 3.43zM12.03 7.25C11.83 4.2 14.16 1.5 17 1c.29 3.22-2.51 5.92-4.97 6.25z" fill={color} />
  </Svg>
);

/** Marka + başlık + alt satır. Kelime işareti uygulamanın her yerindekiyle aynı (TazqLogo). */
export function AuthBrand({ title, sub, theme, markHeight = 64 }: { title: string; sub?: string; theme: AppTheme; markHeight?: number }) {
  return (
    <View style={styles.brand}>
      <TazqLogo height={markHeight} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
      {sub ? <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{sub}</Text> : null}
    </View>
  );
}

export function SocialButton({ provider, label, onPress, disabled, theme, isDark }: {
  provider: 'google' | 'apple'; label: string; onPress: () => void; disabled?: boolean; theme: AppTheme; isDark: boolean;
}) {
  const apple = provider === 'apple';
  // Apple: temaya TERS düz düğme (HIG). Google: yüzey + ince çerçeve.
  const bg = apple ? (isDark ? '#FFFFFF' : '#000000') : theme.surfaceCard;
  const fg = apple ? (isDark ? '#000000' : '#FFFFFF') : theme.onSurface;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.social, { backgroundColor: bg, borderColor: apple ? bg : theme.outlineVariant, opacity: disabled ? 0.6 : 1 }]}
    >
      {apple ? <AppleMark color={fg} /> : <GoogleMark />}
      <Text style={[styles.socialText, { color: fg }]}>{label}</Text>
    </Touchable>
  );
}

export function AuthDivider({ text, theme }: { text: string; theme: AppTheme }) {
  return (
    <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.divider, { backgroundColor: theme.separator }]} />
      <Text style={[styles.dividerText, { color: theme.onSurfaceMuted }]}>{text}</Text>
      <View style={[styles.divider, { backgroundColor: theme.separator }]} />
    </View>
  );
}

type FieldProps = TextInputProps & { icon: LucideIcon; theme: AppTheme; right?: React.ReactNode };

/** Tek dolgu yüzeyi; odakta marka rengi çerçeve. Etiket ekran okuyucuya `accessibilityLabel` ile. */
export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField({ icon: Icon, theme, right, style, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, { backgroundColor: theme.surfaceField, borderColor: focused ? theme.primary : 'transparent' }]}>
      <Icon size={ICON.sm} color={focused ? theme.primary : theme.onSurfaceMuted} />
      <TextInput
        ref={ref}
        placeholderTextColor={theme.onSurfaceMuted}
        underlineColorAndroid="transparent"
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[styles.input, { color: theme.onSurface }, style]}
        {...input}
      />
      {right}
    </View>
  );
});

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: S.sm },
  title: { fontFamily: 'Jakarta-ExtraBold', fontSize: F.title, letterSpacing: -0.6, marginTop: S.sm, textAlign: 'center' },
  sub: { fontSize: F.body, fontWeight: '500', textAlign: 'center', lineHeight: 21 },
  social: { height: 50, borderRadius: R.md, borderWidth: B.thin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  socialText: { fontSize: F.body, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: F.footnote, fontWeight: '500' },
  field: { flexDirection: 'row', alignItems: 'center', gap: S.smd, height: 52, borderRadius: R.md, borderWidth: B.medium, paddingHorizontal: S.md },
  input: { flex: 1, fontSize: F.body, fontWeight: '500', height: '100%' },
});
