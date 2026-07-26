import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { LEGAL_DOCS, type LegalDocKey } from '@/shared/constants/legal';
import { ICON, S, F, HAIRLINE , topBarSpace} from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDocKey }>();
  const { theme } = useAppTheme();
  const { language } = useLanguageStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tr = language === 'tr';

  const legal = doc && LEGAL_DOCS[doc];
  if (!legal) return null;

  const title = tr ? legal.titleTr : legal.titleEn;
  const body = tr ? legal.bodyTr : legal.bodyEn;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ortak başlık — kendi kopyası F.body (14pt) başlık kullanıyordu, yani ekran
          başlığı gövde metniyle aynı boydaydı. Artık 17pt, diğerleriyle aynı. */}
      <ScreenHeader onBack={() => router.back()} title={title} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topBarSpace(insets.top) + S.md, paddingBottom: insets.bottom + S.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.body, { color: theme.onSurface }]}>
          {body}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: S.lg,
    paddingTop: S.lg,
  },
  body: {
    fontSize: F.footnote,
    lineHeight: 22,
    fontFamily: 'Jakarta-SemiBold',
  },
});
