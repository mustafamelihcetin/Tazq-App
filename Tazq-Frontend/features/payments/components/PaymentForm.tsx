import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { CalendarDays, ChevronDown, Layers, Zap } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { ToggleRow } from '@/shared/components/SettingsRows';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { F, HAIRLINE, ICON, MIN_TOUCH, R, S, TOP_BAR_HEIGHT, W } from '@/shared/constants/tokens';
import { formatPlanDate } from '@/features/modes/utils/planTaskOps';
import { CurrencyPick } from '@/features/payments/components/CurrencyPick';
import { PaymentAppearance } from '@/features/payments/components/PaymentAppearance';
import type { Payment, PaymentRecurrence } from '@/features/payments/store/usePaymentsStore';
import { amountField, parseAmount } from '@/features/payments/utils/money';
import { DEFAULT_REMINDER_DAYS, PAYMENT_ICONS, PAYMENT_KINDS, REMINDER_OPTIONS, paymentLook, reminderDaysOf } from '@/features/payments/utils/paymentLook';
import type { CurrencyCode } from '@/shared/utils/currency';
import { haptic } from '@/shared/utils/haptics';
import { PAYMENT_PROVIDERS, providerDisplayName, searchProviders } from '@/shared/utils/paymentProviders';

/*
  ÖDEME FORMU (2026-11-06, kullanıcı: "ne için ile tür çelişiyor, karmaşa var, minimalizmden uzak"). Eskiden sayfanın içinde açılan beş başlıklı uzun form.
  · Tek ad alanı: şablon da öneri de altında aynı satır. Yazınca süzülür; seçince ad, ikon ve renk birlikte gelir. Ayrı "Tür" yok.
  · İkon adın yanında; dokununca seçenekler açılır. Para birimi tutarın yanında.
  · Ayrıntı satır satır (Hatırlatıcılar deseni): değer görünür, dokununca açılır. 31 gün ızgarası artık Kaydet'i ekran dışına itmiyor; Kaydet üst barda.
*/
const COPY = {
  tr: {
    newTitle: 'Yeni ödeme', editTitle: 'Ödemeyi düzenle', name: 'Ne için ödüyorsun?', amount: '0', day: 'Ödeme günü', date: 'Tarih',
    dayValue: (d: number) => `Ayın ${d}. günü`, shortMonth: 'Kısa aylarda ayın son günü', remind: 'Hatırlat', off: 'Kapalı', same: 'Aynı gün',
    before: (n: number) => `${n} gün önce`, beforeShort: (n: number) => `${n} gün`, count: 'Taksit sayısı', currency: 'Para birimi', look: 'İkon ve renk', repeat: 'Tekrar', monthly: 'Aylık', quarter: '3 ay', half: '6 ay', yearly: 'Yıllık', once: 'Bir kez', firstDate: 'İlk ödeme',
  },
  en: {
    newTitle: 'New payment', editTitle: 'Edit payment', name: 'What is it for?', amount: '0', day: 'Due day', date: 'Date',
    dayValue: (d: number) => `Day ${d} of the month`, shortMonth: 'Last day in shorter months', remind: 'Remind', off: 'Off', same: 'Same day',
    before: (n: number) => `${n} days before`, beforeShort: (n: number) => `${n}d`, count: 'Number of installments', currency: 'Currency', look: 'Icon and color', repeat: 'Repeat', monthly: 'Monthly', quarter: '3 mo', half: '6 mo', yearly: 'Yearly', once: 'Once', firstDate: 'First payment',
  },
};

const POPULAR = ['netflix', 'spotify', 'youtube-premium', 'amazon-prime', 'icloud', 'chatgpt-plus'];

export interface PaymentDraft {
  title: string; amount: number; recurrence: PaymentRecurrence; dueDay: number; anchorDate: Date; currency: CurrencyCode;
  isVariable: boolean; installmentCount: number | null; icon: string | null; color: string | null; reminderDays: number;
}

type Labels = { cancel: string; add: string; save: string; variableLabel: string; variableHint: string; installmentLabel: string; installmentHint: (n: number) => string; delete: string; skipCycle: string };
type Open = 'icon' | 'day' | 'remind' | null;

