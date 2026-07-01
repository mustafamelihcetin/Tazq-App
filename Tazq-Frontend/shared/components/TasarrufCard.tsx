/**
 * TasarrufCard — Tasarruf/Bütçe modu kartı (Dönemsel Modlar).
 * Kilo kartı deseninin finansal ikizi: başlangıç→hedef tutar + süre, haftalık
 * "bakiyeni gir" (7-gün kilidi), "Hedefe ilerleme ₺X/₺Y · %", deadline sonucu.
 * Kendi içinde kapsüllü: tüm veri store'lardan, plan oluşturma burada.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useBudgetStore, getRecentBudgetEntry, type BudgetType } from '@/shared/store/useBudgetStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { usePlanAdaptations } from '@/features/modes/hooks/usePlanAdaptations';
import { TaskService } from '@/shared/services/api';
import { CustomAlert as Alert } from './CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { S, R, F, B } from '@/shared/constants/tokens';
import { buildTasarrufPlan, tasarrufTypeLabel, TASARRUF_COLOR } from '@/shared/utils/lifeModePlans';
import { retirePlanTask } from '@/shared/utils/planTaskOps';

const fmtMoney = (n: number) => n.toLocaleString('tr-TR');

export function TasarrufCard() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const C = TASARRUF_COLOR;

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const tasarrufPlanHabitIds = usePrefsStore(s => s.tasarrufPlanHabitIds);
  const tasarrufPlanTaskIds = usePrefsStore(s => s.tasarrufPlanTaskIds);
  const setPlanIds = usePrefsStore(s => s.setPlanIds);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);

  const { budgetType, startAmount, targetAmount, log, setBudgetType, setStartAmount, setTargetAmount, addEntry, reset } = useBudgetStore();
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

  const applied = tasarrufPlanHabitIds.length > 0 || tasarrufPlanTaskIds.length > 0;
  const start = parseFloat(startAmount) || 0;
  const target = parseFloat(targetAmount) || 0;
  const latest = log.length ? log.reduce((a, b) => (a.date > b.date ? a : b)).amount : start;
  const goalAmt = Math.abs(target - start);
  const doneAmt = Math.max(0, start > target ? (start - latest) : (latest - start)); // borç: düşüş, birikim: artış
  const pct = goalAmt > 0 ? Math.min(100, Math.round((doneAmt / goalAmt) * 100)) : 0;

  const dateObj = seasonal.tasarrufDate ? new Date(seasonal.tasarrufDate) : null;
  const daysLeft = dateObj ? Math.max(0, Math.ceil((new Date(seasonal.tasarrufDate!).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const datePast = dateObj ? new Date(seasonal.tasarrufDate!).setHours(23, 59, 59, 999) < Date.now() : false;

  const canLog = (() => {
    const r = getRecentBudgetEntry(log, 7);
    return !r;
  })();

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
  const disabledHint = (() => {
    if (configValid) return '';
    if (!durationMonths) return tr ? 'Bir süre seç' : 'Pick a duration';
    if (budgetType === 'borc') return computedStart > 0 ? '' : (tr ? 'Borç tutarını gir' : 'Enter the debt amount');
    if (budgetType === 'acilfon') {
      if (monthlyExp <= 0) return tr ? 'Aylık gideri gir' : 'Enter your monthly expenses';
      return tr ? 'Hedef, mevcut tutardan büyük olmalı' : 'Target must exceed the current amount';
    }
    // birikim
    return tr ? 'Hedef tutar, mevcut birikimden büyük olmalı' : 'Target must be higher than current savings';
  })();
  // ₺ önekli, alt-çizgisiz, ÜST SINIRLI temiz para girişi. Inline fonksiyon (component
  // değil) → her tuşta remount/focus kaybı olmaz.
  // Para girişi: STORE'da ham rakam (parseFloat güvenli), EKRANDA binlik nokta ayracı.
  // Tutarlar tam sayı ₺ (kuruş yok) → en sade ve okunur biçim, üst sınır korunur.
  const MAX_AMOUNT = 1_000_000_000; // 1 milyar ₺ üst sınır
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
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingHorizontal: S.md }}>
      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontWeight: '700', marginRight: 6, opacity: 0.7 }}>₺</Text>
      <TextInput
        value={formatThousands(value)}
        onChangeText={(t) => onChange(sanitizeMoney(t))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.onSurfaceVariant + '70'}
        underlineColorAndroid="transparent"
        maxLength={13}
        autoFocus={autoFocus}
        style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '700', padding: 0 }}
      />
    </View>
  );

  const createPlanTask = async (payload: any): Promise<number | null> => {
    if (!useNetworkStore.getState().isOnline) {
      const tempId = -Date.now() - Math.floor(Math.random() * 1000);
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
      useTaskStore.getState().addTask({ ...payload, id: tempId });
      return tempId;
    }
    try {
      const t = await TaskService.createTask(payload);
      if (t?.id) { useTaskStore.getState().addTask(t); return t.id; }
    } catch { /* sessiz */ }
    return null;
  };

  const apply = async () => {
    if (!configValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const content = buildTasarrufPlan(budgetType);
    const habitIds: string[] = [];
    content.habits.forEach((h, i) => {
      const id = `habit_tasarruf_${i}_${Date.now()}`;
      addHabit(h.name, h.emoji, h.color, id, 'tasarruf');
      habitIds.push(id);
    });
    const taskIds: number[] = [];
    for (const t of content.tasks) {
      const id = await createPlanTask({ title: tr ? t.title : t.titleEn, description: '', priority: t.priority, isCompleted: false, tags: t.tags });
      if (id != null) taskIds.push(id);
    }
    // Haftalık "bakiyeni gir" görevi (bugüne)
    const wId = await createPlanTask({ title: tr ? 'Bu hafta birikimini gir' : 'Log this week\'s balance', description: '', priority: 'Medium', dueDate: new Date().toISOString(), isCompleted: false, tags: ['tasarruf', 'budget_entry'] });
    if (wId != null) taskIds.push(wId);

    const d = new Date(); d.setMonth(d.getMonth() + (durationMonths || 6));
    // Türe özel hesaplanan başlangıç/hedefi store'a yaz (ilerleme kartının kaynağı).
    setStartAmount(String(computedStart));
    setTargetAmount(String(computedTarget));
    setSeasonalPref('tasarrufMode', true);
    setSeasonalPref('tasarrufName', tasarrufTypeLabel(budgetType, tr));
    setSeasonalPref('tasarrufDate', d.toISOString().split('T')[0]);
    if (log.length === 0) addEntry(computedStart); // başlangıç noktası
    setPlanIds('tasarruf', habitIds, taskIds);
    setExpanded(false);
    setTimeout(() => runAdaptations(true), 300);
  };

  const closePlan = () => {
    tasarrufPlanHabitIds.forEach(id => removeHabit(id));
    tasarrufPlanTaskIds.forEach(id => retirePlanTask(id, 'tasarruf'));
    clearPlanIds('tasarruf');
    setSeasonalPref('tasarrufMode', false);
    setSeasonalPref('tasarrufName', '');
    setSeasonalPref('tasarrufDate', null);
    reset();
    setExpanded(false);
  };

  const saveEntry = () => {
    const v = parseFloat(entryInput.replace(',', '.'));
    if (isNaN(v) || v < 0) return;
    if (!canLog) {
      Alert.alert(tr ? 'Zaten girdin' : 'Already logged', tr ? 'Bakiye 7 günde bir girilir.' : 'Balance is logged every 7 days.');
      return;
    }
    addEntry(v);
    setEntryInput(''); setShowEntry(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cardBorder = seasonal.tasarrufMode ? C + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)');

  return (
    <View style={{ backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: cardBorder, borderWidth: B.thin, borderRadius: R.lg, overflow: 'hidden' }}>
      {/* Başlık + toggle */}
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: applied || expanded ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C + (seasonal.tasarrufMode ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('💰', 18, seasonal.tasarrufMode ? C : C + 'aa')}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Tasarruf / Bütçe' : 'Savings / Budget'}</Text>
            {applied && !datePast ? (
              <Text style={{ color: C, fontSize: F.caption, fontWeight: '500', marginTop: 1 }}>{daysLeft} {tr ? 'gün kaldı' : 'days left'}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{tr ? 'Para hedefine ulaşma planı' : 'Plan to reach a money goal'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.tasarrufMode}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (v) { setSeasonalPref('tasarrufMode', true); setExpanded(true); }
              else if (applied) {
                // Kapatma planı + tüm bütçe kayıtlarını siler → önce onay iste.
                Alert.alert(
                  tr ? 'Tasarruf planını kapat?' : 'Close savings plan?',
                  tr ? 'Plan ve tüm bütçe kayıtların silinecek. Bu işlem geri alınamaz.' : 'Your plan and all budget entries will be deleted. This cannot be undone.',
                  [
                    { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
                    { text: tr ? 'Kapat' : 'Close', style: 'destructive', onPress: () => { closePlan(); } },
                  ],
                );
              } else { setSeasonalPref('tasarrufMode', false); setExpanded(false); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: C }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* APPLIED: ilerleme + bakiye girişi */}
      {seasonal.tasarrufMode && applied && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: C + '22', padding: S.md, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{seasonal.tasarrufName}</Text>
              <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(tr ? 'Hedefi Sil' : 'Delete Goal', tr ? 'Plan ve tüm bütçe kayıtların silinecek. Bu işlem geri alınamaz.' : 'Your plan and all budget entries will be deleted. This cannot be undone.', [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat' : 'Close', style: 'destructive', onPress: closePlan }]); }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Kapat' : 'Close'}</Text>
              </Touchable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? 'Hedefe ilerleme' : 'Goal progress'}</Text>
              <Text style={{ color: C, fontSize: 11, fontWeight: '700' }}>₺{fmtMoney(doneAmt)}/₺{fmtMoney(goalAmt)} · {pct}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: C }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>{tr ? 'Başlangıç' : 'Start'}: ₺{fmtMoney(start)}</Text>
              <Text style={{ color: theme.onSurface, fontSize: 11, fontWeight: '700' }}>₺{fmtMoney(latest)}</Text>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>{tr ? 'Hedef' : 'Target'}: ₺{fmtMoney(target)}</Text>
            </View>
          </View>

          {showEntry ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={{ flex: 1 }}>{moneyInput(entryInput, setEntryInput, true)}</View>
              <Touchable onPress={saveEntry} style={{ backgroundColor: C, borderRadius: R.full, paddingHorizontal: S.md, height: 36, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: F.caption }}>{tr ? 'Kaydet' : 'Save'}</Text></Touchable>
              <Touchable onPress={() => { setShowEntry(false); setEntryInput(''); }} style={{ padding: 4 }}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'İptal' : 'Cancel'}</Text></Touchable>
            </View>
          ) : (
            <Touchable disabled={!canLog} onPress={() => { if (canLog) { Haptics.selectionAsync(); setShowEntry(true); } }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm + 2, borderRadius: R.md, backgroundColor: canLog ? C + '12' : 'transparent', borderWidth: canLog ? 0 : B.thin, borderColor: theme.onSurfaceVariant + '20' }}>
              {renderModeEmojiIcon('💰', 14, canLog ? C : theme.onSurfaceVariant)}
              <Text style={{ color: canLog ? C : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{canLog ? (tr ? 'Bu hafta bakiyeni gir' : 'Log this week\'s balance') : (tr ? 'Kaydedildi · sonraki hafta' : 'Logged · next week')}</Text>
            </Touchable>
          )}
        </View>
      )}

      {/* CONFIG: tür + tutarlar + süre + uygula */}
      {seasonal.tasarrufMode && !applied && expanded && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Hedef türünü seç' : 'Select goal type'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
            {TYPES.map(t => {
              const active = budgetType === t.key;
              return (
                <Touchable key={t.key} onPress={() => { Haptics.selectionAsync(); setBudgetType(active ? '' : t.key); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.sm + 2, paddingVertical: 8, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  {renderModeEmojiIcon(t.emoji, 14, active ? C : theme.onSurfaceVariant)}
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{tr ? t.tr : t.en}</Text>
                </Touchable>
              );
            })}
          </View>
          {budgetType === 'birikim' && (
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginBottom: 4 }}>{tr ? 'Şu anki birikim ₺' : 'Current savings ₺'}</Text>
                {moneyInput(startAmount, setStartAmount)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginBottom: 4 }}>{tr ? 'Hedef tutar ₺' : 'Target amount ₺'}</Text>
                {moneyInput(targetAmount, setTargetAmount)}
              </View>
            </View>
          )}
          {budgetType === 'borc' && (
            <View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginBottom: 4 }}>{tr ? 'Toplam borcun ₺' : 'Total debt ₺'}</Text>
              {moneyInput(startAmount, setStartAmount)}
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginTop: 4, opacity: 0.7 }}>{tr ? '🎯 Hedef: borcu sıfırlamak (₺0)' : '🎯 Goal: clear the debt (₺0)'}</Text>
            </View>
          )}
          {budgetType === 'acilfon' && (
            <View style={{ gap: S.sm }}>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginBottom: 4 }}>{tr ? 'Aylık giderin ₺' : 'Monthly expenses ₺'}</Text>
                  {moneyInput(monthlyExpense, setMonthlyExpense)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, marginBottom: 4 }}>{tr ? 'Şu anki birikim ₺' : 'Current savings ₺'}</Text>
                  {moneyInput(startAmount, setStartAmount)}
                </View>
              </View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>{tr ? 'Kaç aylık güvence?' : 'Months of coverage?'}</Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {[3, 6, 9, 12].map(m => {
                  const active = coverMonths === m;
                  return (
                    <Touchable key={m} onPress={() => { Haptics.selectionAsync(); setCoverMonths(m); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: active ? C : theme.onSurfaceVariant }}>{m} {tr ? 'ay' : 'mo'}</Text>
                    </Touchable>
                  );
                })}
              </View>
              {monthlyExp > 0 && (
                <Text style={{ color: C, fontSize: 11, fontWeight: '700' }}>{tr ? `🎯 Hedef: ₺${fmtMoney(computedTarget)}` : `🎯 Target: ₺${fmtMoney(computedTarget)}`}</Text>
              )}
            </View>
          )}
          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11 }}>{tr ? 'Süre' : 'Duration'}</Text>
          <View style={{ flexDirection: 'row', gap: S.xs }}>
            {DURATIONS.map(m => {
              const active = durationMonths === m;
              return (
                <Touchable key={m} onPress={() => { Haptics.selectionAsync(); setDurationMonths(m); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: active ? C : theme.onSurfaceVariant }}>{m} {tr ? 'ay' : 'mo'}</Text>
                </Touchable>
              );
            })}
          </View>
          {!!disabledHint && (
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, textAlign: 'center', marginTop: 4, opacity: 0.8 }}>
              {disabledHint}
            </Text>
          )}
          <Touchable disabled={!configValid} onPress={apply} style={{ marginTop: 4, backgroundColor: configValid ? C : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), borderRadius: R.full, paddingVertical: S.sm + 2, alignItems: 'center' }}>
            <Text style={{ color: configValid ? '#fff' : theme.onSurfaceVariant, fontWeight: '800', fontSize: F.body }}>{tr ? 'Planı Uygula' : 'Apply Plan'}</Text>
          </Touchable>
        </View>
      )}
    </View>
  );
}
