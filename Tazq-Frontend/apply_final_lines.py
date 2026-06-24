with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Imports
import_shallow = "import { useShallow } from 'zustand/react/shallow';\n"
has_shallow = any("useShallow" in line for line in lines)
if not has_shallow:
    for i, line in enumerate(lines):
        if "import { useTaskStore } from '../store/useTaskStore';" in line:
            lines.insert(i + 1, import_shallow)
            break

# 2. useShallow destructure
for i, line in enumerate(lines):
    if "const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore();" in line:
        lines[i] = """  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore(useShallow(state => ({
    tasks: state.tasks,
    toggleTaskCompletion: state.toggleTaskCompletion,
    addTask: state.addTask,
    removeTask: state.removeTask,
    updateTask: state.updateTask,
    setTasks: state.setTasks,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
    toggleSubtask: state.toggleSubtask
  })));\n"""
        break

# 3. FlatList Import
for i, line in enumerate(lines):
    if "LayoutAnimation, UIManager } from 'react-native';" in line:
        lines[i] = line.replace("LayoutAnimation, UIManager }", "LayoutAnimation, UIManager, FlatList }")
        break
for i, line in enumerate(lines):
    if "import { Check, Clock, CalendarDays," in line:
        lines[i] = line.replace("import { Check, Clock, CalendarDays,", "import { Check, Clock, CalendarDays, CheckCircle2, Circle,")
        break

# 4. Memoized Component
memo_component = """
const MemoizedTaskItem = React.memo(({ task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedTasks, subtaskSaveTimers }) => {
    return (
        <RNAnimated.View entering={i < 10 ? undefined : undefined}>
            <SwipeableItem
                onDelete={() => handleDelete(task.id)}
                disabled={isBulkMode}
                showPeekHint={showSwipePeek && i === 0}
            >
                <MotiView
                    animate={{
                        opacity: 1,
                        scale: isBulkMode && !isSelected ? 0.96 : 1,
                    }}
                    transition={{ type: 'spring', damping: 14, stiffness: 150 }}
                >
                    <Touchable
                        activeOpacity={0.9}
                        onPress={() => {
                            if (isBulkMode) {
                                handleBulkSelect(task.id);
                            } else {
                                handleToggleExpand(task.id);
                            }
                        }}
                        onLongPress={() => handleLongPress(task.id)}
                        style={[[styles.taskCard, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, flexDirection: 'column', alignItems: 'stretch' }], {
                            borderColor: highlightedId === task.id ? theme.secondary : (isBulkMode && isSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)')),
                            borderWidth: (highlightedId === task.id || (isBulkMode && isSelected)) ? 2 : 1,
                        }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md }}>
                            {isBulkMode && (
                                <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? theme.primary : theme.outline, backgroundColor: isSelected ? theme.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }]}>
                                    {isSelected && <Check size={12} color={theme.onPrimary || '#fff'} />}
                                </View>
                            )}
                            <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority), width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm }]} />
                            
                            <View style={styles.taskContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1, scale: task.isCompleted || completingIds.has(task.id) ? 0.97 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={{ flexShrink: 1 }}
                                    >
                                        <Text style={[
                                            styles.taskTitleText,
                                            { color: theme.onSurface, fontSize: F.body, flexShrink: 1 },
                                            (task.isCompleted || completingIds.has(task.id)) && { textDecorationLine: 'line-through' }
                                        ]} numberOfLines={expandedTasks.has(task.id) ? 0 : 1}>
                                            {task.title}
                                        </Text>
                                    </MotiView>
                                    {task.tags && task.tags.includes('weight_entry') && (
                                        <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>{language === 'tr' ? 'KİLO' : 'WEIGHT'}</Text>
                                        </View>
                                    )}
                                    {task.tags && task.tags.includes('auto_generated') && (
                                        <View style={{ backgroundColor: theme.tertiary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.tertiary }}>{language === 'tr' ? 'OTO' : 'AUTO'}</Text>
                                        </View>
                                    )}
                                </View>

                                {(task.description || task.dueDate || task.dueTime) && (
                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={styles.taskMeta}
                                    >
                                        {task.dueDate && (
                                            <View style={[styles.metaItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <CalendarDays size={12} color={theme.onSurfaceVariant} opacity={0.7} />
                                                <Text style={[styles.metaText, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                    {new Date(task.dueDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                        )}
                                        {task.dueTime && (
                                            <View style={[styles.metaItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <Clock size={12} color={theme.onSurfaceVariant} opacity={0.7} />
                                                <Text style={[styles.metaText, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                    {task.dueTime}
                                                </Text>
                                            </View>
                                        )}
                                    </MotiView>
                                )}
                            </View>

                            <Touchable
                                onPress={() => handleToggle(task.id)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={[
                                    styles.checkbox,
                                    {
                                        backgroundColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : 'transparent',
                                        borderColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : (isDark ? theme.outline : 'rgba(0,0,0,0.2)'),
                                    }
                                ]}
                            >
                                {(task.isCompleted || completingIds.has(task.id)) && <Check size={16} color="white" />}
                            </Touchable>
                        </View>

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {expandedTasks.has(task.id) && (
                                <MotiView
                                    from={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'timing', duration: 250 }}
                                    style={{ overflow: 'hidden', paddingHorizontal: S.md, paddingBottom: S.md }}
                                >
                                    <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: S.md }} />
                                    
                                    {task.description && (
                                        <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, lineHeight: 20, marginBottom: S.sm }}>
                                            {task.description}
                                        </Text>
                                    )}

                                    {/* Subtasks */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <View style={{ gap: 4, marginTop: S.xs }}>
                                            {task.subtasks.map((sub, sIndex) => (
                                                <Touchable
                                                    key={sIndex}
                                                    onPress={() => {
                                                        toggleSubtask(task.id, sIndex);
                                                    }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs }}
                                                >
                                                    {sub.done 
                                                        ? <CheckCircle2 size={16} color={theme.tertiary} />
                                                        : <Circle size={16} color={theme.onSurfaceVariant} />
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
                                            <Repeat size={12} color={theme.secondary} />
                                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.secondary }}>
                                                {t[`recurrence${task.recurrence}`] || task.recurrence}
                                            </Text>
                                        </View>
                                    )}
                                </MotiView>
                            )}
                        </AnimatePresence>
                    </Touchable>
                </MotiView>
            </SwipeableItem>
        </RNAnimated.View>
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
        prevProps.expandedTasks.has(prevProps.task.id) === nextProps.expandedTasks.has(nextProps.task.id)
    );
});
"""

