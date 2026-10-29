/**
 * BirakmaCard — Bırakma modu kartı (ÇOKLU). Aynı anda birden çok şey bırakılabilir;
 * her biri kendi "X gün temiz" serisi + nüks (şefkatli sıfırlama) ile takip edilir.
 */
import React, { useState, useRef } from 'react';
import { View, Text, Switch } from 'react-native';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useQuitStore, getCleanDays, QUIT_MILESTONES, type QuitType } from '@/shared/store/useQuitStore';
import { useHabitStore, fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { usePlanAdaptations, makeClientKey } from '@/features/modes/hooks/usePlanAdaptations';
import { TaskService } from '@/shared/services/api';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { DeviceOnlyNote } from '@/features/modes/components/DeviceOnlyNote';
import { FormReveal, ModeField } from '../ModeField';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { ICON, S, R, F, B } from '@/shared/constants/tokens';
import { buildBirakmaPlan, birakmaTypeTasks, birakmaTypeLabel, BIRAKMA_COLOR, triggerLabel, type TriggerId } from '@/shared/utils/lifeModePlans';
import { retirePlanTask , retireModeTasksByTag} from '@/features/modes/utils/planTaskOps';
import { swallow } from '@/shared/utils/swallow';
import { Ban, Shield } from 'lucide-react-native';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { closeModeWithUndo } from '@/features/modes/utils/modeUndo';
import { PlanLifecycleRow } from '@/features/modes/components/PlanPauseRow';
import { usePlanLifecycle } from '@/features/modes/hooks/usePlanLifecycle';
import { haptic } from '@/shared/utils/haptics';
import { roomLeft } from '@/features/habits/utils/habitLimit';
import { HABIT_LIMIT_COPY } from '@/features/habits/utils/habitLimitCopy';

export function BirakmaCard() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  // Yüzey vurgusu tema-duyarlı palet + AA geçen metin tonu.
  const { accent: C, accentText: C_TX, onAccent: C_ON } = useModeAccent('birakma');

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const birakmaPlanHabitIds = usePrefsStore(s => s.birakmaPlanHabitIds);
  const birakmaPlanTaskIds = usePrefsStore(s => s.birakmaPlanTaskIds);
  const setPlanIds = usePrefsStore(s => s.setPlanIds);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planSpecs = usePrefsStore(s => s.planSpecs);
  const setPersonalNote = usePrefsStore(s => s.setPersonalNote);

  const { items, addItem, removeItem, recordRelapse, reset } = useQuitStore();
  const habits = useHabitStore(s => s.habits);
  const addHabit = useHabitStore(s => s.addHabit);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const toggleDate = useHabitStore(s => s.toggleDate);
  const { runAdaptations } = usePlanAdaptations();

  const [expanded, setExpanded] = useState(() => useQuitStore.getState().items.length === 0);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [customName, setCustomName] = useState('');
  // "Tetikleyicin ne?" — QuitType'tan AYRI, opsiyonel ikinci soru (bkz. lifeModePlans.ts
  // trigger notu). Türden bağımsız BAZ plana TEK ek görev olarak eklenir — birden çok
  // tür seçilse de tekrarlanmaz.
  const [trigger, setTrigger] = useState<TriggerId>('');

  const applied = items.length > 0;
  // Bırakmanın hedef TARİHİ yok (ölçüsü seridir) — geri sayım da yok, yol sayısı var.
  const lifecycle = usePlanLifecycle('birakma', null, birakmaPlanHabitIds);
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

  // Sunucu tarafı idempotency — bkz. usePlanAdaptations.ts `makeClientKey` notu:
  // aynı kullanıcı + aynı anahtar + tamamlanmamışsa sunucu yenisini oluşturmaz.
  // İstemci tarafındaki `applyingRef` kilidinin yanına ikinci bir güvenlik ağı.
  const createPlanTask = async (rawPayload: any): Promise<number | null> => {
    const payload = { ...rawPayload, clientKey: rawPayload.clientKey ?? makeClientKey(rawPayload) };
    if (!useNetworkStore.getState().isOnline) {
      const tempId = -Date.now() - Math.floor(Math.random() * 1000);
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
      useTaskStore.getState().addTask({ ...payload, id: tempId });
      return tempId;
    }
    try { const t = await TaskService.createTask(payload); if (t?.id) { useTaskStore.getState().addTask(t); return t.id; } } catch (e) { swallow('BirakmaCard.createTask', e, { capture: true }); }
    return null;
  };

  // Temel (paylaşılan, türden bağımsız) planı yoksa bir kez oluşturur; ister yeni
  // ister var olan, güncel id'leri döndürür ki çağıran tipe özel görevleri ekleyip
  // tek bir setPlanIds ile birleştirebilsin.
  const ensureBasePlan = async (): Promise<{ habitIds: string[]; taskIds: number[] }> => {
    if (birakmaPlanHabitIds.length > 0 || birakmaPlanTaskIds.length > 0) {
      return { habitIds: [...birakmaPlanHabitIds], taskIds: [...birakmaPlanTaskIds] };
    }
    const content = buildBirakmaPlan('' as QuitType, trigger);
    const habitIds: string[] = [];
    // Alışkanlık sınırı (madde 6): yalnız yer kadarı eklenir, fazlası için neden anlatılır.
    const room = roomLeft(useHabitStore.getState().habits);
    if (content.habits.length > room) {
      const lc = HABIT_LIMIT_COPY[useLanguageStore.getState().language === 'en' ? 'en' : 'tr'];
      Alert.alert(lc.fullTitle, lc.fullBody);
    }
    content.habits.slice(0, room).forEach((h, i) => {
      const id = `habit_birakma_${i}_${Date.now()}`;
      addHabit(h.name, h.emoji, h.color, id, 'birakma');
      habitIds.push(id);
    });
    const taskIds: number[] = [];
    const birakmaLabel = tr ? 'Bırakma' : 'Quit';
    for (const t of content.tasks) {
      let taskTitleTr = t.title;
      let taskTitleEn = t.titleEn;
      if (birakmaLabel) {
        const bLower = birakmaLabel.toLowerCase();
        if (!taskTitleTr.toLowerCase().includes(bLower)) taskTitleTr = `${birakmaLabel}: ${taskTitleTr}`;
        if (!taskTitleEn.toLowerCase().includes(bLower)) taskTitleEn = `${birakmaLabel}: ${taskTitleEn}`;
      }
      const id = await createPlanTask({
        title: tr ? taskTitleTr : taskTitleEn,
        description: JSON.stringify({ tr: taskTitleTr, en: taskTitleEn, descTr: t.desc, descEn: t.descEn }),
        priority: t.priority,
        isCompleted: false,
        tags: t.tags
      });
      if (id != null) taskIds.push(id);
    }
    return { habitIds, taskIds };
  };

  const refreshName = () => {
    const list = useQuitStore.getState().items;
    const name = list.length ? list[0].name + (list.length > 1 ? ` +${list.length - 1}` : '') : '';
    setSeasonalPref('birakmaName', name);
  };

  /*
    ÇİFT DOKUNUŞ KİLİDİ — bkz. TurkishModeBanner.tsx `applyingRef`: aynı kalıp.
    `addSelected` birden çok `await` içeriyor; hızlı iki dokunuş sunucuda İKİ KEZ
    aynı plan görevlerini oluşturabilirdi.
  */
  const applyingRef = useRef(false);
  const addSelected = async () => {
    if (!addValid || applyingRef.current) return;
    applyingRef.current = true;
    try {
    haptic.success();
    const { habitIds, taskIds } = await ensureBasePlan();
    // Yeni seçilen her tür için TİPE ÖZEL görevleri paylaşılan plana ekle.
    // (Tür çipleri zaten eklenmişse devre dışı → aynı türün görevleri tekrarlanmaz.)
    for (const k of selectedKeys) {
      for (const t of birakmaTypeTasks(k)) {
        const id = await createPlanTask({
          title: tr ? t.title : t.titleEn,
          description: JSON.stringify({ tr: t.title, en: t.titleEn, descTr: t.desc, descEn: t.descEn }),
          priority: t.priority,
          isCompleted: false,
          tags: t.tags
        });
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
    } finally {
      applyingRef.current = false;
    }
  };

  const closePlan = () => {
    birakmaPlanHabitIds.forEach(id => removeHabit(id));
    birakmaPlanTaskIds.forEach(id => retirePlanTask(id, 'birakma'));
    // ETIKET TABANLI SUPURME — id listesine bakmadan moda ait HER seyi kaldirir.
    // Yukaridaki id-tabanli temizlik yalnizca 'bildigimiz' gorevleri siler; bir
    // gorev o listeden dusmusse (offline tempId kaymasi, basarisiz silme) ekranda
    // kaliyordu ve ancak bir sonraki UYGULAMA ACILISINDA siliniyordu. Kullanicinin
    // gordugu: "modu kapattim ama gorevi hala duruyor".
    retireModeTasksByTag('birakma', seasonal.birakmaName);
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
        { text: tr ? 'Yeniden başla' : 'Restart', style: 'destructive', onPress: () => { recordRelapse(id); haptic.destructive(); } },
      ],
    );
  };

  const emojiOf = (type: QuitType) => TYPES.find(t => t.key === type)?.emoji ?? '✨';
  const cardBorder = seasonal.birakmaMode ? C + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)');

  return (
    <View style={{ backgroundColor: theme.surfaceCard, borderColor: cardBorder, borderWidth: B.thin, borderRadius: R.lg, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: applied || expanded ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: R.sm, backgroundColor: C + (seasonal.birakmaMode ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
            {<Ban size={ICON.md} color={seasonal.birakmaMode ? C : C + 'aa'} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Bırakma' : 'Quit'}</Text>
            {applied ? (
              <Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '500', marginTop: S.xxs }}>{items.length} {tr ? 'aktif takip' : 'active'}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{tr ? 'Bir veya daha fazla şeyi bırak' : 'Quit one or more things'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.birakmaMode}
            onValueChange={(v) => {
              haptic.select();
              if (v) { setSeasonalPref('birakmaMode', true); setExpanded(true); }
              else if (seasonal.birakmaMode) {
                const hasItems = birakmaPlanHabitIds.length > 0 || birakmaPlanTaskIds.length > 0 || items.length > 0;
                if (!hasItems) { closePlan(); return; }
                Alert.alert(
                  tr ? 'Bırakma Modu Kapatılıyor' : 'Turning off Quit Mode',
                  tr ? 'Eklenen tüm takip alışkanlıkları ve görevler kaldırılacak. Emin misin?' : 'All added tracking habits and tasks will be removed. Are you sure?',
                  [
                    { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
                    { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: () => closeModeWithUndo('birakma', closePlan, tr ? 'Bırakma modu kapatıldı' : 'Quit mode closed', tr ? 'Geri al' : 'Undo') },
                  ]
                );
              }
            }}
            trackColor={{ false: theme.surfaceContainerHighest, true: theme.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* APPLIED: her bırakma kendi serisiyle */}
      {seasonal.birakmaMode && applied && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          {/* Ara verme ve kat edilen yol — yedi modun ortak satırı (bkz. PlanPauseRow). */}
          <PlanLifecycleRow tr={tr} accent={C} accentText={C_TX} lifecycle={lifecycle} hasPlan={applied} />
          {items.map(it => {
            const days = getCleanDays(it.start);
            const next = QUIT_MILESTONES.find(m => m > days - 1) ?? null;
            return (
              <View key={it.id} style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: C + '22', padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ width: 38, height: 38, borderRadius: R.md, backgroundColor: C + (isDark ? '22' : '15'), alignItems: 'center', justifyContent: 'center' }}>
                  {renderModeEmojiIcon(emojiOf(it.type), 19, C)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{it.name}</Text>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600', marginTop: S.xxs }}>
                    {tr ? 'En uzun' : 'Best'}: {Math.max(it.bestStreak, days)}{tr ? 'g' : 'd'}{next ? ` · ${tr ? 'sonraki' : 'next'} ${next}${tr ? 'g' : 'd'}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', minWidth: 44 }}>
                  <Text style={{ color: C, fontWeight: '700', fontSize: 26, lineHeight: 28, letterSpacing: -0.5 }}>{days}</Text>
                  <Text style={{ color: C, fontSize: F.caption, fontWeight: '700', opacity: 0.8, letterSpacing: 0.5 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
                </View>
                <View style={{ gap: S.sm, marginLeft: S.xs }}>
                  <Touchable onPress={() => onRelapse(it.id, it.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.callout }}>↺</Text></Touchable>
                  <Touchable onPress={() => { haptic.surface(); removeOne(it.id); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: theme.onSurfaceMuted, fontSize: F.callout }}>✕</Text></Touchable>
                </View>
              </View>
            );
          })}

          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.xs + 2, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: doneToday ? C + '15' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'), borderWidth: B.thin, borderColor: doneToday ? C + '40' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }}
          >
            <Shield size={ICON.xs} color={doneToday ? C : theme.onSurfaceVariant} />
            <Text style={{ color: doneToday ? C : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>
              {doneToday 
                ? (tr ? 'Bugün Temiz ✓ (Aksiyondan senkronize)' : 'Clean Today ✓ (Synced from Action Center)') 
                : (tr ? 'Sayaç otomatik ilerler · Takip Aksiyon Merkezi\'nde' : 'Auto-counter active · Managed in Action Center')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Touchable onPress={() => { haptic.select(); setExpanded(e => !e); }}><Text style={{ color: C_TX, fontSize: F.caption, fontWeight: '700' }}>{expanded ? (tr ? 'Kapat' : 'Close') : (tr ? '＋ Başka bir şey bırak' : '＋ Quit something else')}</Text></Touchable>
            <Touchable onPress={() => { haptic.commit(); Alert.alert(tr ? 'Tümünü Kapat' : 'Close All', tr ? 'Bırakma planı tamamen kapatılsın mı?' : 'Close the entire quit plan?', [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat' : 'Close', style: 'destructive', onPress: closePlan }]); }}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Tümünü kapat' : 'Close all'}</Text></Touchable>
          </View>
        </View>
      )}

      {/* CONFIG: çoklu seçim */}
      {seasonal.birakmaMode && expanded && (
        <FormReveal style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'Neyi bırakıyorsun? (çoklu seçilebilir)' : 'What are you quitting? (multi-select)'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
            {TYPES.map(t => {
              const active = !!sel[t.key];
              const already = items.some(i => i.type === t.key) && t.key !== 'ozel';
              return (
                <Touchable key={t.key} disabled={already} onPress={() => { haptic.select(); setSel(s => ({ ...s, [t.key]: !s[t.key] })); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.sm + 2, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.medium, opacity: already ? 0.4 : 1, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                  {renderModeEmojiIcon(t.emoji, 14, active ? C : theme.onSurfaceVariant)}
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{tr ? t.tr : t.en}{already ? ' ✓' : ''}</Text>
                </Touchable>
              );
            })}
          </View>
          {sel['ozel'] && (
            <ModeField accent={C} value={customName} onChangeText={setCustomName} placeholder={tr ? 'Ne? (ör. Kahve)' : 'What? (e.g. Coffee)'} maxLength={24} returnKeyType="done" />
          )}
          {/* ÖNCE en az bir tür seçilmeli — TasarrufCard'daki aynı düzeltme: bir soru,
              üstte hiçbir seçim yapılmadan görünmemeli (bkz. o dosyadaki not). */}
          {!applied && selectedKeys.length > 0 && (
            <>
              <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'En büyük tetikleyicin ne? (opsiyonel)' : "What's your biggest trigger? (optional)"}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                {(['stres', 'sosyal_ortam', 'can_sikintisi', 'otomatik_pilot'] as const).map(key => {
                  const active = trigger === key;
                  return (
                    <Touchable key={key} onPress={() => { haptic.select(); setTrigger(active ? '' : key); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? C : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? C + '18' : 'transparent' }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? C : theme.onSurfaceVariant }}>{triggerLabel(key, tr)}</Text>
                    </Touchable>
                  );
                })}
              </View>
            </>
          )}
          <ModeField
            accent={C}
            value={planSpecs.birakma?.personalNote ?? ''}
            onChangeText={(v) => setPersonalNote('birakma', v)}
            placeholder={tr ? 'Not ekle (isteğe bağlı)' : 'Add a note (optional)'}
            maxLength={140}
          />
          <Touchable disabled={!addValid} onPress={addSelected} style={{ marginTop: S.xs, backgroundColor: addValid ? C : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), borderRadius: R.full, paddingVertical: S.sm + 2, alignItems: 'center' }}>
            <Text style={{ color: addValid ? C_ON : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body }}>{applied ? (tr ? 'Ekle' : 'Add') : (tr ? 'Bugünden Başla' : 'Start Today')}</Text>
          </Touchable>
        </FormReveal>
      )}
      {/* Sağlık/finans verisi sunucuya gitmez — kullanıcı bunu veriyi girerken bilsin (bkz. DeviceOnlyNote). */}
      {seasonal.birakmaMode && <DeviceOnlyNote kind="health" />}
    </View>
  );
}
