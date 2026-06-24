const fs = require('fs');

let content = fs.readFileSync('app/tasks.tsx', 'utf8');

// 1. IMPORT USESHALLOW
if (!content.includes('import { useShallow } from')) {
    content = content.replace(
        "import { useTaskStore } from '../store/useTaskStore';",
        "import { useTaskStore } from '../store/useTaskStore';\nimport { useShallow } from 'zustand/react/shallow';"
    );
}

// 2. USESHALLOW DESTRUCTURE
const oldStore = "const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore();";
const newStore = `const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore(useShallow(state => ({
    tasks: state.tasks,
    toggleTaskCompletion: state.toggleTaskCompletion,
    addTask: state.addTask,
    removeTask: state.removeTask,
    updateTask: state.updateTask,
    setTasks: state.setTasks,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
    toggleSubtask: state.toggleSubtask
  })));`;
content = content.replace(oldStore, newStore);

// 3. FLATLIST IMPORT
if (!content.includes('FlatList')) {
    content = content.replace(
        "import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager } from 'react-native';",
        "import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager, FlatList } from 'react-native';"
    );
}

// 4. MEMOIZED COMPONENT
const memoComponent = `
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
                                                        Haptics.selectionAsync();
                                                        toggleSubtask(task.id, sIndex);
                                                        // Note: We bypass the debounce for now, state updates are local enough.
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
                                                {t[\`recurrence\${task.recurrence}\`] || task.recurrence}
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
`;

if (!content.includes('MemoizedTaskItem')) {
    // Also import CheckCircle2, Circle if not present
    if (!content.includes('CheckCircle2')) {
        content = content.replace("import { Check, Clock, CalendarDays,", "import { Check, Clock, CalendarDays, CheckCircle2, Circle,");
    }
    content = content.replace('export default function ActionCenter() {', memoComponent + '\nexport default function ActionCenter() {');
}

// 5. REPLACE MAP WITH FLATLIST
const mapStartIndex = content.indexOf('visibleTasks.map((task, i) => {');
const mapEndIndex = content.indexOf('                    })', mapStartIndex);

if (mapStartIndex !== -1 && mapEndIndex !== -1) {
    const startStr = content.substring(0, mapStartIndex);
    const endStr = content.substring(mapEndIndex + '                    })'.length);

    const flatListStr = `
                    <FlatList
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
                    />`;
    
    content = startStr + flatListStr + endStr;
}

// 6. DELETE REMAINING COUNT BLOCK
const rcStart = content.indexOf('{remainingCount > 0 && (');
if (rcStart !== -1) {
    const nextTextStart = content.indexOf('{filteredTasks.length > 0 && !isBulkMode && remainingCount === 0 && (');
    if (nextTextStart !== -1) {
        content = content.substring(0, rcStart) + '{filteredTasks.length > 0 && !isBulkMode && (' + content.substring(nextTextStart + '{filteredTasks.length > 0 && !isBulkMode && remainingCount === 0 && ('.length);
    }
}

fs.writeFileSync('app/tasks.tsx', content);
console.log('Successfully applied all fixes');