has_memo = any("MemoizedTaskItem" in line for line in lines)
if not has_memo:
    for i, line in enumerate(lines):
        if "export default function ActionCenter() {" in line:
            lines.insert(i, memo_component + "\n")
            break

# 5. FlatList Replacement using lines
map_start_idx = -1
for i, line in enumerate(lines):
    if "visibleTasks.map((task, i) => {" in line:
        map_start_idx = i
        break

remaining_empty_state_idx = -1
for i, line in enumerate(lines):
    if i > map_start_idx and "{filteredTasks.length > 0 && !isBulkMode && remainingCount === 0 && (" in line:
        remaining_empty_state_idx = i
        break

if map_start_idx != -1 and remaining_empty_state_idx != -1:
    flatlist_str = """                    <FlatList
                        data={filteredTasks}
                        keyExtractor={(item) => item.id.toString()}
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
                        contentContainerStyle={{ gap: S.sm, paddingBottom: 100 }}
                        extraData={{ highlightedId, isBulkMode, selectedIds, completingIds, language, expandedTasks }}
                        renderItem={({ item: task, index: i }) => (
                            <MemoizedTaskItem
                                task={task}
                                i={i}
                                theme={theme}
                                isDark={isDark}
                                highlightedId={highlightedId}
                                isBulkMode={isBulkMode}
                                isSelected={selectedIds.has(task.id)}
                                language={language}
                                t={t}
                                showSwipePeek={showSwipePeek}
                                priorityColor={priorityColor}
                                handleDelete={handleDelete}
                                handleToggleExpand={handleToggleExpand}
                                handleLongPress={(id) => {
                                    if (!isBulkMode) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setIsBulkMode(true);
                                        setSelectedIds(new Set([id]));
                                    }
                                }}
                                handleBulkSelect={(id) => {
                                    Haptics.selectionAsync();
                                    setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        next.has(id) ? next.delete(id) : next.add(id);
                                        return next;
                                    });
                                }}
                                handleToggle={handleToggle}
                                toggleSubtask={toggleSubtask}
                                completingIds={completingIds}
                                expandedTasks={expandedTasks}
                                subtaskSaveTimers={subtaskSaveTimers}
                            />
                        )}
                    />
                )}
            </AnimatePresence>\n"""
            
    # Replace lines from map_start_idx up to but not including remaining_empty_state_idx
    lines[map_start_idx:remaining_empty_state_idx] = [flatlist_str]
    
    # Let's fix the `&& remainingCount === 0 && (` since remainingCount is removed (optional but cleaner)
    for i, line in enumerate(lines):
        if "{filteredTasks.length > 0 && !isBulkMode && remainingCount === 0 && (" in line:
            lines[i] = line.replace("&& remainingCount === 0 &&", "&&")
            break

with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")
