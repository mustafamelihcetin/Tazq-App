import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import Animated from 'react-native-reanimated';
import { Check, Repeat, CheckCircle2, Circle, ChevronUp, ChevronDown } from 'lucide-react-native';
import { isWeightEntryTask } from '@/features/modes/utils/weightCheckin';
import { visibleTextTags, translateTag, getLocalizedTaskTitle, getLocalizedTaskDescription } from '@/features/tasks';
import { getTaskRemainingTime } from '@/features/modes';
import { SwipeableItem } from '@/shared/components/SwipeableItem';
import { ICON, S, R, F, B, HAIRLINE, RSPRING, touchSlop } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { Separator } from '@/shared/components/Separator';
import { describeTask, rowHint, bulkSelectHint } from '@/shared/utils/a11y';
import type { Task } from '@/features/tasks/store/useTaskStore';
import type { getModeInfoForTask } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';
import type { Language, TranslationKeys } from '@/shared/constants/i18n';

export interface TaskListItemProps {
    task: Task;
    /** Listedeki sırası — giriş animasyonunun gecikmesi için. */
    i: number;
    theme: AppTheme;
    isDark: boolean;
    highlightedId: number | null;
    isBulkMode: boolean;
    isSelected: boolean;
    language: Language;
    t: TranslationKeys;
    showSwipePeek: boolean;
    priorityColor: (p: string) => string;
    handleDelete: (id: number) => void;
    handleToggleExpand: (id: number) => void;
    handleLongPress: (id: number) => void;
    handleBulkSelect: (id: number) => void;
    handleToggle: (id: number) => void;
    toggleSubtask: (taskId: number, subtaskIndex: number) => void;
    completingIds: Set<number>;
    expandedId: number | null;
    sortBy: string;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    /** Ebeveynde tek geçişte hesaplanır; kart hiçbir store'a abone olmaz. */
    modeInfo: ReturnType<typeof getModeInfoForTask> | null;
    /**
     * Gruplu listede satırın yeri. Verilmezse satır kendi başına bir karttır
     * (tablet/geniş ekran ızgarası). Bkz. aşağıdaki "GRUPLU LİSTE" notu.
     */
    position?: 'only' | 'first' | 'middle' | 'last';
}

/*
  ── GRUPLU LİSTE — HER GÖREV AYRI KART DEĞİL ─────────────────────────────────
  Her görev kendi kartındaydı: 16pt iç boşluk + 1pt çerçeve + kartlar arası 8pt.
  Ölçüm (393pt telefon): ekrana 6.5 görev sığıyordu; satırın ~%35'i boşluktu.
  Things 3 (wcandillon/can-it-be-done → season3/Things) ve super-productivity'nin
  görev satırı aynı kuralı izliyor — ana ekranın "Günlük Görevlerim" listesi de:
  tek yüzey, satırlar ince ayırıcıyla, tamamla kontrolü SOLDA başlığın önünde.

  Aynı görev uygulamada dört farklı biçimde çiziliyordu (ana ekran: sol halka;
  burası: sağda kare kutu + sol renk çubuğu + gri haplar; Günüm; Haftalık Merkez).
  Bu satır artık ana ekranınkiyle aynı dili konuşuyor (bkz. MyDayTaskRow).
*/
const SIZE = 22;

const copy = (tr: boolean) => tr
    ? { complete: 'Görevi tamamla', undo: 'Görevi tamamlanmadı olarak işaretle', up: 'Yukarı taşı', down: 'Aşağı taşı', weight: 'KİLO', auto: 'OTO', steps: 'adım', dayOne: '1. Gün', clean: (d: number) => `Temiz: ${d} gün`, goal: (d: number) => `Hedef: ${d} gün` }
    : { complete: 'Complete task', undo: 'Mark task as not done', up: 'Move up', down: 'Move down', weight: 'WEIGHT', auto: 'AUTO', steps: 'steps', dayOne: 'Day 1', clean: (d: number) => `Clean: ${d} ${d === 1 ? 'day' : 'days'}`, goal: (d: number) => `Goal: ${d} days` };



