const fs = require('fs');

let content = fs.readFileSync('app/tasks.tsx', 'utf8');

// 1. Ensure FlatList is imported
if (!content.includes('FlatList')) {
  content = content.replace(
    "import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager } from 'react-native';",
    "import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager, FlatList } from 'react-native';"
  );
}

// 2. Define MemoizedTaskItem outside the component to prevent re-renders
const memoizedTaskItemDefinition = `
const MemoizedTaskItem = React.memo(({ task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, setWeightModalTaskId, toggleSubtask, router, setHighlightedId, completingIds }) => {
    const isTaskCompletedLocally = task.isCompleted || completingIds.has(task.id);
    return (
        <View key={task.id}>
            <SwipeableItem
                onDelete={() => handleDelete(task.id)}
                disabled={isBulkMode}
                showPeekHint={showSwipePeek && i === 0}
            >
                <View
                    style={[styles.taskCard, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, flexDirection: 'column', alignItems: 'stretch' }, {
                        borderColor: highlightedId === task.id ? theme.secondary : (isBulkMode && isSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)')),
                        borderWidth: (highlightedId === task.id || (isBulkMode && isSelected)) ? 2 : 1,
                    }]}
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
                        style={{ padding: S.md, flexDirection: 'column', alignItems: 'stretch' }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {isBulkMode && (
                                <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? theme.primary : theme.outline, backgroundColor: isSelected ? theme.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }]}>
                                    {isSelected && <Check size={12} color={theme.onPrimary || '#fff'} />}
                                </View>
                            )}
                            <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority), width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm }]} />
                            
                            <View style={styles.taskContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ flexShrink: 1, opacity: isTaskCompletedLocally ? 0.4 : 1, transform: [{ scale: isTaskCompletedLocally ? 0.97 : 1 }] }}>
                                        <Text style={[
                                            styles.taskTitleText,
                                            {
                                                textDecorationLine: isTaskCompletedLocally ? 'line-through' : 'none',
                                                color: isTaskCompletedLocally ? theme.onSurfaceVariant : theme.onSurface,
                                            }
                                        ]}>
                                            {task.title}
                                        </Text>
                                    </View>
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
                                    <View style={[styles.taskMeta, { opacity: isTaskCompletedLocally ? 0.4 : 1 }]}>
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
                                    </View>
                                )}
                            </View>

                            <Touchable
                                onPress={() => handleToggle(task.id)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={[
                                    styles.checkbox,
                                    {
                                        backgroundColor: isTaskCompletedLocally ? theme.success : 'transparent',
                                        borderColor: isTaskCompletedLocally ? theme.success : (isDark ? theme.outline : 'rgba(0,0,0,0.2)'),
                                    }
                                ]}
                            >
                                {isTaskCompletedLocally && <Check size={16} color="white" />}
                            </Touchable>
                        </View>

                        <AnimatePresence>
                            {expandedTasks.has(task.id) && (
                                <View style={{ marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                                    {task.description && (
                                        <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, lineHeight: 20, marginBottom: S.sm }}>
                                            {task.description}
                                        </Text>
                                    )}

                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <View style={{ gap: S.sm }}>
                                            {task.subtasks.map((st, sIndex) => (
                                                <Touchable
                                                    key={sIndex}
                                                    onPress={() => toggleSubtask(task.id, sIndex)}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 4 }}
                                                >
                                                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: st.done ? theme.tertiary : theme.outline, backgroundColor: st.done ? theme.tertiary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                                        {st.done && <Check size={10} color="#fff" />}
                                                    </View>
                                                    <Text style={{ flex: 1, fontSize: F.subhead, color: st.done ? theme.onSurfaceVariant : theme.onSurface, textDecorationLine: st.done ? 'line-through' : 'none' }}>
                                                        {st.title}
                                                    </Text>
                                                </Touchable>
                                            ))}
                                        </View>
                                    )}

                                    {task.recurrence && task.recurrence !== 'None' && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                                            <Repeat size={12} color={theme.secondary} />
                                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.secondary }}>
                                                {t[\`recurrence\${task.recurrence}\`] || task.recurrence}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </AnimatePresence>
                    </Touchable>
                </View>
            </SwipeableItem>
        </View>
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

// Insert the definition just outside the default export
if (!content.includes('MemoizedTaskItem')) {
    content = content.replace('export default function ActionCenter() {', memoizedTaskItemDefinition + '\nexport default function ActionCenter() {');
}

// 3. Replace the inner mapping with FlatList
const startMapRegex = /visibleTasks\.map\(\(task, i\) => \{[\s\S]*?return \([\s\S]*?<View key=\{task\.id\}>[\s\S]*?<SwipeableItem[\s\S]*?<\/SwipeableItem>\n\s*<\/View>\n\s*\);\n\s*\}\)/m;

const flatListReplacement = `
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
            setWeightModalTaskId={setWeightModalTaskId}
            toggleSubtask={toggleSubtask}
            router={router}
            setHighlightedId={setHighlightedId}
            completingIds={completingIds}
            expandedTasks={expandedTasks}
        />
    )}
/>
`;

content = content.replace(startMapRegex, flatListReplacement);

// Remove the manual visibleCount logic from the bottom since FlatList handles virtualization automatically
content = content.replace(/\{remainingCount > 0 && \([\s\S]*?\}\)/m, '');

fs.writeFileSync('app/tasks_flatlist.tsx', content);
console.log('FlatList and Memoization applied');
