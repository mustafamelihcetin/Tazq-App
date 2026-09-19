import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { F, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { Plus, Wind, Target, Settings } from 'lucide-react-native';

export interface TazqCoreMenuProps {
  visible: boolean;
  onClose: () => void;
  onQuickAdd: () => void;
  onZenMode: () => void;
  onNextTask: () => void;
  onSettings: () => void;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
}

export const TazqCoreMenu = React.memo<TazqCoreMenuProps>(({ 
  visible, onClose, onQuickAdd, onZenMode, onNextTask, onSettings, theme, isDark, tr 
}) => {
  if (!visible) return null;

  const MenuAction = ({ icon: Icon, title, onPress, color, isLast = false }: any) => (
    <TouchableOpacity 
      style={[
        styles.actionRow, 
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }
      ]} 
      onPress={() => {
        onClose();
        setTimeout(onPress, 50);
      }}
    >
      <Text style={[styles.actionTitle, { color: theme.onSurface }]}>{title}</Text>
      <Icon size={20} color={color} strokeWidth={2.5} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none" // MotiView handles the animation
      onRequestClose={onClose}
    >
      {/* Hafif karartılmış şeffaf arka plan */}
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }]} onPress={onClose}>
        
        <View style={styles.contentContainer} pointerEvents="box-none">
          <MotiView 
            from={{ opacity: 0, scale: 0.95, translateY: -10 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ width: 250 }}
          >
            {/* Minimalist Dropdown Kartı */}
            <View style={[
              styles.card, 
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant, borderWidth: 1 }
            ]}>
              <MenuAction 
                icon={Plus} 
                title={tr ? "Hızlı Ekle" : "Quick Add"}
                color={theme.primary}
                onPress={onQuickAdd}
              />
              <MenuAction 
                icon={Wind} 
                title={tr ? "Günü Kurtar" : "Save the Day"}
                color={theme.tertiary}
                onPress={onZenMode}
              />
              <MenuAction 
                icon={Target} 
                title={tr ? "Sıradaki İş" : "Next Task"}
                color={theme.error}
                onPress={onNextTask}
              />
              <MenuAction 
                icon={Settings} 
                title={tr ? "Ayarlar" : "Settings"}
                color={theme.onSurfaceMuted}
                onPress={onSettings}
                isLast
              />
            </View>
          </MotiView>
        </View>

      </Pressable>
    </Modal>
  );
});

TazqCoreMenu.displayName = 'TazqCoreMenu';

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingTop: 100, // Header'ın (logonun) hemen altından açılması için
    alignItems: 'center', // Ortada açılır
    zIndex: 10,
  },
  card: {
    width: '100%',
    borderRadius: 14, // Apple style dropdown border radius
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionTitle: {
    fontSize: 16, // F.body
    fontWeight: W.medium, // W.medium for Apple style context menu
  }
});
