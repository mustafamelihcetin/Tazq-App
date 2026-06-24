import re

def fix_tasks_flatlist():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    start_idx = content.find("<SafeAreaView style={{ flex: 1 }} edges={['top']}>")
    if start_idx == -1:
        print("Could not find start of SafeAreaView")
        return
        
    end_idx = content.find("</SafeAreaView>", start_idx)
    if end_idx == -1:
        print("Could not find end of SafeAreaView")
        return

    old_block = content[start_idx:end_idx + len("</SafeAreaView>")]
    
    headline_start = old_block.find("<Text style={[styles.subHeadline")
    list_section_start = old_block.find("<View style={styles.listSection}>")
    
    header_content = old_block[headline_start:list_section_start]
    
    upcoming_start = old_block.find("<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>", list_section_start)
    animate_presence_start = old_block.find("<AnimatePresence>", upcoming_start)
    upcoming_content = old_block[upcoming_start:animate_presence_start]
    
    # We are completely replacing old_block.
    new_render = """<SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
            style={{ flex: 1 }}
            data={filteredTasks}
            keyExtractor={(item: any) => item.id.toString()}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            contentContainerStyle={{ gap: S.sm, paddingBottom: 100, paddingTop: 10, paddingHorizontal: S.lg }}
            extraData={{ highlightedId, isBulkMode, selectedIds, completingIds, language, expandedId }}
            ListHeaderComponent={() => (
                <View style={{ paddingBottom: S.md }}>
""" + header_content + """
""" + upcoming_content + """
                </View>
            )}
            ListEmptyComponent={() => (
                <MotiView key="empty" from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={styles.emptyState}>
                    <MotiView
                        animate={{ rotate: ['0deg', '5deg', '-5deg', '0deg'] }}
                        transition={{ loop: true, duration: 4000 }}
                        style={{ marginBottom: 16, opacity: 0.25 }}
                    >
                        <Sparkles size={40} color={theme.primary} />
                    </MotiView>
                    <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{searchQuery.trim() ? t.noResults : t.allTasksReady}</Text>
                    <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>{searchQuery.trim() ? (language === 'tr' ? `"${searchQuery}" için sonuç bulunamadı` : `No results for "${searchQuery}"`) : t.noTasksHint}</Text>
                </MotiView>
            )}
            renderItem={({ item: task, index: i }: any) => (
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
                    handleLongPress={(id: number) => {
                        if (!isBulkMode) {
                            import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
                            setIsBulkMode(true);
                            setSelectedIds(new Set([id]));
                        }
                    }}
                    handleBulkSelect={(id: number) => {
                        import('expo-haptics').then(Haptics => Haptics.selectionAsync());
                        setSelectedIds(prev => {
                            const next = new Set(prev);
                            next.has(id) ? next.delete(id) : next.add(id);
                            return next;
                        });
                    }}
                    handleToggle={handleToggle}
                    toggleSubtask={toggleSubtask}
                    completingIds={completingIds}
                    expandedId={expandedId}
                    subtaskSaveTimers={subtaskSaveTimers}
                />
            )}
            ListFooterComponent={() => (
                filteredTasks.length > 0 && !isBulkMode ? (
                    <Text style={{ fontSize: 12, color: theme.onSurfaceVariant, opacity: isDark ? 0.5 : 0.35, textAlign: 'center', marginTop: 16, fontWeight: '600', letterSpacing: 0.3 }}>
                        {t.swipeHint}
                    </Text>
                ) : null
            )}
        />
      </SafeAreaView>"""

    content = content.replace(old_block, new_render)
    
    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed tasks FlatList render structure!")

fix_tasks_flatlist()
