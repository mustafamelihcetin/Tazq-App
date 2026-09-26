import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useWalletStore } from '../store/useWalletStore';
import { F, S, W, R, B } from '@/shared/constants/tokens';
import { Plus, Wallet, Flame, ShieldCheck } from 'lucide-react-native';
import { AddExpenseModal } from './AddExpenseModal';
import { haptic } from '@/shared/utils/haptics';

const fmtMoney = (n: number) => n.toLocaleString('tr-TR');

export const TazqWalletCard = React.memo(() => {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const [modalVisible, setModalVisible] = useState(false);
  
  const getThisMonthExpenses = useWalletStore(s => s.getThisMonthExpenses);
  const subscriptions = useWalletStore(s => s.subscriptions);
  
  const thisMonth = getThisMonthExpenses();
  const totalExpense = thisMonth.reduce((acc, curr) => acc + curr.amount, 0);
  const keyfiExpense = thisMonth.filter(e => e.type === 'keyfi').reduce((acc, curr) => acc + curr.amount, 0);
  const gerekliExpense = thisMonth.filter(e => e.type === 'gerekli').reduce((acc, curr) => acc + curr.amount, 0);

  const totalSubs = subscriptions.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.outlineVariant, borderWidth: 1 }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Wallet size={20} color={theme.primary} />
            <Text style={[styles.title, { color: theme.onSurface }]}>
              {tr ? 'TAZQ Cüzdan' : 'TAZQ Wallet'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: theme.surfaceContainerHighest }]} 
            onPress={() => { haptic.selection(); setModalVisible(true); }}
          >
            <Plus size={16} color={theme.onSurface} />
            <Text style={[styles.addBtnText, { color: theme.onSurface }]}>{tr ? 'Ekle' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>{tr ? 'Bu Ayki Harcama' : 'This Month'}</Text>
            <Text style={[styles.statValue, { color: theme.onSurface }]}>₺{fmtMoney(totalExpense)}</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>{tr ? 'Abonelikler (Ay)' : 'Subscriptions'}</Text>
            <Text style={[styles.statValue, { color: theme.onSurface }]}>₺{fmtMoney(totalSubs)}</Text>
          </View>
        </View>

        {(keyfiExpense > 0 || gerekliExpense > 0) && (
          <View style={styles.breakdownRow}>
            {gerekliExpense > 0 && (
              <View style={[styles.pill, { backgroundColor: theme.primary + '20' }]}>
                <ShieldCheck size={14} color={theme.primary} />
                <Text style={[styles.pillText, { color: theme.primary }]}>₺{fmtMoney(gerekliExpense)}</Text>
              </View>
            )}
            
            {keyfiExpense > 0 && (
              <View style={[styles.pill, { backgroundColor: theme.error + '20' }]}>
                <Flame size={14} color={theme.error} />
                <Text style={[styles.pillText, { color: theme.error }]}>₺{fmtMoney(keyfiExpense)}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <AddExpenseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        theme={theme}
        isDark={isDark}
        tr={tr}
      />
    </>
  );
});

TazqWalletCard.displayName = 'TazqWalletCard';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  title: {
    fontSize: F.body,
    fontWeight: W.bold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: S.sm,
    paddingVertical: 4,
    borderRadius: R.full,
  },
  addBtnText: {
    fontSize: F.caption,
    fontWeight: W.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: S.md,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: F.caption,
    fontWeight: W.medium,
    marginBottom: 2,
  },
  statValue: {
    fontSize: F.title,
    fontWeight: W.bold,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: S.sm,
    marginTop: S.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: S.sm,
    paddingVertical: 4,
    borderRadius: R.sm,
  },
  pillText: {
    fontSize: F.caption,
    fontWeight: W.bold,
  }
});