export function PaymentForm({ visible, editing, mainCurrency, lang, locale, t, onClose, onSubmit, onDelete, onSkip }: {
  visible: boolean; editing: Payment | null; mainCurrency: CurrencyCode; lang: 'tr' | 'en'; locale: string; t: Labels;
  onClose: () => void; onSubmit: (d: PaymentDraft) => void;
  /** Yalnız düzenlerken. */ onDelete?: () => void;
  /** Yalnız atlanabilir dönemde. */ onSkip?: () => void;
}) {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const c = COPY[lang];
  const nameRef = useRef<TextInput>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(mainCurrency);
  const [recurrence, setRecurrence] = useState<PaymentRecurrence>('Monthly');
  const [dueDay, setDueDay] = useState(new Date().getDate());
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [isVariable, setIsVariable] = useState(false);
  const [installmentOn, setInstallmentOn] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('12');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [reminder, setReminder] = useState(DEFAULT_REMINDER_DAYS);
  const [open, setOpen] = useState<Open>(null);
  // Şablon seçildikten sonra öneriler iner; ad değişirse yeniden açılır.
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const p = editing;
    setTitle(p?.title ?? '');
    setAmount(p ? amountField(p.amount, locale) : '');
    setCurrency((p?.currency as CurrencyCode) || mainCurrency);
    setRecurrence(p?.recurrence ?? 'Monthly');
    setDueDay(p?.dueDay ?? new Date().getDate());
    setAnchorDate(p?.nextDueDate ? new Date(p.nextDueDate) : new Date());
    setIsVariable(!!p?.isVariable);
    setInstallmentOn(!!p?.installmentCount);
    setInstallmentCount(String(p?.installmentCount ?? 12));
    setIcon(p?.icon ?? null);
    setColor(p?.color ?? null);
    setReminder(p ? reminderDaysOf(p) : DEFAULT_REMINDER_DAYS);
    setOpen(null);
    setShowPicker(false);
    setPicked(!!p);
  }, [visible, editing, mainCurrency, locale]);

  const suggestions = useMemo(() => {
    const q = title.trim().toLocaleLowerCase(locale);
    const kinds = PAYMENT_KINDS
      .filter(k => !q || k[lang].toLocaleLowerCase(locale).includes(q))
      .map(k => ({ key: `k:${k.id}`, name: k[lang], Icon: PAYMENT_ICONS[k.icon], tint: k.color, icon: k.icon as string | null, color: k.color as string | null }));
    // Boşken: türler + en yaygın abonelikler. Yazınca: arama.
    const found = q ? searchProviders(title, 8) : PAYMENT_PROVIDERS.filter(p => POPULAR.includes(p.id));
    const providers = found.map(p => ({ key: `p:${p.id}`, name: providerDisplayName(p, lang), Icon: p.icon, tint: p.color, icon: null, color: null }));
    return q ? [...providers, ...kinds] : [...kinds, ...providers];
  }, [title, lang, locale]);

  const look = paymentLook({ title, icon, color });
  const toggle = (k: Open) => { haptic.select(); setOpen(v => (v === k ? null : k)); };
  const parsed = parseAmount(amount);
  const canSave = title.trim() !== '' && parsed > 0;
  const count = parseInt(installmentCount, 10);
  const remindLabel = reminder < 0 ? c.off : reminder === 0 ? c.same : c.before(reminder);

  const submit = () => {
    if (!canSave) return;
    haptic.commit();
    onSubmit({
      title: title.trim(), amount: parsed, recurrence, dueDay, anchorDate, currency,
      isVariable: recurrence !== 'Once' && isVariable,
      installmentCount: installmentOn && recurrence !== 'Once' && count >= 2 ? Math.min(120, count) : null,
      icon, color, reminderDays: reminder,
    });
  };

  const card = { backgroundColor: theme.surfaceCard };
  const divider = { borderTopWidth: HAIRLINE, borderTopColor: theme.separator };

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Sol vazgeç, orta başlık, sağ kaydet: iki yan eşit, başlık tam ortada. */}
        <View style={[styles.bar, { paddingTop: insets.top, height: TOP_BAR_HEIGHT + insets.top, borderBottomColor: theme.separator }]}>
          <GlassSurface radius={0} />
          <Touchable onPress={onClose} accessibilityRole="button" style={styles.barSide}>
            <Text numberOfLines={1} style={{ fontSize: F.body, color: theme.onSurfaceVariant }}>{t.cancel}</Text>
          </Touchable>
          <Text numberOfLines={1} style={[styles.barTitle, { color: theme.onSurface }]}>{editing ? c.editTitle : c.newTitle}</Text>
          <Touchable onPress={submit} disabled={!canSave} accessibilityRole="button" accessibilityState={{ disabled: !canSave }} style={[styles.barSide, { alignItems: 'flex-end' }]}>
            <Text numberOfLines={1} style={{ fontSize: F.body, fontWeight: W.bold, color: canSave ? theme.primary : theme.onSurfaceMuted }}>{editing ? t.save : t.add}</Text>
          </Touchable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: insets.bottom + S.xl }}>

            {/* KİM · NE KADAR */}
            <View style={[styles.card, card]}>
              <View style={styles.nameRow}>
                <Touchable onPress={() => toggle('icon')} accessibilityRole="button" accessibilityState={{ expanded: open === 'icon' }} accessibilityLabel={c.look}>
                  <View style={[styles.neutral, { backgroundColor: look.color ? look.color + '1F' : theme.surfaceField }]}><look.icon size={ICON.md} color={look.color ?? theme.onSurfaceVariant} /></View>
                </Touchable>
                <TextInput
                  ref={nameRef}
                  value={title}
                  onChangeText={v => { setTitle(v); setPicked(false); }}
                  placeholder={c.name}
                  placeholderTextColor={theme.onSurfaceMuted}
                  maxLength={100}
                  autoFocus={!editing}
                  style={[styles.nameInput, { color: theme.onSurface }]}
                />
              </View>
              {open === 'icon' && <PaymentAppearance theme={theme} lang={lang} icon={icon} color={color} onIcon={setIcon} onColor={setColor} />}
              {!picked && suggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -S.md }} contentContainerStyle={{ gap: S.xs, paddingHorizontal: S.md }}>
                  {suggestions.map(s => (
                    <Touchable key={s.key} onPress={() => { haptic.select(); setTitle(s.name); setIcon(s.icon); setColor(s.color); setPicked(true); }} accessibilityRole="button" style={[styles.chip, { backgroundColor: theme.surfaceField }]}>
                      <s.Icon size={ICON.xs} color={s.tint} />
                      <Text style={{ fontSize: F.footnote, fontWeight: W.medium, color: theme.onSurface }}>{s.name}</Text>
                    </Touchable>
                  ))}
                </ScrollView>
              )}
              <View style={[styles.amountRow, divider]}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  onBlur={() => { const n = parseAmount(amount); if (n > 0) setAmount(n.toLocaleString(locale, { maximumFractionDigits: 2 })); }}
                  placeholder={c.amount}
                  placeholderTextColor={theme.onSurfaceMuted}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: theme.onSurface }]}
                />
                <CurrencyPick value={currency} onChange={setCurrency} theme={theme} label={c.currency} />
              </View>
            </View>

            {/* NE ZAMAN */}
            <View style={[styles.card, card]}>
              <SegmentedControl
                options={[{ key: 'Monthly', label: c.monthly }, { key: 'Quarterly', label: c.quarter }, { key: 'SemiAnnual', label: c.half }, { key: 'Yearly', label: c.yearly }, { key: 'Once', label: c.once }]}
                value={recurrence}
                onChange={setRecurrence}
                accessibilityLabel={c.repeat}
                theme={theme}
                isDark={isDark}
              />
              {recurrence === 'Monthly' ? (
                <Row label={c.day} value={c.dayValue(dueDay)} open={open === 'day'} onPress={() => toggle('day')} theme={theme} />
              ) : (
                <Touchable onPress={() => { haptic.select(); setShowPicker(true); }} accessibilityRole="button" style={styles.row}>
                  <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{recurrence === 'Once' ? c.date : c.firstDate}</Text>
                  <Text style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>{formatPlanDate(anchorDate.toISOString(), lang === 'tr')}</Text>
                  <CalendarDays size={ICON.sm} color={theme.onSurfaceMuted} />
                </Touchable>
              )}
              {open === 'day' && recurrence === 'Monthly' && (
                <View>
                  <View style={styles.days}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      const on = dueDay === day;
                      return (
                        <Touchable key={day} onPress={() => { haptic.select(); setDueDay(day); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={styles.dayCell}>
                          <View style={[styles.dayDot, on && { backgroundColor: theme.primaryFill }]}>
                            <Text style={{ fontSize: F.footnote, fontWeight: on ? W.bold : W.regular, color: on ? theme.onPrimaryFill : theme.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>{day}</Text>
                          </View>
                        </Touchable>
                      );
                    })}
                  </View>
                  {dueDay > 28 && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'center', paddingTop: S.xs }}>{c.shortMonth}</Text>}
                </View>
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
              <View style={divider}>
                <Row label={c.remind} value={remindLabel} open={open === 'remind'} onPress={() => toggle('remind')} theme={theme} />
              </View>
              {open === 'remind' && (
                <SegmentedControl
                  options={REMINDER_OPTIONS.map(d => ({ key: String(d), label: d < 0 ? c.off : d === 0 ? c.same : c.beforeShort(d) }))}
                  value={String(reminder)}
                  onChange={k => setReminder(Number(k))}
                  accessibilityLabel={c.remind}
                  theme={theme}
                  isDark={isDark}
                />
              )}
            </View>

            {/* AYRINTI: tek seferlikte anlamı yok */}
            {recurrence !== 'Once' && (
              <View style={[styles.card, card, { paddingVertical: S.xs }]}>
                <ToggleRow icon={<Zap size={ICON.md} color="#FFFFFF" />} bg={theme.warning} title={t.variableLabel} subtitle={isVariable ? t.variableHint : undefined} value={isVariable} onValueChange={v => { haptic.select(); setIsVariable(v); }} theme={theme} isDark={isDark} />
                <View style={divider} />
                <ToggleRow icon={<Layers size={ICON.md} color="#FFFFFF" />} bg={theme.primary} title={t.installmentLabel} subtitle={installmentOn && count >= 2 ? t.installmentHint(Math.min(120, count)) : undefined} value={installmentOn} onValueChange={v => { haptic.select(); setInstallmentOn(v); }} theme={theme} isDark={isDark} />
                {installmentOn && (
                  <View style={[styles.row, divider]}>
                    <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{c.count}</Text>
                    <TextInput value={installmentCount} onChangeText={v => setInstallmentCount(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" style={[styles.countInput, { color: theme.onSurface, backgroundColor: theme.surfaceField }]} />
                  </View>
                )}
              </View>
            )}

            {(onSkip || onDelete) && (
              <View style={[styles.card, card, { paddingVertical: S.xs }]}>
                {onSkip && (
                  <Touchable onPress={onSkip} accessibilityRole="button" style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{t.skipCycle}</Text>
                  </Touchable>
                )}
                {onSkip && onDelete && <View style={divider} />}
                {onDelete && (
                  <Touchable onPress={onDelete} accessibilityRole="button" style={styles.row}>
                    <Text style={[styles.rowLabel, { color: theme.error }]}>{t.delete}</Text>
                  </Touchable>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Row({ label, value, open, onPress, theme }: { label: string; value: string; open: boolean; onPress: () => void; theme: ReturnType<typeof useAppTheme>['theme'] }) {
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ expanded: open }} style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.rowValue, { color: theme.onSurfaceVariant }]}>{value}</Text>
      <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 180 }}>
        <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} />
      </MotiView>
    </Touchable>
  );
}

const SIDE = 92;
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg, borderBottomWidth: HAIRLINE },
  barSide: { width: SIDE, minHeight: MIN_TOUCH, justifyContent: 'center' },
  barTitle: { flex: 1, textAlign: 'center', fontSize: F.body, fontWeight: W.semibold },
  card: { borderRadius: R.lg, padding: S.md, gap: S.smd, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  neutral: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, minHeight: MIN_TOUCH, fontSize: F.body, fontWeight: W.semibold, padding: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.smd },
  amountInput: { flex: 1, minHeight: MIN_TOUCH, fontSize: F.title3, fontWeight: W.bold, padding: 0, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  rowLabel: { flex: 1, fontSize: F.body },
  rowValue: { fontSize: F.footnote, flexShrink: 1 },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  countInput: { width: 64, minHeight: 36, borderRadius: R.md, textAlign: 'center', fontSize: F.body, fontWeight: W.semibold, padding: 0 },
});
