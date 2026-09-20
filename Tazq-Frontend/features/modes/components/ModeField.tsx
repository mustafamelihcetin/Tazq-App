import React, { useState, useCallback } from 'react';
import { View, TextInput, StyleProp, ViewStyle, TextStyle, TextInputProps } from 'react-native';
import { MotiView } from 'moti';
import { S, R, F, B } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * MOD KURULUM FORMUNUN İKİ ORTAK PARÇASI.
 *
 * ── Neden ortak ────────────────────────────────────────────────────────────
 * Kurulum alanının kabuğu (44pt yükseklik, R.md köşe, B.thin kenarlık, temaya
 * göre zemin) yedi ayrı kartta HARFİ HARFİNE kopyalanmıştı. Kopya olduğu için
 * de şimdiden ayrışmıştı: mülakatın ikinci yuvası 40pt, sporunkiler satır
 * düzenli, tasarrufunki kendi kenarlığını yazıyor. Tek kabuk = tek davranış.
 *
 * ── Odak durumu ────────────────────────────────────────────────────────────
 * Alanlar odaklandığında hiçbir şey değişmiyordu; tek ipucu imlecin yanıp
 * sönmesiydi. Birden çok alanı olan formlarda (spor: boy + yaş) "şu an nereye
 * yazıyorum" sorusu klavye açıkken gerçekten sorulur. Odakta kenarlık modun
 * vurgusuna geçer, zemin çok hafif o renge boyanır — 160 ms, göz yormayan.
 *
 * ── FormReveal ─────────────────────────────────────────────────────────────
 * Kurulum formu `{expanded && ...}` ile BİR ANDA beliriyordu: kart büyürken
 * içerik zıplıyordu. Ekranın geri kalanı (kartların sıralı girişi, geri sayım
 * sayısı) yumuşakken form sert açılıyordu. Kapanış animasyonu bilerek yok:
 * AnimatePresence kapanışı geciktirir, kullanıcı "Kapat"a bastığında kartın
 * hemen toparlanması daha doğru okunuyor.
 */

export const FormReveal: React.FC<{ style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ style, children }) => (
  <MotiView
    from={{ opacity: 0, translateY: -6 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: 220 }}
    style={style}
  >
    {children}
  </MotiView>
);

export interface ModeFieldProps extends TextInputProps {
  /** Modun vurgu rengi — yalnız odak halkasında kullanılır. */
  accent: string;
  /** Kabuk yüksekliği (varsayılan 44 — dokunma hedefi alt sınırı). */
  height?: number;
  /** Alanın SOLUNDA duran sabit işaret (ör. ₺). */
  prefix?: React.ReactNode;
  /** Alanın SAĞINDA duran sabit birim (ör. cm, km/hft). */
  suffix?: React.ReactNode;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const ModeField: React.FC<ModeFieldProps> = ({
  accent, height = 44, prefix, suffix, inputStyle, containerStyle, onFocus, onBlur, ...rest
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const [focused, setFocused] = useState(false);

  // Olay tipleri RN sürümüne göre değişiyor (0.85'te FocusEvent/BlurEvent) — prop'un
  // kendi imzasından türetiliyor ki sürüm yükseldiğinde burası kırılmasın.
  const handleFocus = useCallback((e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setFocused(true);
    onFocus?.(e);
  }, [onFocus]);
  const handleBlur = useCallback((e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  const restColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const restBg = isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow;

  return (
    <MotiView
      animate={{
        borderColor: focused ? accent : restColor,
        backgroundColor: focused ? accent + (isDark ? '1A' : '0F') : restBg,
      }}
      transition={{ type: 'timing', duration: 160 }}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: S.xs, borderRadius: R.md, paddingHorizontal: S.md, height, borderWidth: B.thin },
        containerStyle,
      ]}
    >
      {prefix}
      <TextInput
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        underlineColorAndroid="transparent"
        placeholderTextColor={rest.placeholderTextColor ?? theme.onSurfaceVariant + '70'}
        style={[{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '600', padding: 0 }, inputStyle]}
      />
      {suffix}
    </MotiView>
  );
};

/** Sadece kabuk — içinde TextInput olmayan (tarih seçici gibi) alanlar için. */
export const ModeFieldShell: React.FC<{ height?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ height = 44, style, children }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs, borderRadius: R.md, paddingHorizontal: S.md, height, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }, style]}>
      {children}
    </View>
  );
};
