import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { useToastStore } from '@/shared/store/useToastStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { S, ICON, R } from '@/shared/constants/tokens';

const COLORS = {
  error: { bg: '#ff3b30', icon: AlertCircle },
  success: { bg: '#34c759', icon: CheckCircle2 },
  info: { bg: '#007AFF', icon: Info },
};

export const Toast = () => {
  const { visible, message, type, hide, actionLabel, onAction } = useToastStore();
  const { language } = useLanguageStore();
  const insets = useSafeAreaInsets();
  const config = COLORS[type];
  const Icon = config.icon;

  const handleAction = () => {
    onAction?.();
    hide();
  };

  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{ translateY: 120, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={[styles.container, { backgroundColor: config.bg, bottom: insets.bottom + 100 }]}
        >
          <Icon size={18} color="#fff" />
          <Text style={styles.text} numberOfLines={2}>{message}</Text>
          {actionLabel && onAction && (
            <Touchable onPress={handleAction} style={styles.actionBtn}>
              <Text style={styles.actionText}>{actionLabel}</Text>
            </Touchable>
          )}
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={language === 'tr' ? 'Bildirimi kapat' : 'Dismiss notification'}
            onPress={hide}
            style={styles.close}
          >
            <X size={ICON.sm} color="rgba(255,255,255,0.8)" />
          </Touchable>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.smd,
    borderRadius: R.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.md,
    zIndex: 9997,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: S.smd,
    paddingVertical: S.xs,
    borderRadius: R.sm,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  close: {
    padding: S.xs,
  },
});
