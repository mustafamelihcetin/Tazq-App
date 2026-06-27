import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { LEGAL_DOCS, type LegalDocKey } from '../constants/legal';
import { S, F } from '../constants/tokens';
import { Touchable } from '@/components/Touchable';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.outlineVariant + '30' }]}>
        <Touchable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Geri' : 'Back'}>
          <ArrowLeft size={22} color={theme.onSurface} />
        </Touchable>
        <Text style={[styles.headerTitle, { color: theme.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + S.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.body, { color: theme.onSurface }]}>
          {body}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: F.body,
    fontFamily: 'Jakarta-Bold',
    marginHorizontal: S.md,
  },
  content: {
    paddingHorizontal: S.lg,
    paddingTop: S.lg,
  },
  body: {
    fontSize: 13,
    lineHeight: 22,
    fontFamily: 'Jakarta-SemiBold',
    opacity: 0.85,
  },
});
