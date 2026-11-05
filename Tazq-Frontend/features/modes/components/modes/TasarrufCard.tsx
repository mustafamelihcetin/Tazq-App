import { useMoneySymbol } from '@/features/modes/hooks/useMoneySymbol';
import { useCloseRequest } from '@/features/modes/store/useGoalCloseStore';
import { PlanLink } from '@/features/modes/components/plan/PlanLink';
/**
 * TasarrufCard — Tasarruf/Bütçe modu kartı (Dönemsel Modlar).
 * Kilo kartı deseninin finansal ikizi: başlangıç→hedef tutar + süre, haftalık
 * "bakiyeni gir" (7-gün kilidi), "Hedefe ilerleme paraX/paraY · %", deadline sonucu.
 * Kendi içinde kapsüllü: tüm veri store'lardan, plan oluşturma burada.
 */
import React, { useState, useRef } from 'react';
import { View, Text } from 'react-native';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useBudgetStore, type BudgetType } from '@/shared/store/useBudgetStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePlanAdaptations } from '@/features/modes/hooks/usePlanAdaptations';
import { startTasarrufPlan } from '@/features/modes/utils/lifePlanStart';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { ModeCardClose } from '../ModeCardClose';
import { DeviceOnlyNote } from '@/features/modes/components/DeviceOnlyNote';
import { FormReveal, ModeField } from '../ModeField';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { ICON, S, R, F, B } from '@/shared/constants/tokens';
import { tasarrufTypeLabel, TASARRUF_COLOR, spendingAreaLabel, type SpendingArea } from '@/shared/utils/lifeModePlans';
import { retirePlanTask , retireModeTasksByTag} from '@/features/modes/utils/planTaskOps';
import { Coins } from 'lucide-react-native';
import { Plus, Minus } from 'lucide-react-native';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { closeModeWithUndo } from '@/features/modes/utils/modeUndo';
import { PlanLifecycleRow } from '@/features/modes/components/PlanPauseRow';
import { usePlanLifecycle } from '@/features/modes/hooks/usePlanLifecycle';
import { haptic } from '@/shared/utils/haptics';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';
import { daysLeftOf as planDaysLeftOf } from '@/features/modes/utils/planTaskOps';
import { HABIT_LIMIT_COPY } from '@/features/habits/utils/habitLimitCopy';


const ENTRY_COPY = {
  tr: { in: 'Eklenecek tutar', out: 'Çıkarılacak tutar', debtIn: 'Eklenen borç', debtOut: 'Ödenen tutar', set: 'Güncel bakiye', target: 'Yeni hedef tutar', addBtn: 'Para ekle', outBtn: 'Para çıkar', debtAddBtn: 'Borç eklendi', debtOutBtn: 'Ödeme yaptım', fix: 'Bakiyeyi düzelt', goal: 'Hedefi değiştir', saved: 'Kaydedildi', undo: 'Geri al', reached: 'Hedefe ulaştın. Tebrikler!', cleared: 'Borç kapandı. Tebrikler!', timeUp: 'Süre doldu. Hedefin hâlâ geçerliyse uzatabilirsin.', extend: '3 ay uzat', locale: 'tr-TR' },
  en: { in: 'Amount to add', out: 'Amount to withdraw', debtIn: 'Debt added', debtOut: 'Amount paid', set: 'Current balance', target: 'New goal amount', addBtn: 'Add money', outBtn: 'Withdraw', debtAddBtn: 'Debt added', debtOutBtn: 'Made a payment', fix: 'Correct the balance', goal: 'Change the goal', saved: 'Saved', undo: 'Undo', reached: 'Goal reached. Well done!', cleared: 'Debt cleared. Well done!', timeUp: 'Time is up. Extend it if the goal still stands.', extend: 'Add 3 months', locale: 'en-US' },
};

