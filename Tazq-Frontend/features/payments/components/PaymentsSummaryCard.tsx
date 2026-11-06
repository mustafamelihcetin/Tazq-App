import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { AppIcon } from '@/shared/components/AppIcon';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { homePaymentAlert } from '@/features/payments/utils/homeAlert';
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

  const alert = homePaymentAlert(payments);
  if (!alert) return null;

  const isOverdue = alert.overdue;
  // Birim birim (madde 12): 20 $ ile 200 ₺ toplanıp "220 ₺" yazılamaz.
  const amountStr = formatTotals(totalsByCurrency(alert.payments.map(p => ({ amount: p.amount, currency: p.currency })), main), language === 'en' ? 'en' : 'tr');
  const message = isOverdue ? t.urgentOverdue(alert.payments.length, amountStr) : t.urgentToday(alert.payments.length, amountStr);
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
