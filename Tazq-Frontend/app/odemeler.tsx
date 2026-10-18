import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Plus, Check, Trash2, Wallet } from 'lucide-react-native';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { AppIcon } from '@/shared/components/AppIcon';
import { ModeField, FormReveal } from '@/features/modes/components/ModeField';
import { ICON, S, R, F, B, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useToastStore } from '@/shared/store/useToastStore';
import { haptic } from '@/shared/utils/haptics';
import { usePaymentsStore, type Payment, type PaymentRecurrence } from '@/features/payments/store/usePaymentsStore';
import { createPaymentAction, deletePaymentAction, markPaymentPaidAction, unmarkPaymentPaidAction, refreshPayments } from '@/features/payments/utils/paymentActions';
import { nextDueDateOf, activeCycleKeyOf, isPaidForCycle } from '@/features/payments/utils/paymentDates';
import { schedulePaymentDueNotif, cancelPaymentDueNotif } from '@/shared/utils/notifications';
import { toDateKey } from '@/shared/utils/dateKey';

/** Dil kodu → Intl locale. Ternary DEĞİL (bkz. __tests__/i18nRatchet.test.ts) — bu
 *  dosya metinlerini TAMAMEN `t.payments` sözlüğünden alıyor, sayı/tarih biçimi
 *  için de aynı ilke: eşleme bir tabloda, dallanma yok. */
const INTL_LOCALE: Record<'tr' | 'en', string> = { tr: 'tr-TR', en: 'en-US' };

/**
 * Ödeme takibi — GÖREVLERDEN AYRI ekran. Bottom tab EKLENMEDİ (5 sekme zaten dar
 * ekranda zorlanıyor, bkz. BottomNavBar); buraya ana ekrandaki özet karttan gelinir
 * (bkz. PaymentsSummaryCard) ve geri okuyla çıkılır — tıpkı Arşiv ekranı gibi.
 */
