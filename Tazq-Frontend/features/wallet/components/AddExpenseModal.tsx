import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { F, S, W, R, B } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { useWalletStore } from '../store/useWalletStore';
import { useUserStore } from '@/features/user/store/useUserStore';
import { X, Flame, ShieldCheck } from 'lucide-react-native';
import { haptic } from '@/shared/utils/haptics';
import { syncSubscriptionsToTasks } from '../utils/syncSubscriptions';

export interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
}

export const AddExpenseModal = React.memo<AddExpenseModalProps>(({ 
  visible, onClose, theme, isDark, tr 
}) => {
  const [tab, setTab] = useState<'expense' | 'subscription'>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [billingDay, setBillingDay] = useState('');

  const { addExpense, addSubscription } = useWalletStore();
  const updateMomentum = useUserStore(s => s.updateMomentumScore);

  if (!visible) return null;

  const handleSaveExpense = (type: 'gerekli' | 'keyfi') => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || !title.trim()) {
      haptic.error();
      return;
    }
    
    addExpense({
      title: title.trim(),
      amount: val,
      type,
      date: new Date().toISOString().split('T')[0]
    });

    // Momentum impact
    if (type === 'keyfi') {
      // Very slight negative or neutral feeling for impulsive buys
      updateMomentum(-5);
    } else {
      updateMomentum(2); // Responsible tracking
    }
    
    haptic.success();
    handleClose();
  };

  const handleSaveSubscription = () => {
    const val = parseFloat(amount);
    const day = parseInt(billingDay);
    if (!val || val <= 0 || !title.trim() || !day || day < 1 || day > 31) {
      haptic.error();
      return;
    }

    addSubscription({
      name: title.trim(),
      amount: val,
      billingDay: day
    });

    syncSubscriptionsToTasks(tr);
    updateMomentum(5); // Responsible tracking
    
    haptic.success();
    handleClose();
  };

  const handleClose = () => {
    setAmount('');
    setTitle('');
    setBillingDay('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView intensity={isDark ? 50 : 30} style={StyleSheet.absoluteFill} tint={isDark ? "dark" : "light"}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentContainer}
        >
          <MotiView 
            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250 }}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.outlineVariant, borderWidth: 1 }]}>
              
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.onSurface }]}>
                  {tr ? 'TAZQ Cüzdan' : 'TAZQ Wallet'}
                </Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <X size={24} color={theme.onSurfaceMuted} />
                </TouchableOpacity>
              </View>

              <View style={[styles.tabs, { backgroundColor: theme.surfaceContainerLowest }]}>
                <TouchableOpacity 
                  style={[styles.tab, tab === 'expense' && { backgroundColor: theme.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }]} 
                  onPress={() => { setTab('expense'); haptic.selection(); }}
                >
                  <Text style={[styles.tabText, { color: tab === 'expense' ? theme.onSurface : theme.onSurfaceMuted }]}>
                    {tr ? 'Harcama' : 'Expense'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, tab === 'subscription' && { backgroundColor: theme.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }]} 
                  onPress={() => { setTab('subscription'); haptic.selection(); }}
                >
                  <Text style={[styles.tabText, { color: tab === 'subscription' ? theme.onSurface : theme.onSurfaceMuted }]}>
                    {tr ? 'Abonelik' : 'Subscription'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { color: theme.onSurface, borderColor: theme.outlineVariant, backgroundColor: theme.surfaceContainerLowest }]}
                placeholder={tab === 'expense' ? (tr ? "Neye harcadın? (Örn: Kahve)" : "What did you buy? (e.g. Coffee)") : (tr ? "Abonelik Adı (Örn: Netflix)" : "Subscription Name")}
                placeholderTextColor={theme.onSurfaceMuted}
                value={title}
                onChangeText={setTitle}
              />

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, color: theme.onSurface, borderColor: theme.outlineVariant, backgroundColor: theme.surfaceContainerLowest }]}
                  placeholder={tr ? "Tutar (₺)" : "Amount (₺)"}
                  placeholderTextColor={theme.onSurfaceMuted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                
                {tab === 'subscription' && (
                  <TextInput
                    style={[styles.input, { flex: 1, marginLeft: S.sm, color: theme.onSurface, borderColor: theme.outlineVariant, backgroundColor: theme.surfaceContainerLowest }]}
                    placeholder={tr ? "Fatura Günü (1-31)" : "Billing Day (1-31)"}
                    placeholderTextColor={theme.onSurfaceMuted}
                    value={billingDay}
                    onChangeText={setBillingDay}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                )}
              </View>

              {tab === 'expense' ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLowest, borderColor: theme.outlineVariant, borderWidth: 1 }]}
                    onPress={() => handleSaveExpense('keyfi')}
                  >
                    <Flame size={20} color={theme.error} style={{ marginBottom: 4 }} />
                    <Text style={[styles.actionText, { color: theme.onSurface }]}>{tr ? 'Keyfi' : 'Impulse'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={() => handleSaveExpense('gerekli')}
                  >
                    <ShieldCheck size={20} color={theme.onPrimary} style={{ marginBottom: 4 }} />
                    <Text style={[styles.actionText, { color: theme.onPrimary }]}>{tr ? 'Gerekli' : 'Essential'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.saveSubBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveSubscription}
                >
                  <Text style={[styles.saveSubText, { color: theme.onPrimary }]}>{tr ? 'Aboneliği Kaydet' : 'Save Subscription'}</Text>
                </TouchableOpacity>
              )}

            </View>
          </MotiView>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
});

AddExpenseModal.displayName = 'AddExpenseModal';

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.lg,
    zIndex: 10,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: S.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  title: {
    fontSize: F.title,
    fontWeight: W.bold,
  },
  closeBtn: {
    padding: S.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: R.md,
    padding: 4,
    marginBottom: S.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: S.sm,
    alignItems: 'center',
    borderRadius: R.sm,
  },
  tabText: {
    fontWeight: W.bold,
    fontSize: F.body,
  },
  input: {
    borderWidth: 1,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    fontSize: F.body,
    fontWeight: W.medium,
    marginBottom: S.md,
  },
  row: {
    flexDirection: 'row',
    marginBottom: S.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: S.md,
    marginTop: S.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.md,
    borderRadius: R.md,
  },
  actionText: {
    fontWeight: W.bold,
    fontSize: F.subhead,
  },
  saveSubBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.md + 4,
    borderRadius: R.md,
    marginTop: S.sm,
  },
  saveSubText: {
    fontWeight: W.bold,
    fontSize: F.body,
  }
});
