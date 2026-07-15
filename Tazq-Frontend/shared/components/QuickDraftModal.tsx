import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Animated, TextInput, StyleSheet, ActivityIndicator, Platform, Keyboard } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B, scale, verticalScale, moderateScale } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

interface QuickDraftModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  t: any;
}

export const QuickDraftModal: React.FC<QuickDraftModalProps> = ({
  visible,
  onClose,
  onSave,
  theme,
  isDark,
  language,
  t,
}) => {
  const [draftTitle, setDraftTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { panResponder, animatedStyle, prepare, slideIn } = useSwipeToDismiss({
    onDismiss: onClose,
  });

  // Track keyboard state
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Prepare position and reset title when modal is opened
  useEffect(() => {
    if (visible) {
      prepare();
      setDraftTitle('');
      setIsSaving(false);
    }
  }, [visible, prepare]);

  const handleSave = async () => {
    if (!draftTitle.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draftTitle.trim());
      onClose();
    } catch {
      // Parent handle error
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={slideIn}
    >
      <View style={styles.overlay}>
        <Touchable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
        />
        <View style={[styles.bottomSheetWrapper, { marginBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }]}>
          <Animated.View
            style={[
              animatedStyle,
              styles.quickDraftSheet,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                paddingBottom: keyboardHeight > 0 ? S.md : S.xl,
                borderBottomLeftRadius: keyboardHeight > 0 ? R.lg : 0,
                borderBottomRightRadius: keyboardHeight > 0 ? R.lg : 0,
              },
            ]}
          >
            {/* Drag Handle */}
            <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: '#F59E0B20' }]}>
                <Zap size={20} color="#F59E0B" fill="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.quickDraftTitle, { color: theme.onSurface }]}
                >
                  {t.draftNote}
                </Text>
                <Text style={{ fontSize: F.caption, fontWeight: '600', color: '#F59E0B', opacity: 0.8, marginTop: 1 }}>
                  {language === 'tr' ? 'Aklındakini yaz, sonra düzenlersin' : 'Capture now, refine later'}
                </Text>
              </View>
            </View>

            {/* Input Group */}
            <View
              style={[
                styles.quickInputGroup,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)',
                  marginTop: S.md,
                },
              ]}
            >
              <TextInput
                style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                placeholder={language === 'tr' ? 'Aklına ne geldi?' : "What's on your mind?"}
                placeholderTextColor={theme.onSurfaceVariant + '99'}
                value={draftTitle}
                onChangeText={setDraftTitle}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                underlineColorAndroid="transparent"
                autoFocus
              />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#F59E0B', opacity: 0.55, marginTop: S.sm, letterSpacing: 0.2 }}>
              {language === 'tr' ? '📌 Görevler ekranına taslak olarak eklenir' : '📌 Saved as a draft in your task list'}
            </Text>

            {/* Actions */}
            <View style={styles.quickActions}>
              <Touchable
                onPress={handleSave}
                disabled={isSaving || !draftTitle.trim()}
                style={[
                  styles.quickSave,
                  { backgroundColor: draftTitle.trim() ? '#F59E0B' : theme.surfaceContainerHigh, flex: 1 },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '600' }}>
                    {t.save}
                  </Text>
                )}
              </Touchable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetWrapper: {
    width: '100%',
  },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    borderWidth: B.thin,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dragHandleContainer: {
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
  },
  sheetHandle: {
    width: scale(40),
    height: scale(4),
    borderRadius: R.sm,
    backgroundColor: 'rgba(128,128,128,0.2)',
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  sheetIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDraftTitle: {
    fontSize: F.title,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  quickInputGroup: {
    borderRadius: R.lg,
    paddingHorizontal: S.md,
    height: verticalScale(64),
    justifyContent: 'center',
  },
  quickInput: {
    fontWeight: '600',
    fontSize: F.subhead,
  },
  quickActions: {
    flexDirection: 'row',
    gap: S.sm,
    marginTop: S.lg,
  },
  quickSave: {
    height: verticalScale(56),
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
