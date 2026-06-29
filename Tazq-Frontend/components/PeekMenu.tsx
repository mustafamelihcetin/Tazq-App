/**
 * PeekMenu — Apple bağlam menüsü (long-press peek). Uzun basınca arka plan
 * bulanıklaşır (iOS BlurView / Android koyu overlay) ve yay-fizikli bir kapsül
 * menü öne fırlar. Aksiyonlar sistem menüsü estetiğinde (ayraçlı, destructive kırmızı).
 */
import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../hooks/useAppTheme';
import { S, R, F, SPRING } from '../constants/tokens';
import { Touchable } from '@/components/Touchable';

export interface PeekItem {
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

export function PeekMenu({ visible, onClose, items, title }: { visible: boolean; onClose: () => void; items: PeekItem[]; title?: string }) {
  const { theme, isDark } = useAppTheme();
  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)' }]} />}

        <MotiView
          from={{ opacity: 0, scale: 0.9, translateY: 8 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={SPRING as any}
          style={[styles.menu, { backgroundColor: isDark ? 'rgba(40,40,46,0.96)' : 'rgba(255,255,255,0.98)', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}
        >
          {title ? (
            <Text numberOfLines={1} style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700', paddingHorizontal: S.md, paddingTop: S.sm + 2, paddingBottom: 2 }}>{title}</Text>
          ) : null}
          {items.map((it, i) => (
            <View key={i}>
              {(i > 0 || title) ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }} /> : null}
              <Touchable
                onPress={() => { onClose(); setTimeout(it.onPress, 60); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: 13 }}
                accessibilityRole="button"
                accessibilityLabel={it.label}
              >
                <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: it.destructive ? '#FF3B30' : theme.onSurface }}>{it.label}</Text>
                {it.icon}
              </Touchable>
            </View>
          ))}
        </MotiView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xl },
  menu: { width: 250, maxWidth: '90%', borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
});
