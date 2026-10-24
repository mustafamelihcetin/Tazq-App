import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import Animated from 'react-native-reanimated';
import { Check, Sparkles, Clock, Tag, Calendar, Repeat, ListChecks, CheckCircle2, Circle, Target, ChevronUp, ChevronDown } from 'lucide-react-native';
import { isWeightEntryTask } from '@/features/modes/utils/weightCheckin';
import { visibleTextTags, translateTag, getLocalizedTaskTitle, getLocalizedTaskDescription } from '@/features/tasks';
import { getTaskRemainingTime } from '@/features/modes';
import { SwipeableItem } from '@/shared/components/SwipeableItem';
import { ICON, S, R, F, verticalScale } from '@/shared/constants/tokens';
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
}



/** Görev listesindeki tek satır: kaydırma, çoklu seçim, genişleyen ayrıntı. */
export const MemoizedTaskItem = React.memo((props: TaskListItemProps) => {
    const { task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedId, sortBy, onMoveUp, onMoveDown, modeInfo } = props;

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

    const finalLeftColor = modeInfo?.color || priorityColor(task.priority);

    // Sesli ad: başlık + öncelik + durum (ekranda bunları yalnız RENK söylüyor).
    const taskA11yLabel = describeTask(task, getLocalizedTaskTitle(task, language === 'tr'), language);
    return (
        <Animated.View>
            <SwipeableItem
                onDelete={() => handleDelete(task.id)}
                disabled={isBulkMode}
                showPeekHint={showSwipePeek && i === 0}
            >
                <View style={{ transform: [{ scale: isBulkMode && !isSelected ? 0.96 : 1 }] }}>
                    <Touchable
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={taskA11yLabel}
                        accessibilityState={{ checked: !!task.isCompleted, selected: isBulkMode && isSelected }}
                        accessibilityHint={isBulkMode ? bulkSelectHint(language) : rowHint(language)}
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
                        style={[[styles.taskCard, { backgroundColor: isDark ? (modeInfo ? modeInfo.color + '0C' : theme.surfaceContainerLow) : (modeInfo ? modeInfo.color + '05' : theme.surfaceContainerLowest), flexDirection: 'column', alignItems: 'stretch' }], {
                            borderColor: highlightedId === task.id ? theme.secondary : (isBulkMode && isSelected ? theme.primary : (modeInfo ? modeInfo.color + '40' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'))),
                            borderWidth: (highlightedId === task.id || (isBulkMode && isSelected) || modeInfo) ? 1.5 : 1,
                        }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md }}>
                            {isBulkMode && (
                                <View style={[{ width: 22, height: 22, borderRadius: R.full, borderWidth: 2, borderColor: isSelected ? theme.primary : theme.outline, backgroundColor: isSelected ? theme.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }]}>
                                    {isSelected && <Check size={ICON.xs} color={theme.onPrimary || '#fff'} />}
                                </View>
                            )}
                            <View style={[styles.priorityIndicator, { backgroundColor: finalLeftColor, width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm, opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1 }]} />
                            
                            <View style={styles.taskContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1, scale: task.isCompleted || completingIds.has(task.id) ? 0.97 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={{ flexShrink: 1 }}
                                    >
                                        <Text style={[
                                            styles.taskTitleText,
                                            { color: theme.onSurface, fontSize: F.body, flexShrink: 1 },
                                            (task.isCompleted || completingIds.has(task.id)) && { textDecorationLine: 'line-through' }
                                        ]} numberOfLines={expandedId === task.id ? 0 : 1}>
                                            {getLocalizedTaskTitle(task, language === 'tr')}
                                        </Text>
                                    </MotiView>
                                    {isWeightEntryTask(task) && (
                                        <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: S.sm, paddingVertical: S.xxs, borderRadius: R.xs }}>
                                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary }}>{language === 'tr' ? 'KİLO' : 'WEIGHT'}</Text>
                                        </View>
                                    )}
                                    {task.tags && task.tags.includes('auto_generated') && (
                                        <View style={{ backgroundColor: theme.tertiary + '15', paddingHorizontal: S.sm, paddingVertical: S.xxs, borderRadius: R.xs }}>
                                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.tertiary }}>{language === 'tr' ? 'OTO' : 'AUTO'}</Text>
                                        </View>
                                    )}
                                </View>

                                {(getLocalizedTaskDescription(task, language === 'tr') || task.dueDate || task.dueTime || modeInfo || (task.subtasks && task.subtasks.length > 0)) && (() => {
                                    const taskCountdown = getTaskRemainingTime(task.dueDate, task.dueTime, task.isCompleted, language === 'tr');
                                    return (
                                        <MotiView
                                            animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1 }}
                                            transition={{ type: 'timing', duration: 300 }}
                                            style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: S.sm, marginTop: S.xxs }}
                                        >
                                            {modeInfo && (
                                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: modeInfo.color + '1A', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <Sparkles size={ICON.xs} color={modeInfo.color} opacity={0.9} />
                                                    <Text style={[{ fontSize: F.caption }, { color: modeInfo.color, fontWeight: '600' }]}>
                                                        {language === 'tr' ? modeInfo.labelTr : modeInfo.labelEn}
                                                    </Text>
                                                </View>
                                            )}
                                            {taskCountdown && (() => {
                                                const isOverdue = taskCountdown === 'Süresi geçti' || taskCountdown === 'Overdue';
                                                return (
                                                    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: isOverdue ? theme.error + '15' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                        <Clock size={ICON.xs} color={isOverdue ? theme.error : theme.onSurfaceVariant} opacity={0.7} />
                                                        <Text style={[{ fontSize: F.caption }, { color: isOverdue ? theme.error : theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                            {taskCountdown}
                                                        </Text>
                                                    </View>
                                                );
                                            })()}
                                            {modeInfo && modeInfo.daysLeft !== undefined && (
                                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: modeInfo.color + '18', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <Target size={ICON.xs} color={modeInfo.color} opacity={0.9} />
                                                    <Text style={[{ fontSize: F.caption }, { color: modeInfo.color, fontWeight: '600' }]}>
                                                        {modeInfo.unit === 'clean_day'
                                                            ? (modeInfo.daysLeft === 0
                                                                ? (language === 'tr' ? '1. Gün' : 'Day 1')
                                                                : (language === 'tr' ? `Temiz: ${modeInfo.daysLeft} gün` : `Clean: ${modeInfo.daysLeft} ${modeInfo.daysLeft === 1 ? 'day' : 'days'}`))
                                                            : (language === 'tr' ? `Hedef: ${modeInfo.daysLeft} gün` : `Goal: ${modeInfo.daysLeft} days`)}
                                                    </Text>
                                                </View>
                                            )}
                                            {task.dueDate && !taskCountdown && (
                                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <Calendar size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.7} />
                                                    <Text style={[{ fontSize: F.caption }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                        {new Date(task.dueDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}
                                                    </Text>
                                                </View>
                                            )}
                                            {task.dueTime && (
                                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <Clock size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.7} />
                                                    <Text style={[{ fontSize: F.caption }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                        {(() => {
                                                            const date = new Date(task.dueTime);
                                                            return isNaN(date.getTime())
                                                                ? task.dueTime
                                                                : date.toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
                                                        })()}
                                                    </Text>
                                                </View>
                                            )}
                                            {task.subtasks && task.subtasks.length > 0 && (
                                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <ListChecks size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.7} />
                                                    <Text style={[{ fontSize: F.caption }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                        {task.subtasks.filter((s: any) => s.done).length}/{task.subtasks.length}
                                                    </Text>
                                                </View>
                                            )}
                                            {/* User-facing text tags */}
                                            {visibleTextTags(task.tags).map((tag, tagIdx) => (
                                                <View key={tagIdx} style={[{ flexDirection: 'row', alignItems: 'center', gap: S.xs }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs }]}>
                                                    <Tag size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.7} />
                                                    <Text style={[{ fontSize: F.caption }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                        {translateTag(tag, language as 'tr' | 'en')}
                                                    </Text>
                                                </View>
                                            ))}
                                        </MotiView>
                                    );
                                })()}
                            </View>

                            {sortBy === 'creation' && !isBulkMode && (
                                <View style={{ flexDirection: 'column', gap: S.xxs, marginRight: S.sm, alignItems: 'center' }}>
                                    <Touchable
                                        disabled={!onMoveUp}
                                        onPress={onMoveUp}
                                        accessibilityRole="button"
                                        accessibilityLabel={language === 'tr' ? 'Yukarı taşı' : 'Move up'}
                                        accessibilityState={{ disabled: !onMoveUp }}
                                        style={{ opacity: onMoveUp ? 0.8 : 0.15, padding: S.xxs }}
                                        hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                                    >
                                        <ChevronUp size={ICON.sm} color={theme.onSurfaceVariant} />
                                    </Touchable>
                                    <Touchable
                                        disabled={!onMoveDown}
                                        onPress={onMoveDown}
                                        accessibilityRole="button"
                                        accessibilityLabel={language === 'tr' ? 'Aşağı taşı' : 'Move down'}
                                        accessibilityState={{ disabled: !onMoveDown }}
                                        style={{ opacity: onMoveDown ? 0.8 : 0.15, padding: S.xxs }}
                                        hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <ChevronDown size={ICON.sm} color={theme.onSurfaceVariant} />
                                    </Touchable>
                                </View>
                            )}

                            <Touchable
                                onPress={() => handleToggle(task.id)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: task.isCompleted || completingIds.has(task.id) }}
                                accessibilityLabel={
                                    (task.isCompleted || completingIds.has(task.id))
                                        ? (language === 'tr' ? 'Görevi tamamlanmadı olarak işaretle' : 'Mark task as not done')
                                        : (language === 'tr' ? 'Görevi tamamla' : 'Complete task')
                                }
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={[
                                    { width: 24, height: 24, borderRadius: R.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: S.sm },
                                    {
                                        backgroundColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : 'transparent',
                                        borderColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : (isDark ? theme.outline : 'rgba(0,0,0,0.2)'),
                                    }
                                ]}
                            >
                                {(task.isCompleted || completingIds.has(task.id)) && <Check size={ICON.sm} color="white" />}
                            </Touchable>
                        </View>

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {expandedId === task.id && (
                                <MotiView
                                    from={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'timing', duration: 250 }}
                                    style={{ overflow: 'hidden', paddingHorizontal: S.md, paddingBottom: S.md }}
                                >
                                    <Separator theme={theme} />
                                    {(() => {
                                        const desc = getLocalizedTaskDescription(task, language === 'tr');
                                        return desc ? (
                                            <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, lineHeight: 20, marginBottom: S.sm }}>
                                                {desc}
                                            </Text>
                                        ) : null;
                                    })()}

                                    {/* Subtasks */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <View style={{ gap: S.xs, marginTop: S.xs }}>
                                            {task.subtasks.map((sub: any, sIndex: number) => (
                                                <Touchable
                                                    key={sIndex}
                                                    onPress={() => {
                                                        toggleSubtask(task.id, sIndex);
                                                    }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs }}
                                                >
                                                    {sub.done 
                                                        ? <CheckCircle2 size={ICON.sm} color={theme.tertiary} />
                                                        : <Circle size={ICON.sm} color={theme.onSurfaceVariant} />
                                                    }
                                                    <Text style={{
                                                        fontSize: F.body, fontWeight: '600', color: theme.onSurface,
                                                        textDecorationLine: sub.done ? 'line-through' : 'none',
                                                        opacity: sub.done ? 0.4 : 0.9
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
                                            <Repeat size={ICON.xs} color={theme.secondary} />
                                            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.secondary }}>
                                                {(t as any)[`recurrence${task.recurrence}`] || task.recurrence}
                                            </Text>
                                        </View>
                                    )}
                                </MotiView>
                            )}
                        </AnimatePresence>
                    </Touchable>
                </View>
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
        (prevProps.expandedId === prevProps.task.id) === (nextProps.expandedId === nextProps.task.id)
    );
});

const styles = StyleSheet.create({
  taskCard: { borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 0 },
  priorityIndicator: { height: verticalScale(32), borderRadius: R.sm, marginRight: S.md },
  taskContent: { flex: 1 },
  taskTitleText: { fontWeight: '600' },
});
