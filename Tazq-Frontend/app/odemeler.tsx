import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, type FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, List, Plus, Wallet } from 'lucide-react-native';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { AppIcon } from '@/shared/components/AppIcon';
import { ICON, S, R, F, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useToastStore } from '@/shared/store/useToastStore';
import { haptic } from '@/shared/utils/haptics';
import { usePaymentsStore, type Payment } from '@/features/payments/store/usePaymentsStore';
import { createPaymentAction, updatePaymentAction, deletePaymentUndoable, markPaidUndoable, skipCycleUndoable, canSkipCycle, unmarkPaymentPaidAction, refreshPayments, type CreatePaymentResult } from '@/features/payments/utils/paymentActions';
import { nextDueDateOf, activeCycleKeyOf, paymentView, type PaymentView } from '@/features/payments/utils/paymentDates';
import { PaymentRow } from '@/features/payments/components/PaymentRow';
import { PaidAmountSheet } from '@/features/payments/components/PaidAmountSheet';
import { CurrencyPick } from '@/features/payments/components/CurrencyPick';
import { PaymentForm, type PaymentDraft } from '@/features/payments/components/PaymentForm';
import { PaymentsCalendar } from '@/features/payments/components/PaymentsCalendar';
import { PaymentsMonthCard } from '@/features/payments/components/PaymentsMonthCard';
import { PaymentsHistoryCard } from '@/features/payments/components/PaymentsHistoryCard';
import { totalsByCurrency, formatTotals, formatMoney, approxTotal, withLocalPaid, type FxRates } from '@/features/payments/utils/money';
import { PaymentService, type PaymentRecordRow } from '@/shared/services/api';
import { currencySymbol, defaultCurrencyFor, type CurrencyCode } from '@/shared/utils/currency';
import { upperFor } from '@/shared/utils/localeCase';

/** Dil kodu → Intl locale. Ternary DEĞİL (bkz. __tests__/i18nRatchet.test.ts) — bu
 *  dosya metinlerini TAMAMEN `t.payments` sözlüğünden alıyor, sayı/tarih biçimi
 *  için de aynı ilke: eşleme bir tabloda, dallanma yok. */
