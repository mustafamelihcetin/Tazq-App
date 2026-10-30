import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSheet } from '@/shared/components/GlassSheet';
import { STAFF_ROLES, roleLabel, roleDescription, type StaffRole } from '@/shared/utils/staffRoles';

/*
  ROL SEÇİCİ (2026-10-31, kullanıcı: "rollerin yanında kısaca ne olduğu yazsın ki karıştırmayayım").
  Eskiden düz uyarı kutusuydu: beş düğme, yalnız ad — "Moderatör mü Destek mi istatistik görüyordu?"
  Şimdi her rolün altında ne gördüğü tek satırda; mevcut rol işaretli. Seçim anında uygulanır.
*/

const COPY = {
  tr: { title: 'Rol', current: 'şu an', close: 'Kapat' },
  en: { title: 'Role', current: 'current', close: 'Close' },
};

export function RolePicker({ visible, name, current, lang, onPick, onClose }: {
  visible: boolean; name: string; current: string; lang: 'tr' | 'en';
  onPick: (role: StaffRole) => void; onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const c = COPY[lang];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + S.md }]}>
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} />
        <GlassSheet maxWidth={560} padding={S.md}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Text style={{ flex: 1, fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }} numberOfLines={1}>{c.title} · {name}</Text>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }}>
              <X size={ICON.md} color={theme.onSurfaceMuted} />
            </Touchable>
          </View>
          <View accessibilityRole="radiogroup">
            {STAFF_ROLES.map((role, i) => {
              const selected = role === current;
              return (
                <Touchable key={role} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={`${roleLabel(role, lang)}. ${roleDescription(role, lang)}`}
                  onPress={() => (selected ? onClose() : onPick(role))}
                  style={[styles.row, i > 0 && { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
                  <View style={{ flex: 1, gap: S.xxs }}>
                    <Text style={{ fontSize: F.body, fontWeight: selected ? W.semibold : W.medium, color: selected ? theme.primary : theme.onSurface }}>
                      {roleLabel(role, lang)}{selected ? ` · ${c.current}` : ''}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{roleDescription(role, lang)}</Text>
                  </View>
                  {selected && <Check size={ICON.sm} color={theme.primary} strokeWidth={3} />}
                </Touchable>
              );
            })}
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.smd, minHeight: 56 },
});
