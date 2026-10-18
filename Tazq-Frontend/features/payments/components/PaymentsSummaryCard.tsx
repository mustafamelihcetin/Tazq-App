import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, ChevronRight } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { AppIcon } from '@/shared/components/AppIcon';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { currentCycleDate, cycleKeyOf, isPaidForCycle } from '@/features/payments/utils/paymentDates';

/**
 * Ana ekrandaki ödeme kartı — GÖREVLERLE AYNI yüzeyde GÖRÜNMEZ, kendi kartı.
 *
 * Hiç ödeme yoksa tek satırlık bir keşif daveti (mod kartlarının "keşif" desenine
 * benzer, bkz. ModeTodayCard'daki boş-durum ilkesi — burada tam tersi: kart her
 * zaman görünür ama boşken DAVET eder, varken ÖZET verir). Dokununca `/odemeler`.
 */
export function PaymentsSummaryCard() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const t = useLanguageStore(s => s.t).payments;
  const payments = usePaymentsStore(s => s.payments);

  const today = new Date();
  // "Bu ay" = dönemi (Monthly her ay, Yearly/Once yalnız ay eşleşirse) bu aya düşenler.
  const thisMonth = payments.filter(p => {
    const cycle = currentCycleDate(p, today);
    return cycle.getMonth() === today.getMonth() && cycle.getFullYear() === today.getFullYear();
  });
  const thisMonthCount = thisMonth.length;
  const remainingCount = thisMonth.filter(p => !isPaidForCycle(p, cycleKeyOf(p, currentCycleDate(p, today)))).length;

  const hasPayments = payments.length > 0;

  return (
    <BentoCard index={0} onPress={() => router.push('/odemeler')} style={{ marginHorizontal: S.lg, marginBottom: S.lg, padding: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <AppIcon Icon={Wallet} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: F.body, fontWeight: '600', color: theme.onSurface }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, marginTop: S.xxs }}>
            {hasPayments ? t.summaryFilled(thisMonthCount, remainingCount) : t.summaryEmpty}
          </Text>
        </View>
        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
      </View>
    </BentoCard>
  );
}
