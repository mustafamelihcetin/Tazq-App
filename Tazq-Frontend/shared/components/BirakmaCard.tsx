/**
 * BirakmaCard — Bırakma modu kartı (ÇOKLU). Aynı anda birden çok şey bırakılabilir;
 * her biri kendi "X gün temiz" serisi + nüks (şefkatli sıfırlama) ile takip edilir.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useQuitStore, getCleanDays, QUIT_MILESTONES, type QuitType } from '@/shared/store/useQuitStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { usePlanAdaptations } from '@/features/modes/hooks/usePlanAdaptations';
import { TaskService } from '@/shared/services/api';
import { CustomAlert as Alert } from './CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { S, R, F, B } from '@/shared/constants/tokens';
import { buildBirakmaPlan, birakmaTypeTasks, birakmaTypeLabel, BIRAKMA_COLOR } from '@/shared/utils/lifeModePlans';

export function BirakmaCard() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const C = BIRAKMA_COLOR;

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const birakmaPlanHabitIds = usePrefsStore(s => s.birakmaPlanHabitIds);
  const birakmaPlanTaskIds = usePrefsStore(s => s.birakmaPlanTaskIds);
  const setPlanIds = usePrefsStore(s => s.setPlanIds);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);

  const { items, addItem, removeItem, recordRelapse, reset } = useQuitStore();
  const habits = useHabitStore(s => s.habits);
  const addHabit = useHabitStore(s => s.addHabit);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const toggleDate = useHabitStore(s => s.toggleDate);
  const { runAdaptations } = usePlanAdaptations();

  const [expanded, setExpanded] = useState(() => useQuitStore.getState().items.length === 0);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');

  const applied = items.length > 0;
  const todayKey = fmtDateKey();
  const checkinHabit = habits.find(h => birakmaPlanHabitIds.includes(h.id) && /temiz|clean/i.test(h.name));
  const doneToday = !!checkinHabit && (checkinHabit.completedDates ?? []).includes(todayKey);

  const TYPES: { key: Exclude<QuitType, ''>; emoji: string; tr: string; en: string }[] = [
    { key: 'sigara', emoji: '🚬', tr: 'Sigara', en: 'Smoking' },
    { key: 'sosyal', emoji: '📱', tr: 'Sosyal Medya', en: 'Social Media' },
    { key: 'seker', emoji: '🍬', tr: 'Şeker', en: 'Sugar' },
    { key: 'alkol', emoji: '🍷', tr: 'Alkol', en: 'Alcohol' },
    { key: 'kumar', emoji: '🎲', tr: 'Kumar', en: 'Gambling' },
    { key: 'ozel', emoji: '✨', tr: 'Özel', en: 'Custom' },
  ];

  const selectedKeys = TYPES.filter(t => sel[t.key]).map(t => t.key);
  const addValid = selectedKeys.length > 0 && (!sel['ozel'] || customName.trim().length > 0);

  const createPlanTask = async (payload: any): Promise<number | null> => {
    if (!useNetworkStore.getState().isOnline) {
      const tempId = -Date.now() - Math.floor(Math.random() * 1000);
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
      useTaskStore.getState().addTask({ ...payload, id: tempId });
      return tempId;
    }
    try { const t = await TaskService.createTask(payload); if (t?.id) { useTaskStore.getState().addTask(t); return t.id; } } catch {}
    return null;
  };

  // Temel (paylaşılan, türden bağımsız) planı yoksa bir kez oluşturur; ister yeni
  // ister var olan, güncel id'leri döndürür ki çağıran tipe özel görevleri ekleyip
  // tek bir setPlanIds ile birleştirebilsin.
  const ensureBasePlan = async (): Promise<{ habitIds: string[]; taskIds: number[] }> => {
    if (birakmaPlanHabitIds.length > 0 || birakmaPlanTaskIds.length > 0) {
      return { habitIds: [...birakmaPlanHabitIds], taskIds: [...birakmaPlanTaskIds] };
    }
    const content = buildBirakmaPlan('' as QuitType);
    const habitIds: string[] = [];
    content.habits.forEach((h, i) => {
      const id = `habit_birakma_${i}_${Date.now()}`;
      addHabit(h.name, h.emoji, h.color, id, 'birakma');
      habitIds.push(id);
    });
    const taskIds: number[] = [];
    for (const t of content.tasks) {
      const id = await createPlanTask({ title: tr ? t.title : t.titleEn, description: '', priority: t.priority, isCompleted: false, tags: t.tags });
      if (id != null) taskIds.push(id);
    }
    return { habitIds, taskIds };
  };

  const refreshName = () => {
    const list = useQuitStore.getState().items;
    const name = list.length ? list[0].name + (list.length > 1 ? ` +${list.length - 1}` : '') : '';
    setSeasonalPref('birakmaName', name);
  };

  const addSelected = async () => {
    if (!addValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { habitIds, taskIds } = await ensureBasePlan();
    // Yeni seçilen her tür için TİPE ÖZEL görevleri paylaşılan plana ekle.
    // (Tür çipleri zaten eklenmişse devre dışı → aynı türün görevleri tekrarlanmaz.)
    for (const k of selectedKeys) {
      for (const t of birakmaTypeTasks(k)) {
        const id = await createPlanTask({ title: tr ? t.title : t.titleEn, description: '', priority: t.priority, isCompleted: false, tags: t.tags });
        if (id != null) taskIds.push(id);
      }
    }
    setPlanIds('birakma', habitIds, taskIds);
    setSeasonalPref('birakmaMode', true);
    selectedKeys.forEach(k => {
      const label = k === 'ozel' ? customName.trim() : birakmaTypeLabel(k, tr);
      if (k === 'ozel' && !label) return;
      addItem(k, label);
    });
    refreshName();
    setSel({}); setCustomName(''); setExpanded(false);
    setTimeout(() => runAdaptations(true), 300);
  };

  const closePlan = () => {
    birakmaPlanHabitIds.forEach(id => removeHabit(id));
    clearPlanIds('birakma');
    setSeasonalPref('birakmaMode', false);
    setSeasonalPref('birakmaName', '');
    reset();
    setExpanded(false);
  };

  const removeOne = (id: string) => {
    removeItem(id);
    const remaining = useQuitStore.getState().items;
    if (remaining.length === 0) closePlan();
    else refreshName();
  };

  const onRelapse = (id: string, name: string) => {
    Alert.alert(
      tr ? 'Nüks oldu mu?' : 'Slipped?',
      tr ? `"${name}" sayacı bugünden yeniden başlasın mı? Sorun değil — en uzun serin korunur.` : `Restart "${name}" from today? It's okay — your best streak is kept.`,
      [
        { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
        { text: tr ? 'Yeniden başla' : 'Restart', style: 'destructive', onPress: () => { recordRelapse(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
      ],
    );
  };

  const emojiOf = (type: QuitType) => TYPES.find(t => t.key === type)?.emoji ?? '✨';
  const cardBorder = seasonal.birakmaMode ? C + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)');

  return (
    <View style={{ backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: cardBorder, borderWidth: B.thin, borderRadius: R.lg, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: applied || expanded ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C + (seasonal.birakmaMode ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('🚭', 18, seasonal.birakmaMode ? C : C + 'aa')}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Bırakma' : 'Quit'}</Text>
            {applied ? (
              <Text style={{ color: C, fontSize: F.caption, fontWeight: '500', marginTop: 1 }}>{items.length} {tr ? 'aktif takip' : 'active'}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{tr ? 'Bir veya daha fazla şeyi bırak' : 'Quit one or more things'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.birakmaMode}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (v) { setSeasonalPref('birakmaMode', true); setExpanded(true); }
              else { applied ? closePlan() : (setSeasonalPref('birakmaMode', false), setExpanded(false)); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: C }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* APPLIED: her bırakma kendi serisiyle */}
      {seasonal.birakmaMode && applied && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          {items.map(it => {
            const days = getCleanDays(it.start);
            const next = QUIT_MILESTONES.find(m => m > days - 1) ?? null;
            return (
              <View key={it.id} style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: C + '22', padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C + (isDark ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
                  {renderModeEmojiIcon(emojiOf(it.type), 19, C)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{it.name}</Text>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                    {tr ? 'En uzun' : 'Best'}: {Math.max(it.bestStreak, days)}{tr ? 'g' : 'd'}{next ? ` · ${tr ? 'sonraki' : 'next'} ${next}${tr ? 'g' : 'd'}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', minWidth: 44 }}>
                  <Text style={{ color: C, fontWeight: '800', fontSize: 26, lineHeight: 28, letterSpacing: -0.5 }}>{days}</Text>
                  <Text style={{ color: C, fontSize: 9, fontWeight: '700', opacity: 0.8, letterSpacing: 0.5 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
                </View>
                <View style={{ gap: 8, marginLeft: 4 }}>
                  <Touchable onPress={() => onRelapse(it.id, it.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 16 }}>↺</Text></Touchable>
                  <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeOne(it.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 16, opacity: 0.6 }}>✕</Text></Touchable>
                </View>
              </View>
            );
          })}

          {/* Paylaşılan günlük check-in */}
          <Touchable
            onPress={() => { if (checkinHabit) { Haptics.impactAsync(doneToday ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); toggleDate(checkinHabit.id, todayKey); } }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm + 2, borderRadius: R.md, backgroundColor: doneToday ? C : C + '12', borderWidth: doneToday ? 0 : B.thin, borderColor: C + '30' }}
          >
            {renderModeEmojiIcon('🛡️', 15, doneToday ? '#fff' : C)}
            <Text style={{ color: doneToday ? '#fff' : C, fontSize: F.caption, fontWeight: '700' }}>{doneToday ? (tr ? 'Bugün temiz ✓' : 'Clean today ✓') : (tr ? 'Bugünü temiz işaretle' : 'Mark today clean')}</Text>
          </Touchable>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(e => !e); }}><Text style={{ color: C, fontSize: F.caption, fontWeight: '700' }}>{expanded ? (tr ? 'Kapat' : 'Close') : (tr ? '＋ Başka bir şey bırak' : '＋ Quit something else')}</Text></Touchable>
            <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(tr ? 'Tümünü Kapat' : 'Close All', tr ? 'Bırakma planı tamamen kapatılsın mı?' : 'Close the entire quit plan?', [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat' : 'Close', style: 'destructive', onPress: closePlan }]); }}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Tümünü kapat' : 'Close all'}</Text></Touchable>
          </View>
        </View>
      )}

      {/* CONFIG: çoklu seçim */}
      {seasonal.birakmaMode && expanded && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Neyi bırakıyorsun? (çoklu seçilebilir)' : 'What are you quitting? (multi-select)'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
            {TYPES.map(t => {
              const active = !!sel[t.key];
              const already = items.some(i => i.type === t.key) && t.key !== 'ozel';
              return (
                <Touchable key={t.key} disabled={already} onPress={() => { Haptics.selectionAsync(); setSel(s => ({ ...s, [t.key]: !s[t.key] })); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.sm + 2, paddingVertical: 8, borderRadius: R.full, borderWidth: B.medium, opacity: already ? 0.4 : 1, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  {renderModeEmojiIcon(t.emoji, 14, active ? C : theme.onSurfaceVariant)}
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{tr ? t.tr : t.en}{already ? ' ✓' : ''}</Text>
                </Touchable>
              );
            })}
          </View>
          {sel['ozel'] && (
            <TextInput value={customName} onChangeText={setCustomName} placeholder={tr ? 'Ne? (ör. Kahve)' : 'What? (e.g. Coffee)'} placeholderTextColor={theme.onSurfaceVariant + '70'} underlineColorAndroid="transparent" maxLength={24} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600', height: 44, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingHorizontal: S.md }} />
          )}
          <Touchable disabled={!addValid} onPress={addSelected} style={{ marginTop: 4, backgroundColor: addValid ? C : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), borderRadius: R.full, paddingVertical: S.sm + 2, alignItems: 'center' }}>
            <Text style={{ color: addValid ? '#fff' : theme.onSurfaceVariant, fontWeight: '800', fontSize: F.body }}>{applied ? (tr ? 'Ekle' : 'Add') : (tr ? 'Bugünden Başla' : 'Start Today')}</Text>
          </Touchable>
        </View>
      )}
    </View>
  );
}