export default function OdemelerScreen() {
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const { theme, isDark } = useAppTheme();
  const { language, t: fullT } = useLanguageStore();
  const t = fullT.payments;
  const router = useRouter();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const showToast = useToastStore(s => s.show);

  const payments = usePaymentsStore(s => s.payments);

  useEffect(() => { refreshPayments(); }, []);

  const today = new Date();
  const rows = useMemo(() => {
    return payments
      .map(p => ({ p, due: nextDueDateOf(p, today) }))
      .filter((x): x is { p: Payment; due: Date } => x.due != null)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [payments]);

  const thisMonth = rows.filter(r => r.due.getMonth() === today.getMonth() && r.due.getFullYear() === today.getFullYear());
  const nextMonth = rows.filter(r => !thisMonth.includes(r));

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<PaymentRecurrence>('Monthly');
  const [dueDay, setDueDay] = useState('1');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const resetForm = () => {
    setTitle(''); setAmount(''); setRecurrence('Monthly'); setDueDay('1'); setAnchorDate(new Date()); setShowPicker(false);
  };

  const canSave = title.trim() !== '' && parseFloat(amount.replace(',', '.')) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    haptic.commit();
    const amountNum = parseFloat(amount.replace(',', '.'));
    const isMonthly = recurrence === 'Monthly';
    const day = isMonthly ? Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)) : anchorDate.getDate();
    const nextDueDate = isMonthly ? null : anchorDate.toISOString();

    await createPaymentAction({
      title: title.trim(),
      amount: amountNum,
      dueDay: day,
      recurrence,
      nextDueDate,
      category: null,
    });
    setShowAdd(false);
    resetForm();
  };

  const handleMarkPaid = async (payment: Payment) => {
    haptic.select();
    const cycleKey = activeCycleKeyOf(payment, today);
    await markPaymentPaidAction(payment.id, cycleKey);
    if (payment.id > 0) void cancelPaymentDueNotif(payment.id);
    showToast(
      t.markedPaidToast(payment.title),
      'success',
      { label: t.undo, onAction: () => { void unmarkPaymentPaidAction(payment.id); } },
    );
  };

  const handleDelete = (payment: Payment) => {
    Alert.alert(
      t.deleteTitle,
      t.deleteConfirm(payment.title),
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: () => {
          haptic.commit();
          if (payment.id > 0) void cancelPaymentDueNotif(payment.id);
          void deletePaymentAction(payment.id);
        } },
      ],
    );
  };

  // Yeni/düzenlenen ödeme için vade bildirimini kur — sunucuya yazılmış (id>0) kayıtlarda.
  const scheduledRef = useRef(new Set<number>());
  useEffect(() => {
    for (const { p, due } of rows) {
      if (p.id > 0 && !scheduledRef.current.has(p.id)) {
        scheduledRef.current.add(p.id);
        void schedulePaymentDueNotif(p.id, p.title, due, language);
      }
    }
  }, [rows, language]);

  const locale = INTL_LOCALE[language];
  const formatAmount = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 2 })} ₺`;
  const formatDue = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const renderRow = (item: { p: Payment; due: Date }) => {
    const { p, due } = item;
    const cycleKey = activeCycleKeyOf(p, today);
    const paid = isPaidForCycle(p, cycleKey);
    return (
      <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
        <Touchable
          onPress={() => (paid ? unmarkPaymentPaidAction(p.id) : handleMarkPaid(p))}
          style={{ width: 28, height: 28, borderRadius: R.full, borderWidth: B.medium, borderColor: paid ? theme.success : theme.onSurfaceVariant, backgroundColor: paid ? theme.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={paid ? t.undoPaid : t.markPaid}
        >
          {paid && <Check size={ICON.xs} color="#fff" strokeWidth={3} />}
        </Touchable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: F.body, textDecorationLine: paid ? 'line-through' : 'none' }} numberOfLines={1}>{p.title}</Text>
          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{formatDue(due)} · {formatAmount(p.amount)}</Text>
        </View>
        <Touchable onPress={() => handleDelete(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={t.delete}>
          <Trash2 size={ICON.sm} color={theme.onSurfaceVariant} />
        </Touchable>
      </View>
    );
  };

  const recurrenceOptions: { key: PaymentRecurrence; label: string }[] = [
    { key: 'Monthly', label: t.recurrenceMonthly },
    { key: 'Yearly', label: t.recurrenceYearly },
    { key: 'Once', label: t.recurrenceOnce },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={t.title} scrollY={scrollY} />

      <Animated.FlatList
        data={[] as never[]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={{ gap: S.md }}>
            {!showAdd ? (
              <Touchable onPress={() => { haptic.select(); setShowAdd(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                <Plus size={ICON.sm} color={theme.primary} />
                <Text style={{ color: theme.primary, fontWeight: '600', fontSize: F.body }}>{t.addPayment}</Text>
              </Touchable>
            ) : (
              <FormReveal style={{ gap: S.sm, padding: S.md, borderRadius: R.md, backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                <ModeField accent={theme.primary} value={title} onChangeText={setTitle} placeholder={t.namePlaceholder} maxLength={100} />
                <ModeField accent={theme.primary} value={amount} onChangeText={setAmount} placeholder={t.amountPlaceholder} keyboardType="decimal-pad" suffix={<Text style={{ color: theme.onSurfaceVariant, fontWeight: '600' }}>₺</Text>} />
                <View style={{ flexDirection: 'row', gap: S.xs }}>
                  {recurrenceOptions.map(opt => {
                    const active = recurrence === opt.key;
                    return (
                      <Touchable key={opt.key} onPress={() => { haptic.select(); setRecurrence(opt.key); }} style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? theme.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? theme.primary + '18' : 'transparent' }} activeOpacity={0.7}>
                        <Text style={{ fontSize: F.caption, fontWeight: '600', color: active ? theme.primary : theme.onSurfaceVariant }}>{opt.label}</Text>
                      </Touchable>
                    );
                  })}
                </View>
                {recurrence === 'Monthly' ? (
                  <ModeField accent={theme.primary} value={dueDay} onChangeText={setDueDay} placeholder={t.dueDayPlaceholder} keyboardType="number-pad" maxLength={2} />
                ) : (
                  <Touchable onPress={() => { haptic.select(); setShowPicker(true); }} style={{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }} activeOpacity={0.7}>
                    <Text style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600', flex: 1 }}>{toDateKey(anchorDate)}</Text>
                  </Touchable>
                )}
                {showPicker && (
                  <DateTimePicker
                    value={anchorDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (Platform.OS === 'android') setShowPicker(false);
                      if (event.type === 'dismissed') { setShowPicker(false); return; }
                      if (date) setAnchorDate(date);
                    }}
                  />
                )}
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  <Touchable onPress={() => { setShowAdd(false); resetForm(); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                    <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{t.cancel}</Text>
                  </Touchable>
                  <Touchable onPress={handleSave} disabled={!canSave} style={{ flex: 2, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, backgroundColor: canSave ? theme.primary : theme.primary + '55' }} activeOpacity={0.8}>
                    <Text style={{ color: theme.onPrimary ?? '#fff', fontWeight: '600', fontSize: F.caption }}>{t.add}</Text>
                  </Touchable>
                </View>
              </FormReveal>
            )}

            {payments.length === 0 && !showAdd && (
              <View style={{ alignItems: 'center', paddingVertical: S.xxl, gap: S.sm }}>
                <AppIcon Icon={Wallet} color={theme.onSurfaceVariant} size={48} radius={R.lg} iconSize={ICON.lg} />
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center' }}>
                  {t.emptyState}
                </Text>
              </View>
            )}

            {thisMonth.length > 0 && (
              <View style={{ gap: S.sm }}>
                <Text style={{ color: theme.onSurfaceMuted, fontWeight: '700', fontSize: F.caption, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.thisMonth}</Text>
                {thisMonth.map(r => renderRow(r))}
              </View>
            )}

            {nextMonth.length > 0 && (
              <View style={{ gap: S.sm }}>
                <Text style={{ color: theme.onSurfaceMuted, fontWeight: '700', fontSize: F.caption, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.upcoming}</Text>
                {nextMonth.map(r => renderRow(r))}
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
