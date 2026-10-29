import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { AppIcon } from '@/shared/components/AppIcon';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePaymentsStore, type Payment } from '@/features/payments/store/usePaymentsStore';
import { nextDueDateOf } from '@/features/payments/utils/paymentDates';
import { defaultCurrencyFor } from '@/shared/utils/currency';
import { totalsByCurrency, formatTotals } from '@/features/payments/utils/money';

const INTL_LOCALE: Record<'tr' | 'en', string> = { tr: 'tr-TR', en: 'en-US' };

/**
 * Ana ekrandaki ödeme kartı — ARTIK sürekli açık bir özet DEĞİL.
 *
 * ÖLÇÜLEN SORUN: her zaman görünen pasif bir özet kartı (eski tasarım) kullanıcı
 * tarafından "bulunamadı" — ModeTodayCard'ın gölgesinde, düşük görsel ağırlıkta
 * kaldı (bkz. kullanıcı geri bildirimi). Kalıcı giriş noktası artık Ayarlar'da
 * (bkz. app/settings.tsx); bu kart SADECE gerçekten aciliyet varken belirir —
 * `TazqZenCard`'ın "overdue" gating'iyle AYNI ilke (features/dashboard/hooks/useZen.ts):
 * yoksa ana ekranda HİÇ yer kaplamaz, varsa görmezden gelinemeyecek kadar net.
 */
export function PaymentsSummaryCard() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { language, t: fullT } = useLanguageStore();
  const t = fullT.payments;
  const payments = usePaymentsStore(s => s.payments);
  const currencyPref = usePaymentsStore(s => s.currency);
  const main = currencyPref ?? defaultCurrencyFor(language);

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const urgent = payments
    .map(p => ({ p, due: nextDueDateOf(p, today) }))
    .filter((x): x is { p: Payment; due: Date } => x.due != null)
    .map(x => ({ ...x, diffDays: Math.round((x.due.getTime() - todayMidnight.getTime()) / 86400000) }))
    .filter(x => x.diffDays <= 3);

  if (urgent.length === 0) return null;

  const overdue = urgent.filter(x => x.diffDays < 0);
  const isOverdue = overdue.length > 0;
  const relevant = isOverdue ? overdue : urgent;
  // Birim birim (madde 12): 20 $ ile 200 ₺ toplanıp "220 ₺" yazılamaz.
  const amountStr = formatTotals(totalsByCurrency(relevant.map(x => ({ amount: x.p.amount, currency: x.p.currency })), main), language === 'en' ? 'en' : 'tr');
  const message = isOverdue ? t.urgentOverdue(relevant.length, amountStr) : t.urgentDueSoon(relevant.length, amountStr);
  const tone = isOverdue ? theme.error : theme.warning;

  return (
    <BentoCard index={0} onPress={() => router.push('/odemeler')} style={{ marginHorizontal: S.lg, marginBottom: S.lg, padding: S.md, borderColor: tone + '40', borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <AppIcon Icon={isOverdue ? AlertTriangle : Wallet} color={tone} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: F.body, fontWeight: '600', color: theme.onSurface }}>
            {t.title}
          </Text>
          <Text style={{ fontSize: F.caption, color: tone, fontWeight: '600', marginTop: S.xxs }}>
            {message}
          </Text>
        </View>
        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
      </View>
    </BentoCard>
  );
}