const INTL_LOCALE: Record<'tr' | 'en', string> = { tr: 'tr-TR', en: 'en-US' };
const VIEW_COPY = {
  tr: { list: 'Liste görünümü', calendar: 'Takvim görünümü', overdue: 'Gecikmiş', paidGroup: 'Ödendi', Quarterly: '3 ayda bir', SemiAnnual: '6 ayda bir', Yearly: 'yılda bir' },
  en: { list: 'List view', calendar: 'Calendar view', overdue: 'Overdue', paidGroup: 'Paid', Quarterly: 'every 3 months', SemiAnnual: 'every 6 months', Yearly: 'yearly' },
};

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
  const currencyPref = usePaymentsStore(s => s.currency);
  const setCurrencyPref = usePaymentsStore(s => s.setCurrency);
  const currency: CurrencyCode = currencyPref ?? defaultCurrencyFor(language);
  const symbol = currencySymbol(currency);

  /*
    GEÇMİŞ + KUR (madde 12). Kur alınamazsa null: yaklaşık toplam ve çevrilmiş grafik
    değerleri gizlenir/eksik işaretlenir — uydurma kur yok (bkz. money.ts).
  */
  const [history, setHistory] = useState<PaymentRecordRow[]>([]);
  const [fx, setFx] = useState<FxRates | null>(null);
  const loadHistory = () => { PaymentService.getHistory(12).then(setHistory).catch(() => {}); };
  useEffect(() => { refreshPayments(); loadHistory(); PaymentService.getFx().then(setFx); }, []);

  const today = new Date();
  const rows = useMemo(() => {
    return payments
      .map(p => ({ p, due: nextDueDateOf(p, today) }))
      .filter((x): x is { p: Payment; due: Date } => x.due != null)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [payments]);

  // Ekranın satır modeli (bkz. paymentView): ödenen dönem kendi ayında kalır, gecikmiş
  // ödeme "Bu ay"ın başına çıkar..
  const views = useMemo(() => {
    const order = { overdue: 0, due: 1, paid: 2 } as const;
    return payments
      .map(p => paymentView(p, today))
      .filter((v): v is PaymentView => v != null)
      .sort((a, b) => order[a.status] - order[b.status] || a.date.getTime() - b.date.getTime());
  }, [payments]);
  const thisMonth = views.filter(v => v.thisMonth);
  const later = views.filter(v => !v.thisMonth);

  // Form ayrı sayfa (bkz. PaymentForm). `editing` doluysa düzenleme.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const listRef = useRef<FlatList<never>>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  // Gün seçilince takvim üst çubuğun hemen altına gelir, altındaki liste görünür olur (2026-11-05).
  const calendarY = useRef(0);
  // Takvimin altındaki boşluk yalnız gün seçilince: seçilen gün yukarı kaysın diye gerekir, durup dururken sayfa boş kalmaz.
  const [calendarRoom, setCalendarRoom] = useState(false);
  // Değişken tutarlıda "ödendi" → o ayın gerçek tutarı sorulur (bkz. PaidAmountSheet).
  const [paidPrompt, setPaidPrompt] = useState<Payment | null>(null);
  // Bildirimdeki "Tutarı gir" buraya `pay=<id>` ile gelir: o ödemenin tutar penceresi doğrudan açılır.
  const { pay } = useLocalSearchParams<{ pay?: string }>();
  useEffect(() => {
    if (!pay) return;
    const p = usePaymentsStore.getState().payments.find(x => String(x.id) === pay);
    if (p) setPaidPrompt(p);
  }, [pay]);
  const openAdd = () => { haptic.select(); setEditing(null); setFormOpen(true); };
  const openEdit = (p: Payment) => { setEditing(p); setFormOpen(true); };

  // Uzun bas: Düzenle / Sil (kaydırarak silme aynen duruyor).
  const handleMenu = (p: Payment) => {
    haptic.select();
    Alert.alert(p.title, formatMoney(p.amount, p.currency || currency, lang), [
      { text: t.edit, onPress: () => openEdit(p) },
      // Ödenmemiş tekrarlı ödemede: Cashew ve Actual'daki "Atla".
      ...(canSkipCycle(p) && paymentView(p, today)?.status !== 'paid' ? [{ text: t.skipCycle, onPress: () => handleSkip(p) }] : []),
      { text: t.delete, style: 'destructive' as const, onPress: () => handleDelete(p) },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleSubmit = async (d: PaymentDraft) => {
    const isMonthly = d.recurrence === 'Monthly';
    // Aylık: günden. Yıllık/tek seferlik: seçilen tarihin günü + tarihin kendisi (bkz. paymentDates.ts).
    const day = isMonthly ? d.dueDay : d.anchorDate.getDate();
    const nextDueDate = isMonthly ? null : d.anchorDate.toISOString();
    const draft = { id: 0, title: d.title, amount: d.amount, dueDay: day, recurrence: d.recurrence, nextDueDate } as Payment;
    // Taksit: ilk taksit = bu ödemenin şu anki dönemi; düzenlemede başlangıç korunur (sayaç kaymasın).
    const kind = {
      isVariable: d.isVariable,
      installmentCount: d.installmentCount,
      installmentStart: d.installmentCount ? (editing?.installmentStart ?? activeCycleKeyOf(draft, today)) : null,
      icon: d.icon, color: d.color, reminderDays: d.reminderDays,
    };
    const base = { title: d.title, amount: d.amount, dueDay: day, recurrence: d.recurrence, nextDueDate, currency: d.currency, ...kind };
    if (editing) {
      const r = await updatePaymentAction(editing.id, base);
      if (r === 'failed') { showToast(t.updateFailedToast, 'error'); return; }
      showToast(r === 'queued' ? t.queuedToast : t.updatedToast, 'success');
      setFormOpen(false);
      return;
    }
    const result: CreatePaymentResult = await createPaymentAction({ ...base, category: null });
    // Sonuç HER ZAMAN bildirilir — sessiz başarısızlık yok.
    if (result === 'ok') showToast(t.addedToast, 'success');
    else if (result === 'queued') showToast(t.queuedToast, 'success');
    else showToast(t.failedToast, 'error');
    if (result !== 'failed') setFormOpen(false);
  };

  const handleMarkPaid = async (payment: Payment, actualAmount?: number) => {
    // Değişken tutar: önce o ayın gerçek tutarı sorulur (alan son tutarla dolu gelir).
    haptic.select();
    if (payment.isVariable && actualAmount == null) { setPaidPrompt(payment); return; }
    const undo = markPaidUndoable(payment.id, activeCycleKeyOf(payment, today), actualAmount, loadHistory);
    if (!undo) return;
    showToast(t.markedPaidToast(payment.title), 'success', { label: t.undo, onAction: () => { undo(); } });
  };

  const handleSkip = (payment: Payment) => {
    const undo = skipCycleUndoable(payment.id, activeCycleKeyOf(payment, today));
    if (!undo) return;
    showToast(t.skippedToast(payment.title), 'success', { label: t.undo, onAction: () => { undo(); } });
  };

  // Onay yerine geri alma: yanlışlıkla silmenin bedeli yok, doğru silme bir adım kısa (Actual'daki `undoable` fikri).
  const handleDelete = (payment: Payment) => {
    haptic.commit();
    const undo = deletePaymentUndoable(payment.id);
    if (!undo) return;
    showToast(t.deletedToast(payment.title), 'success', { label: t.undo, onAction: () => { undo(); } }, 'bottom');
  };

  const lang: 'tr' | 'en' = language === 'en' ? 'en' : 'tr';
  const locale = INTL_LOCALE[language];
  const formatAmount = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 2 })} ${symbol}`;
  // Gün adı da yazılır (2026-11-05): "17 Aralık Perşembe" — hangi güne denk geldiği bilinsin.
  const formatDue = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'short' });

  // Birim birim kesin toplamlar; ilerleme ve "≈" ana birimde (kur varsa).
  const totalsOf = (list: PaymentView[]) => totalsByCurrency(list.map(v => ({ amount: v.p.amount, currency: v.p.currency })), currency);
  const paidList = thisMonth.filter(v => v.status === 'paid');
  const unpaidList = thisMonth.filter(v => v.status !== 'paid');
  const overdueList = thisMonth.filter(v => v.status === 'overdue');
  const multiCurrency = totalsOf(thisMonth).length > 1;
  const approxPaid = approxTotal(totalsOf(paidList), currency, fx);
  const approxAll = approxTotal(totalsOf(thisMonth), currency, fx);
  const approxLeft = approxTotal(totalsOf(unpaidList), currency, fx);

  const renderGroup = (list: PaymentView[]) => (
    <View>
      {list.map((v, i) => (
        <PaymentRow
          key={v.p.id}
          view={v}
          position={list.length === 1 ? 'only' : i === 0 ? 'first' : i === list.length - 1 ? 'last' : 'middle'}
          theme={theme}
          t={t}
          // Değişken tutar ödenene kadar TAHMİN: başında "~" (ödenince gerçek tutar görünür).
          amountLabel={`${v.p.isVariable && v.status !== 'paid' ? '~' : ''}${formatMoney(v.p.amount, v.p.currency || currency, lang)}`}
          dateLabel={formatDue(v.date)}
          repeatLabel={v.p.recurrence === 'Quarterly' || v.p.recurrence === 'SemiAnnual' || v.p.recurrence === 'Yearly' ? VIEW_COPY[lang][v.p.recurrence] : undefined}
          onToggle={() => (v.status === 'paid' ? void unmarkPaymentPaidAction(v.p.id).finally(loadHistory) : handleMarkPaid(v.p))}
          onDelete={() => handleDelete(v.p)}
          onMenu={() => handleMenu(v.p)}
          onEdit={() => openEdit(v.p)}
        />
      ))}
    </View>
  );
  // Birim karışıksa uzun zincir yerine ana birimde tek yaklaşık sayı; kur yoksa dürüstçe zincir.
  const sumPayments = (list: Payment[]) => {
    const totals = totalsByCurrency(list.map(p => ({ amount: p.amount, currency: p.currency })), currency);
    const approx = totals.length > 1 ? approxTotal(totals, currency, fx) : null;
    return approx != null ? `≈ ${formatMoney(Math.round(approx), currency, lang)}` : formatTotals(totals, lang);
  };
  const sumLabel = (list: PaymentView[]) => sumPayments(list.map(v => v.p));
  const section = (title: string, list: PaymentView[], tone?: string) => list.length > 0 && (
    <View style={{ gap: S.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: S.sm, paddingHorizontal: S.md }}>
        <Text style={{ color: tone ?? theme.onSurfaceMuted, fontWeight: '600', fontSize: F.caption, letterSpacing: 0.6 }}>{upperFor(title, language)}</Text>
        <Text numberOfLines={1} style={{ color: tone ?? theme.onSurfaceMuted, fontWeight: '600', fontSize: F.caption, fontVariant: ['tabular-nums'] }}>{sumLabel(list)}</Text>
      </View>
      {renderGroup(list)}
    </View>
  );
  const allTotals = totalsOf(thisMonth);
  const paidRatio = allTotals.length === 1
    ? (totalsOf(paidList)[0]?.amount ?? 0) / Math.max(allTotals[0].amount, 0.01)
    : approxAll && approxPaid != null ? approxPaid / approxAll : null;
  // Ana birim yalnız yabancı birimli ödeme varken anlamlı: toplamın hangi birimde gösterileceğini seçer.
  const foreign = payments.some(p => p.currency && p.currency !== currency);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader
        onBack={() => router.back()}
        title={t.title}
        scrollY={scrollY}
        // Ekleme ÇUBUKTA (iOS: sağ üst "+") — eskiden sayfanın en değerli yerini tam
        // genişlikte kesikli bir kutu kaplıyordu.
        right={(
          <View style={{ flexDirection: 'row', marginRight: -S.sm }}>
            {payments.length > 0 && (
              <Touchable onPress={() => { haptic.select(); setView(view === 'list' ? 'calendar' : 'list'); }} accessibilityRole="button" accessibilityLabel={VIEW_COPY[lang][view === 'list' ? 'calendar' : 'list']} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
                {view === 'list' ? <CalendarDays size={ICON.md} color={theme.onSurface} /> : <List size={ICON.md} color={theme.onSurface} />}
              </Touchable>
            )}
            <Touchable onPress={openAdd} accessibilityRole="button" accessibilityLabel={t.addPayment} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={ICON.md} color={theme.primary} />
            </Touchable>
          </View>
        )}
      />

      <Animated.FlatList
        ref={listRef}
        data={[] as never[]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // VARSAYILAN 'never': klavye açıkken listedeki herhangi bir dokunulabilire
        // basmak İLK dokunuşu sadece klavyeyi kapatmaya harcıyordu — "Ne için"
        // kutusu odaktayken öneri satırına basmak bu yüzden hiç işlenmiyordu
        // (onPressIn'e taşımak da yetmedi, çünkü FlatList'in kendi responder'ı
        // dokunuşu Touchable'a ULAŞMADAN yutuyordu). 'handled': dokunulabilir bir
        // öğeye basılıyorsa dokunuş HEMEN işlenir, klavye kapanması yan etkidir.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xl + (view === 'calendar' && calendarRoom ? 320 : 0), width: '100%', maxWidth: contentW, alignSelf: 'center' }}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={{ gap: S.lg }}>
            {payments.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: S.xxl, gap: S.sm }}>
                <AppIcon Icon={Wallet} color={theme.onSurfaceVariant} size={48} radius={R.lg} iconSize={ICON.lg} />
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center' }}>
                  {t.emptyState}
                </Text>
                <Touchable onPress={openAdd} accessibilityRole="button" style={{ marginTop: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primaryFill + '1F' }}>
                  <Text style={{ color: theme.primary, fontWeight: '600', fontSize: F.body }}>{`+ ${t.addPayment}`}</Text>
                </Touchable>
              </View>
            )}

            {payments.length > 0 && (
              <PaymentsMonthCard
                theme={theme}
                t={t}
                language={lang}
                remaining={formatTotals(totalsOf(unpaidList), lang)}
                remainingAmount={totalsOf(unpaidList).length === 1 ? { value: totalsOf(unpaidList)[0].amount, code: totalsOf(unpaidList)[0].code } : null}
                paid={sumLabel(paidList) || formatMoney(0, currency, lang)}
                total={sumLabel(thisMonth)}
                progress={paidRatio}
                allPaid={thisMonth.length > 0 && unpaidList.length === 0}
                noneThisMonth={thisMonth.length === 0}
                overdue={view === 'calendar' && overdueList.length ? { count: overdueList.length, amount: formatTotals(totalsOf(overdueList), lang) } : null}
                next={view === 'list' && overdueList.length ? null : unpaidList[0] ? { title: unpaidList[0].p.title, days: unpaidList[0].days } : later[0] ? { title: later[0].p.title, days: later[0].days } : null}
                approx={multiCurrency && approxLeft != null ? `≈ ${formatMoney(Math.round(approxLeft), currency, lang)}` : null}
              />
            )}

            {view === 'calendar' && payments.length > 0 && (
              <View onLayout={e => { calendarY.current = e.nativeEvent.layout.y; }}>
                <PaymentsCalendar payments={payments} theme={theme} lang={lang} locale={locale} onOpen={openEdit}
                  onDaySelected={() => { setCalendarRoom(true); setTimeout(() => listRef.current?.scrollToOffset({ offset: calendarY.current + S.md - S.sm, animated: true }), 0); }}
                  sumOf={sumPayments} formatAmount={p => formatMoney(p.amount, p.currency || currency, lang)} />
              </View>
            )}

            {/* Önce yapılması gereken: gecikmiş, bu ay, sonraki. Ödenen en altta, dikkat çekmez. */}
            {view === 'list' && section(VIEW_COPY[lang].overdue, overdueList, theme.error)}
            {view === 'list' && section(t.thisMonth, unpaidList.filter(v => v.status !== 'overdue'))}
            {view === 'list' && section(t.upcoming, later)}
            {view === 'list' && section(VIEW_COPY[lang].paidGroup, paidList)}

            {(history.length > 0 || payments.length > 0) && (
              <PaymentsHistoryCard theme={theme} isDark={isDark} lang={lang} main={currency} fx={fx}
                records={withLocalPaid(history, payments)} />
            )}

            {/* ANA PARA BİRİMİ — toplamların "≈" satırı ve grafik bu birimde. Yeni ödemenin
                varsayılanı da bu; her ödeme kendi birimini korur. */}
            {foreign && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.lg, backgroundColor: theme.surfaceCard }}>
                <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{t.mainCurrency}</Text>
                <CurrencyPick value={currency} onChange={setCurrencyPref} theme={theme} label={t.mainCurrency} />
              </View>
            )}

          </View>
        }
      />
      <PaymentForm
        visible={formOpen}
        editing={editing}
        mainCurrency={currency}
        lang={lang}
        locale={locale}
        t={t}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? () => { setFormOpen(false); handleDelete(editing); } : undefined}
        onSkip={editing && canSkipCycle(editing) && paymentView(editing, today)?.status !== 'paid' ? () => { setFormOpen(false); handleSkip(editing); } : undefined}
      />
      <PaidAmountSheet
        visible={paidPrompt != null}
        title={paidPrompt?.title ?? ''}
        estimate={paidPrompt?.amount ?? 0}
        symbol={currencySymbol((paidPrompt?.currency as CurrencyCode) || currency)}
        locale={locale}
        theme={theme}
        t={t}
        onCancel={() => setPaidPrompt(null)}
        onConfirm={(amt) => { const p = paidPrompt; setPaidPrompt(null); if (p) void handleMarkPaid(p, amt); }}
      />
    </View>
  );
}
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
