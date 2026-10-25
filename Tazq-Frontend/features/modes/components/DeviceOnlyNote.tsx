import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';
import { S, F, ICON, HAIRLINE, touchSlop } from '@/shared/constants/tokens';
import { langOf } from '@/shared/utils/lang';
import { DEVICE_ONLY_COPY } from './deviceOnlyCopy';

/*
  CİHAZDA KALAN VERİ NOTU (2026-10-25, kullanıcı: "cihazda kalsın ama bunu daha şık
  belirtelim, kullanıcı bilsin").

  Kilo ve bırakma kayıtları KVKK'da özel nitelikli sağlık verisi, bütçe finansal veri;
  bilerek sunucuya gönderilmiyor (gizlilik politikası §2.6). Kullanıcı bunu yalnız çıkış
  onayında öğreniyordu — yani veri kaybolmak üzereyken. Artık veriyi GİRDİĞİ kartın dibinde
  sakin bir satır: kilit + "Yalnız bu cihazda". Dokununca gerekçe ve yedek yolu.
  Bir uyarı değil, bir güvence: renk nötr, kırmızı/sarı yok.
*/

export function DeviceOnlyNote({ kind }: { kind: 'health' | 'budget' }) {
  const { theme } = useAppTheme();
  const { language } = useLanguageStore();
  const router = useRouter();
  const c = DEVICE_ONLY_COPY[langOf(language)];

  const explain = () => {
    haptic.select();
    Alert.alert(c.title, kind === 'health' ? c.healthBody : c.budgetBody, [
      { text: c.backup, onPress: () => router.push('/settings') },
      { text: c.ok, style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.wrap, { borderTopColor: theme.outlineVariant }]}>
      <Touchable
        onPress={explain}
        accessibilityRole="button"
        accessibilityLabel={c.a11y}
        hitSlop={touchSlop(32)}
        style={styles.row}
      >
        <Lock size={ICON.xs} color={theme.onSurfaceMuted} strokeWidth={2.2} />
        <Text style={[styles.text, { color: theme.onSurfaceMuted }]}>
          {c.line}
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600' }}>{'  ·  '}{c.why}</Text>
        </Text>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: HAIRLINE, marginHorizontal: S.md, paddingVertical: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, minHeight: 32 },
  text: { fontSize: F.caption },
});