export function TasarrufCard({ onInputFocus }: { onInputFocus?: (target: number) => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const ec = ENTRY_COPY[language === 'en' ? 'en' : 'tr'];
  const { symbol: cur } = useMoneySymbol(language === 'en' ? 'en' : 'tr');
  const fmtMoney = (n: number) => n.toLocaleString(ec.locale);
  // Yüzey vurgusu tema-duyarlı palet + AA geçen metin tonu.
  const { accent: C, accentText: C_TX, onAccent: C_ON } = useModeAccent('tasarruf');

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const tasarrufPlanHabitIds = usePrefsStore(s => s.tasarrufPlanHabitIds);
  const tasarrufPlanTaskIds = usePrefsStore(s => s.tasarrufPlanTaskIds);
  const setPlanIds = usePrefsStore(s => s.setPlanIds);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planSpecs = usePrefsStore(s => s.planSpecs);
  const setPersonalNote = usePrefsStore(s => s.setPersonalNote);

  const { budgetType, startAmount, targetAmount, log, setBudgetType, setStartAmount, setTargetAmount, addEntry, adjust, undoMove, moves, reset, setCover } = useBudgetStore();
  const addHabit = useHabitStore(s => s.addHabit);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const { runAdaptations } = usePlanAdaptations();

  const [expanded, setExpanded] = useState(() => !(usePrefsStore.getState().tasarrufPlanHabitIds.length > 0 || usePrefsStore.getState().tasarrufPlanTaskIds.length > 0));
  const [entryInput, setEntryInput] = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [durationMonths, setDurationMonths] = useState<number | null>(null);
  // Acil fon'a özel: aylık gider + kaç aylık güvence (hedef bundan hesaplanır).
  const [monthlyExpense, setMonthlyExpense] = useState('');
  const [coverMonths, setCoverMonths] = useState(6);
  // "En çok nerede fazladan harcıyorsun?" — budgetType'tan AYRI, opsiyonel ikinci soru
  // (bkz. lifeModePlans.ts spendingArea notu). Yalnız kurulum anında geçerli, bir store'a
  // yazılmaz — apply() anında TEK ekstra göreve dönüşür, sonra anlamı kalmaz.
  const [spendingArea, setSpendingArea] = useState<SpendingArea>('');

  const applied = tasarrufPlanHabitIds.length > 0 || tasarrufPlanTaskIds.length > 0;
  const lifecycle = usePlanLifecycle('tasarruf', seasonal.tasarrufDate, tasarrufPlanHabitIds);
  const start = parseFloat(startAmount) || 0;
  const target = parseFloat(targetAmount) || 0;
  const latest = log.length ? log.reduce((a, b) => (a.date > b.date ? a : b)).amount : start;
  const goalAmt = Math.abs(target - start);
  const doneAmt = Math.max(0, start > target ? (start - latest) : (latest - start)); // borç: düşüş, birikim: artış
  const pct = goalAmt > 0 ? Math.min(100, Math.round((doneAmt / goalAmt) * 100)) : 0;

  const dateObj = seasonal.tasarrufDate ? new Date(seasonal.tasarrufDate) : null;
  // Tek sayaç (planTaskOps) — diğer mod kartlarıyla aynı gün sayısı.
  const daysLeft = dateObj ? planDaysLeftOf(seasonal.tasarrufDate!) : 0;
  const datePast = dateObj ? parseDateKey(seasonal.tasarrufDate!).setHours(23, 59, 59, 999) < Date.now() : false;

  // Giriş türü: ekle / çıkar / bakiyeyi düzelt. Haftalık kilit kalktı (bkz. useBudgetStore.adjust).
  const [entryMode, setEntryMode] = useState<'in' | 'out' | 'set' | 'target'>('in');
  const isDebt = budgetType === 'borc';
  const entryLabel = { in: isDebt ? ec.debtIn : ec.in, out: isDebt ? ec.debtOut : ec.out, set: ec.set, target: ec.target }[entryMode];

  const TYPES: { key: Exclude<BudgetType, ''>; emoji: string; tr: string; en: string }[] = [
    { key: 'birikim', emoji: '💰', tr: 'Birikim Hedefi', en: 'Savings Goal' },
    { key: 'borc', emoji: '💸', tr: 'Borç Kapatma', en: 'Debt Payoff' },
    { key: 'acilfon', emoji: '🛡️', tr: 'Acil Fon', en: 'Emergency Fund' },
  ];
  const DURATIONS = [3, 6, 12, 24];

  // Türe özel: anlamlı başlangıç/hedef hesabı (hepsi aynı kalıba düşmesin).
  // birikim: şu anki birikim → hedef tutar. borç: borç → 0. acil fon: 0/şu anki → aylık gider × ay.
  const monthlyExp = parseFloat(monthlyExpense) || 0;
  const computedStart = parseFloat(startAmount) || 0;
  const computedTarget = budgetType === 'borc' ? 0 : budgetType === 'acilfon' ? monthlyExp * coverMonths : (parseFloat(targetAmount) || 0);
  const configValid = !!budgetType && !!durationMonths && (
    budgetType === 'borc' ? computedStart > 0 :
    budgetType === 'acilfon' ? (monthlyExp > 0 && computedTarget > computedStart) :
    (computedTarget > computedStart) // birikim: hedef, mevcut birikimden büyük olmalı
  );
  // "Planı Uygula" pasifse NEDENİNİ söyle — sessiz pasif buton kafa karıştırıyordu.
  // SIRA ÖNEMLİ: tür seçilmeden süre/tutar ipuçları anlamsız — önce tür sorulur.
  const disabledHint = (() => {
    if (configValid) return '';
    if (!budgetType) return tr ? 'Önce hedef türünü seç' : 'Pick a goal type first';
    if (!durationMonths) return tr ? 'Bir süre seç' : 'Pick a duration';
    if (budgetType === 'borc') return computedStart > 0 ? '' : (tr ? 'Borç tutarını gir' : 'Enter the debt amount');
    if (budgetType === 'acilfon') {
      if (monthlyExp <= 0) return tr ? 'Aylık gideri gir' : 'Enter your monthly expenses';
      return tr ? 'Hedef, mevcut tutardan büyük olmalı' : 'Target must exceed the current amount';
    }
    // birikim
    return tr ? 'Hedef tutar, mevcut birikimden büyük olmalı' : 'Target must be higher than current savings';
  })();
  // para önekli, alt-çizgisiz, ÜST SINIRLI temiz para girişi. Inline fonksiyon (component
  // değil) → her tuşta remount/focus kaybı olmaz.
  // Para girişi: STORE'da ham rakam (parseFloat güvenli), EKRANDA binlik nokta ayracı.
  // Tutarlar tam sayı para (kuruş yok) → en sade ve okunur biçim, üst sınır korunur.
  const MAX_AMOUNT = 1_000_000_000; // 1 milyar üst sınır
  const sanitizeMoney = (t: string) => {
    const digits = t.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); // sadece rakam + baştaki sıfırları at
    if (!digits) return '';
    const n = parseInt(digits, 10);
    return String(n > MAX_AMOUNT ? MAX_AMOUNT : n);
  };
  const formatThousands = (raw: string) => {
    const digits = (raw ?? '').replace(/\D/g, '');
    return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  };
  const moneyInput = (value: string, onChange: (v: string) => void, autoFocus = false) => (
    <ModeField
      accent={C}
      prefix={<Text style={{ color: theme.onSurfaceMuted, fontSize: F.body, fontWeight: '700', marginRight: S.xs }}>{cur}</Text>}
      inputStyle={{ fontWeight: '700' }}
      value={formatThousands(value)}
      onChangeText={(t) => onChange(sanitizeMoney(t))}
      keyboardType="number-pad"
      placeholder="0"
      maxLength={13}
      autoFocus={autoFocus}
      onFocus={e => onInputFocus?.(e.nativeEvent.target as unknown as number)}
    />
  );

  /*
    ÇİFT DOKUNUŞ KİLİDİ — bkz. TurkishModeBanner.tsx `applyingRef`: aynı kalıp.
    `apply` birden çok `await` içeriyor; hızlı iki dokunuş ikisi de `configValid`
    kontrolünden geçip sunucuda İKİ KEZ aynı plan görevlerini oluşturabilirdi.
  */
  const applyingRef = useRef(false);
  const apply = async () => {
    if (!configValid || applyingRef.current) return;
    applyingRef.current = true;
    try {
    haptic.success();
    await startTasarrufPlan({ type: budgetType as Exclude<BudgetType, ''>, start: computedStart, target: computedTarget, monthly: monthlyExp, cover: coverMonths, months: durationMonths || 6, area: spendingArea, lang: tr ? 'tr' : 'en' });
    setExpanded(false);
    setTimeout(() => runAdaptations(true), 300);
    } finally {
      applyingRef.current = false;
    }
  };

  const closePlan = () => {
    tasarrufPlanHabitIds.forEach(id => removeHabit(id));
    tasarrufPlanTaskIds.forEach(id => retirePlanTask(id, 'tasarruf'));
    // ETIKET TABANLI SUPURME — id listesine bakmadan moda ait HER seyi kaldirir.
    // Yukaridaki id-tabanli temizlik yalnizca 'bildigimiz' gorevleri siler; bir
    // gorev o listeden dusmusse (offline tempId kaymasi, basarisiz silme) ekranda
    // kaliyordu ve ancak bir sonraki UYGULAMA ACILISINDA siliniyordu. Kullanicinin
    // gordugu: "modu kapattim ama gorevi hala duruyor".
    retireModeTasksByTag('tasarruf', seasonal.tasarrufName);
    clearPlanIds('tasarruf');
    setSeasonalPref('tasarrufMode', false);
    setSeasonalPref('tasarrufName', '');
    setSeasonalPref('tasarrufDate', null);
    reset();
    setExpanded(false);
  };
  useCloseRequest('tasarruf', () => closeModeWithUndo('tasarruf', closePlan, tr ? 'Tasarruf modu kapatıldı' : 'Savings mode closed', tr ? 'Geri al' : 'Undo'));

  const saveEntry = () => {
    const v = parseFloat(entryInput.replace(',', '.'));
    if (isNaN(v) || v < 0 || (v === 0 && entryMode !== 'set')) return;
    haptic.success();
    setEntryInput(''); setShowEntry(false);
    if (entryMode === 'set') { addEntry(v); return; }
    if (entryMode === 'target') { setTargetAmount(String(v)); return; }
    // Borçta "ödeme" bakiyeyi düşürür, "çıkar" diğer hedeflerde düşürür.
    const at = adjust(entryMode === 'in' ? v : -v);
    useToastStore.getState().show(ec.saved, 'success', { label: ec.undo, onAction: () => undoMove(at) });
  };

  const cardBorder = seasonal.tasarrufMode ? C + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)');

  return (
    <View style={{ backgroundColor: theme.surfaceCard, borderColor: cardBorder, borderWidth: B.thin, borderRadius: R.lg, overflow: 'hidden' }}>
      {/* Başlık + toggle */}
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: applied || expanded ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: R.sm, backgroundColor: C + (seasonal.tasarrufMode ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
            {<Coins size={ICON.md} color={seasonal.tasarrufMode ? C : C + 'aa'} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Tasarruf / Bütçe' : 'Savings / Budget'}</Text>
            {applied && !datePast ? (
              <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '500', marginTop: S.xxs }}>{daysLeft} {tr ? 'gün kaldı' : 'days left'}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{tr ? 'Para hedefine ulaşma planı' : 'Plan to reach a money goal'}</Text>
            )}
          </View>
        </View>
      </View>

      {/* APPLIED: ilerleme + bakiye girişi */}
      {seasonal.tasarrufMode && applied && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          {/* Ara verme ve kat edilen yol — yedi modun ortak satırı (bkz. PlanPauseRow). */}
          <PlanLink slot="tasarruf" />
          <PlanLifecycleRow tr={tr} accent={C} accentText={C_TX} lifecycle={lifecycle} hasPlan={applied} />
          <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: C + '22', padding: S.md, gap: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{seasonal.tasarrufName}</Text>
              <Touchable accessibilityRole="button" onPress={() => { haptic.commit(); Alert.alert(tr ? 'Hedefi Sil' : 'Delete Goal', tr ? 'Plan ve tüm bütçe kayıtların silinecek. Bu işlem geri alınamaz.' : 'Your plan and all budget entries will be deleted. This cannot be undone.', [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat' : 'Close', style: 'destructive', onPress: closePlan }]); }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Kapat' : 'Close'}</Text>
              </Touchable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Hedefe ilerleme' : 'Goal progress'}</Text>
              <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '700' }}>{cur}{fmtMoney(doneAmt)}/{cur}{fmtMoney(goalAmt)} · {pct}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: R.xs, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: R.xs, width: `${pct}%`, backgroundColor: C }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'Başlangıç' : 'Start'}: {cur}{fmtMoney(start)}</Text>
              <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700' }}>{cur}{fmtMoney(latest)}</Text>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'Hedef' : 'Target'}: {cur}{fmtMoney(target)}</Text>
            </View>
          </View>

          {/* Hedefe varınca ya da süre dolunca kart sessiz kalmaz (2026-11-05, mod senaryoları). */}
          {pct >= 100 && (
            <Text style={{ color: C_TX, fontSize: F.footnote, fontWeight: '700', textAlign: 'center' }}>{budgetType === 'borc' ? ec.cleared : ec.reached}</Text>
          )}
          {datePast && pct < 100 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Text style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.footnote }}>{ec.timeUp}</Text>
              <Touchable accessibilityRole="button" onPress={() => { const d = new Date(); d.setMonth(d.getMonth() + 3); setSeasonalPref('tasarrufDate', d.toISOString()); }} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: S.smd, borderRadius: R.full, backgroundColor: C + '1F' }}>
                <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '700' }}>{ec.extend}</Text>
              </Touchable>
            </View>
          )}
          {showEntry ? (
            <View style={{ gap: S.xs }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{entryLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={{ flex: 1 }}>{moneyInput(entryInput, setEntryInput, true)}</View>
              <Touchable accessibilityRole="button" hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }} onPress={saveEntry} style={{ backgroundColor: C, borderRadius: R.full, paddingHorizontal: S.md, height: 36, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C_ON, fontWeight: '700', fontSize: F.caption }}>{tr ? 'Kaydet' : 'Save'}</Text></Touchable>
              <Touchable accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => { setShowEntry(false); setEntryInput(''); }} style={{ padding: S.xs }}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'İptal' : 'Cancel'}</Text></Touchable>
            </View>
            </View>
          ) : (
            <View style={{ gap: S.xs }}>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {([
                  { k: 'in' as const, label: isDebt ? ec.debtAddBtn : ec.addBtn, Ic: Plus },
                  { k: 'out' as const, label: isDebt ? ec.debtOutBtn : ec.outBtn, Ic: Minus },
                ]).map(({ k, label, Ic }) => (
                  <Touchable key={k} accessibilityRole="button" onPress={() => { setEntryMode(k); setShowEntry(true); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, minHeight: 44, borderRadius: R.md, backgroundColor: C + '12' }}>
                    <Ic size={ICON.sm} color={C} />
                    <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '600' }}>{label}</Text>
                  </Touchable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S.lg }}>
                <Touchable accessibilityRole="button" onPress={() => { setEntryMode('set'); setShowEntry(true); }} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{ec.fix}</Text>
                </Touchable>
                {!isDebt && (
                  <Touchable accessibilityRole="button" onPress={() => { setEntryMode('target'); setShowEntry(true); }} style={{ minHeight: 40, justifyContent: 'center' }}>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{ec.goal}</Text>
                  </Touchable>
                )}
              </View>
              {(moves ?? []).slice(0, 3).map(m => (
                <View key={m.at} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{new Date(m.at).toLocaleDateString(ec.locale, { day: 'numeric', month: 'short' })}</Text>
                  <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{m.delta >= 0 ? '+' : '−'}{cur}{fmtMoney(Math.abs(m.delta))}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* CONFIG: tür + tutarlar + süre + uygula */}
      {seasonal.tasarrufMode && !applied && expanded && (
        <FormReveal style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'Hedef türünü seç' : 'Select goal type'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
            {TYPES.map(t => {
              const active = budgetType === t.key;
              return (
                <Touchable accessibilityRole="button" accessibilityState={{ selected: active }} key={t.key} onPress={() => { haptic.select(); setBudgetType(active ? '' : t.key); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.sm + 2, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  {renderModeEmojiIcon(t.emoji, 14, active ? C : theme.onSurfaceVariant)}
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{tr ? t.tr : t.en}</Text>
                </Touchable>
              );
            })}
          </View>
          {budgetType === 'birikim' && (
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }}>{tr ? `Şu anki birikim ${cur}` : `Current savings ${cur}`}</Text>
                {moneyInput(startAmount, setStartAmount)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }}>{tr ? `Hedef tutar ${cur}` : `Target amount ${cur}`}</Text>
                {moneyInput(targetAmount, setTargetAmount)}
              </View>
            </View>
          )}
          {budgetType === 'borc' && (
            <View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }}>{tr ? `Toplam borcun ${cur}` : `Total debt ${cur}`}</Text>
              {moneyInput(startAmount, setStartAmount)}
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xs }}>{tr ? `Hedef: borcu sıfırlamak (${cur}0)` : `Goal: clear the debt (${cur}0)`}</Text>
            </View>
          )}
          {budgetType === 'acilfon' && (
            <View style={{ gap: S.sm }}>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }}>{tr ? `Aylık giderin ${cur}` : `Monthly expenses ${cur}`}</Text>
                  {moneyInput(monthlyExpense, setMonthlyExpense)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }}>{tr ? `Şu anki birikim ${cur}` : `Current savings ${cur}`}</Text>
                  {moneyInput(startAmount, setStartAmount)}
                </View>
              </View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'Kaç aylık güvence?' : 'Months of coverage?'}</Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {[3, 6, 9, 12].map(m => {
                  const active = coverMonths === m;
                  return (
                    <Touchable accessibilityRole="button" accessibilityState={{ selected: active }} key={m} onPress={() => { haptic.select(); setCoverMonths(m); }} style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: active ? C : theme.onSurfaceVariant }}>{m} {tr ? 'ay' : 'mo'}</Text>
                    </Touchable>
                  );
                })}
              </View>
              {monthlyExp > 0 && (
                <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '700' }}>{tr ? `🎯 Hedef: ${cur}${fmtMoney(computedTarget)}` : `🎯 Target: ${cur}${fmtMoney(computedTarget)}`}</Text>
              )}
            </View>
          )}
          {/* ÖNCE TÜR SEÇİLMELİ — bu soru ve not alanı, tür-özel alanlarla (birikim/borç/
              acil fon) AYNI koşula bağlı. Eskiden koşulsuzdu: kullanıcı üstten hiçbir tür
              seçmeden buraya gelip çip seçebiliyor, sonra "önce tür seç" demesi gereken
              buton anlaşılmaz bir hata gösteriyordu (bkz. disabledHint düzeltmesi). */}
          {!!budgetType && (
            <>
              <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'En çok nerede fazladan harcıyorsun? (opsiyonel)' : 'Where do you overspend the most? (optional)'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                {(['disarida_yemek', 'online_alisveris', 'abonelikler', 'eglence_hobi'] as const).map(key => {
                  const active = spendingArea === key;
                  return (
                    <Touchable accessibilityRole="button" accessibilityState={{ selected: active }} key={key} onPress={() => { haptic.select(); setSpendingArea(active ? '' : key); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{spendingAreaLabel(key, tr)}</Text>
                    </Touchable>
                  );
                })}
              </View>
              <ModeField
                accent={C}
                value={planSpecs.tasarruf?.personalNote ?? ''}
                onChangeText={(v) => setPersonalNote('tasarruf', v)}
                placeholder={tr ? 'Not ekle (isteğe bağlı)' : 'Add a note (optional)'}
                maxLength={140}
              />
            </>
          )}
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'Süre' : 'Duration'}</Text>
          <View style={{ flexDirection: 'row', gap: S.xs }}>
            {DURATIONS.map(m => {
              const active = durationMonths === m;
              return (
                <Touchable accessibilityRole="button" accessibilityState={{ selected: active }} key={m} onPress={() => { haptic.select(); setDurationMonths(m); }} style={{ flex: 1, alignItems: 'center', paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: active ? C : theme.onSurfaceVariant }}>{m} {tr ? 'ay' : 'mo'}</Text>
                </Touchable>
              );
            })}
          </View>
          {!!disabledHint && (
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, textAlign: 'center', marginTop: S.xs }}>
              {disabledHint}
            </Text>
          )}
          <Touchable accessibilityRole="button" disabled={!configValid} onPress={apply} style={{ marginTop: S.xs, backgroundColor: configValid ? C : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), borderRadius: R.full, paddingVertical: S.sm + 2, alignItems: 'center' }}>
            <Text style={{ color: configValid ? C_ON : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body }}>{tr ? 'Planı Uygula' : 'Apply Plan'}</Text>
          </Touchable>
        </FormReveal>
      )}
      {/* Sağlık/finans verisi sunucuya gitmez — kullanıcı bunu veriyi girerken bilsin (bkz. DeviceOnlyNote). */}
      {seasonal.tasarrufMode && <DeviceOnlyNote kind="budget" />}
      {seasonal.tasarrufMode && (
        <ModeCardClose
          mode="tasarruf"
          hasItems={applied}
          onClose={() => { if (applied) closeModeWithUndo('tasarruf', closePlan, tr ? 'Tasarruf modu kapatıldı' : 'Savings mode closed', tr ? 'Geri al' : 'Undo'); else { setSeasonalPref('tasarrufMode', false); setExpanded(false); } }}
        />
      )}
    </View>
  );
}