/** Görev listesindeki tek satır: kaydırma, çoklu seçim, genişleyen ayrıntı. */
export const MemoizedTaskItem = React.memo((props: TaskListItemProps) => {
    const { task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedId, sortBy, onMoveUp, onMoveDown, modeInfo, position } = props;

    /*
      MOD BİLGİSİ ARTIK PROP — kart artık HİÇBİR store'a abone değil.

      Burada `usePrefsStore()` SEÇİCİSİZ çağrılıyordu, yani her kart tüm tercih
      store'una abone oluyordu. Sonuç, listedeki görev sayısı kadar abonelik ve
      tercihlerde en ufak değişiklikte HEPSİNİN yeniden render edilmesi.

      Görünüm tercihleri (filtre/sıralama/gizleme) kalıcı store'a taşınınca bu gizli
      maliyet açığa çıktı: her filtre dokunuşu bütün kartları yeniden çiziyordu — ve
      liste ne kadar uzunsa dokunuş o kadar geç cevap veriyordu.

      Üstelik `React.memo` bu yüzden hiçbir işe yaramıyordu: prop'lar aynı kalsa bile
      iç abonelik render'ı tetikliyor. `useMemo`nun `prefs` bağımlılığı da her store
      değişiminde yeni nesne kimliği aldığı için sürekli bozuluyordu.

      Hesap tek bir yere, ebeveyne alındı: N abonelik yerine 1, N hesap yerine 1 geçiş.
    */

    const tr = language === 'tr';
    const c = copy(tr);
    const done = task.isCompleted || completingIds.has(task.id);
    const accent = modeInfo?.color || priorityColor(task.priority);
    const title = getLocalizedTaskTitle(task, tr);
    const grouped = !!position;
    const isTop = position === 'first' || position === 'only' || !grouped;
    const isBottom = position === 'last' || position === 'only' || !grouped;
    const isExpanded = expandedId === task.id;

    /*
      İKİNCİL SATIR — haplar yerine tek satır düz metin: "14:00 · 13 dk kaldı · iş".
      Eskiden her bilgi ikonlu gri bir hap içindeydi ve saat iki kez görünüyordu
      (geri sayım hapı + saat hapı, ikisi de aynı saat ikonu). Hatırlatıcılar ve
      Things ikincil bilgiyi kutusuz, ayırıcı noktayla yazar.
    */
    const isQuit = modeInfo?.unit === 'clean_day';
    const countdown = isQuit
        ? (modeInfo!.daysLeft === 0 ? c.dayOne : c.clean(modeInfo!.daysLeft!))
        : getTaskRemainingTime(task.dueDate, task.dueTime, task.isCompleted, tr);
    const isOverdue = countdown === 'Süresi geçti' || countdown === 'Overdue';
    const timeLabel = task.dueTime ? (() => {
        const d = new Date(task.dueTime);
        return isNaN(d.getTime()) ? task.dueTime : d.toLocaleTimeString(tr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    })() : null;
    const dateLabel = task.dueDate && !countdown
        ? new Date(task.dueDate).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })
        : null;
    const subDone = task.subtasks?.filter((s: { done?: boolean }) => s.done).length ?? 0;
    // Gecikme ayrı renkte, en başta yazılır; geri kalan bilgi tek soluk satır.
    const meta = [
        !isQuit && modeInfo?.daysLeft !== undefined ? c.goal(modeInfo.daysLeft) : null,
        timeLabel,
        countdown && !isOverdue && countdown !== timeLabel ? countdown : null,
        dateLabel,
        task.subtasks?.length ? `${subDone}/${task.subtasks.length} ${c.steps}` : null,
        ...visibleTextTags(task.tags).map(tag => translateTag(tag, language as 'tr' | 'en')),
    ].filter(Boolean) as string[];
    const modeLabel = modeInfo ? (tr ? modeInfo.labelTr : modeInfo.labelEn) : null;
    const lead = [modeLabel, isOverdue ? countdown : null].filter(Boolean).length;

    const rowBg = isBulkMode && isSelected
        ? theme.primaryContainer
        : highlightedId === task.id ? theme.secondaryContainer : theme.surfaceCard;

    // Sesli ad: başlık + öncelik + durum (ekranda bunları yalnız RENK söylüyor).
    const taskA11yLabel = describeTask(task, title, language);
    /*
      Sıralama okları her satırda duruyordu (iki ikon × her görev). Artık satır
      açılınca görünüyor; ekran okuyucu için satırın kendisinde birer eylem var.
    */
    const a11yActions = [
        ...(onMoveUp ? [{ name: 'moveUp', label: c.up }] : []),
        ...(onMoveDown ? [{ name: 'moveDown', label: c.down }] : []),
    ];
    return (
        <Animated.View>
            <SwipeableItem
                onDelete={() => handleDelete(task.id)}
                disabled={isBulkMode}
                showPeekHint={showSwipePeek && i === 0}
                flush={grouped && !isBottom}
            >
                <Touchable
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={taskA11yLabel}
                    accessibilityState={{ checked: !!task.isCompleted, selected: isBulkMode && isSelected }}
                    accessibilityHint={isBulkMode ? bulkSelectHint(language) : rowHint(language)}
                    accessibilityActions={a11yActions.length ? a11yActions : undefined}
                    onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === 'moveUp') onMoveUp?.();
                        if (e.nativeEvent.actionName === 'moveDown') onMoveDown?.();
                    }}
                    onPress={() => {
                        if (isBulkMode) {
                            handleBulkSelect(task.id);
                        } else if (isWeightEntryTask(task) && !task.isCompleted) {
                            handleToggle(task.id);
                        } else {
                            handleToggleExpand(task.id);
                        }
                    }}
                    onLongPress={() => handleLongPress(task.id)}
                    style={[
                        styles.row,
                        {
                            backgroundColor: rowBg,
                            borderTopLeftRadius: isTop ? R.lg : 0,
                            borderTopRightRadius: isTop ? R.lg : 0,
                            borderBottomLeftRadius: isBottom ? R.lg : 0,
                            borderBottomRightRadius: isBottom ? R.lg : 0,
                        },
                    ]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: S.md }}>
                        {isBulkMode ? (
                            <View style={[styles.ring, { borderWidth: B.medium, borderColor: isSelected ? theme.primary : theme.onSurfaceMuted, backgroundColor: isSelected ? theme.primary : 'transparent' }]}>
                                {isSelected && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
                            </View>
                        ) : (
                            <Touchable
                                onPress={() => handleToggle(task.id)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: done }}
                                accessibilityLabel={done ? c.undo : c.complete}
                                hitSlop={touchSlop(SIZE)}
                                style={[styles.ring, { borderWidth: done ? 0 : B.medium, borderColor: accent, backgroundColor: done ? theme.success : 'transparent' }]}
                            >
                                {/* Tik bir kez esneyerek belirir (RSPRING.pop) — kutlama değil, onay. */}
                                {done && (
                                    <MotiView from={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', ...RSPRING.pop }}>
                                        <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
                                    </MotiView>
                                )}
                            </Touchable>
                        )}

                        {/* Ayırıcı halkanın SAĞINDAN başlar — Apple listelerinin imzası (bkz. MyDayTaskRow). */}
                        <View style={[styles.body, { borderBottomWidth: grouped && !isBottom && !isExpanded ? HAIRLINE : 0, borderBottomColor: theme.separator }]}>
                            <MotiView animate={{ opacity: done ? 0.45 : 1 }} transition={{ type: 'timing', duration: 220 }} style={{ flex: 1, gap: S.xxs }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                    <Text
                                        style={[styles.title, { color: theme.onSurface }, done && { textDecorationLine: 'line-through' }]}
                                        numberOfLines={isExpanded ? 0 : 1}
                                    >
                                        {title}
                                    </Text>
                                    {isWeightEntryTask(task) && <Text style={[styles.badge, { color: theme.primary }]}>{c.weight}</Text>}
                                    {task.tags?.includes('auto_generated') && <Text style={[styles.badge, { color: theme.onSurfaceMuted }]}>{c.auto}</Text>}
                                </View>
                                {(lead > 0 || meta.length > 0) && (
                                    <Text numberOfLines={1} style={styles.meta}>
                                        {modeLabel && <Text style={{ color: modeInfo!.color, fontWeight: '700' }}>{modeLabel}</Text>}
                                        {modeLabel && (isOverdue || meta.length > 0) ? <Text style={{ color: theme.onSurfaceMuted }}>{' · '}</Text> : null}
                                        {isOverdue && <Text style={{ color: theme.warning }}>{countdown}</Text>}
                                        {isOverdue && meta.length > 0 ? <Text style={{ color: theme.onSurfaceMuted }}>{' · '}</Text> : null}
                                        <Text style={{ color: theme.onSurfaceMuted }}>{meta.join(' · ')}</Text>
                                    </Text>
                                )}
                            </MotiView>
                        </View>
                    </View>

                    {/* Expanded Content */}
                    <AnimatePresence>
                        {isExpanded && (
                            <MotiView
                                from={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: 'timing', duration: 220 }}
                                style={{ overflow: 'hidden', paddingLeft: S.md + SIZE + S.md, paddingRight: S.md, paddingBottom: S.md, borderBottomWidth: grouped && !isBottom ? HAIRLINE : 0, borderBottomColor: theme.separator }}
                            >
                                {(() => {
                                    const desc = getLocalizedTaskDescription(task, tr);
                                    return desc ? (
                                        <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, lineHeight: 20, marginBottom: S.sm }}>
                                            {desc}
                                        </Text>
                                    ) : null;
                                })()}

                                {/* Subtasks */}
                                {task.subtasks && task.subtasks.length > 0 && (
                                    <View style={{ gap: S.xs }}>
                                        {task.subtasks.map((sub: { text: string; done?: boolean }, sIndex: number) => (
                                            <Touchable
                                                key={sIndex}
                                                onPress={() => toggleSubtask(task.id, sIndex)}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: !!sub.done }}
                                                accessibilityLabel={sub.text}
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs }}
                                            >
                                                {sub.done
                                                    ? <CheckCircle2 size={ICON.sm} color={theme.success} />
                                                    : <Circle size={ICON.sm} color={theme.onSurfaceMuted} />
                                                }
                                                <Text style={{
                                                    fontSize: F.body, color: sub.done ? theme.onSurfaceMuted : theme.onSurface,
                                                    textDecorationLine: sub.done ? 'line-through' : 'none',
                                                }}>
                                                    {sub.text}
                                                </Text>
                                            </Touchable>
                                        ))}
                                    </View>
                                )}

                                {/* Recurrence Info */}
                                {task.recurrence && task.recurrence !== 'None' && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                                        <Repeat size={ICON.xs} color={theme.onSurfaceVariant} />
                                        <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
                                            {(t as unknown as Record<string, string>)[`recurrence${task.recurrence}`] || task.recurrence}
                                        </Text>
                                    </View>
                                )}

                                {sortBy === 'creation' && !isBulkMode && (onMoveUp || onMoveDown) && (
                                    <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                                        {([['up', onMoveUp, ChevronUp, c.up], ['down', onMoveDown, ChevronDown, c.down]] as const).map(([k, fn, Icon, label]) => (
                                            <Touchable
                                                key={k}
                                                disabled={!fn}
                                                onPress={fn}
                                                accessibilityRole="button"
                                                accessibilityLabel={label}
                                                accessibilityState={{ disabled: !fn }}
                                                style={[styles.moveBtn, { backgroundColor: theme.surfaceField, opacity: fn ? 1 : 0.4 }]}
                                            >
                                                <Icon size={ICON.sm} color={theme.onSurfaceVariant} />
                                                <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{label}</Text>
                                            </Touchable>
                                        ))}
                                    </View>
                                )}
                            </MotiView>
                        )}
                    </AnimatePresence>
                </Touchable>
            </SwipeableItem>
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.task === nextProps.task &&
        prevProps.isDark === nextProps.isDark &&
        prevProps.highlightedId === nextProps.highlightedId &&
        prevProps.isBulkMode === nextProps.isBulkMode &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.completingIds === nextProps.completingIds &&
        prevProps.language === nextProps.language &&
        prevProps.position === nextProps.position &&
        !!prevProps.onMoveUp === !!nextProps.onMoveUp &&
        !!prevProps.onMoveDown === !!nextProps.onMoveDown &&
        (prevProps.expandedId === prevProps.task.id) === (nextProps.expandedId === nextProps.task.id)
    );
});

const styles = StyleSheet.create({
  row: { overflow: 'hidden' },
  ring: { width: SIZE, height: SIZE, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: S.smd, paddingRight: S.md, minHeight: 52 },
  title: { fontSize: F.body, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: F.caption, fontWeight: '500' },
  badge: { fontSize: F.caption, fontWeight: '700' },
  moveBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full },
});
