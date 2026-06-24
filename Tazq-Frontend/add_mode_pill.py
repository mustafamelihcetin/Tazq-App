import re

def add_mode_pill():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Update modeColor to modeInfo
    old_mode_logic = """    const modeColor = useMemo(() => {
        const p = usePrefsStore.getState();
        if (p.examPlanTaskIds?.includes(task.id) || p.exam2PlanTaskIds?.includes(task.id) || p.exam3PlanTaskIds?.includes(task.id)) return theme.primary;
        if (p.tezPlanTaskIds?.includes(task.id)) return theme.tertiary;
        if (p.mulakatPlanTaskIds?.includes(task.id) || p.mulakat2PlanTaskIds?.includes(task.id) || p.mulakat3PlanTaskIds?.includes(task.id)) return theme.secondary;
        if (p.sporPlanTaskIds?.includes(task.id) || p.spor2PlanTaskIds?.includes(task.id) || p.spor3PlanTaskIds?.includes(task.id)) return theme.success || '#10B981';
        if (p.ramazanPlanTaskIds?.includes(task.id)) return '#6366F1';
        return null;
    }, [task.id, theme]);

    const finalLeftColor = modeColor || priorityColor(task.priority);"""

    new_mode_logic = """    const modeInfo = useMemo(() => {
        const p = usePrefsStore.getState();
        if (p.examPlanTaskIds?.includes(task.id) || p.exam2PlanTaskIds?.includes(task.id) || p.exam3PlanTaskIds?.includes(task.id)) return { color: theme.primary, labelTr: 'Sınav Planı', labelEn: 'Exam Plan' };
        if (p.tezPlanTaskIds?.includes(task.id)) return { color: theme.tertiary, labelTr: 'Tez/Proje', labelEn: 'Thesis' };
        if (p.mulakatPlanTaskIds?.includes(task.id) || p.mulakat2PlanTaskIds?.includes(task.id) || p.mulakat3PlanTaskIds?.includes(task.id)) return { color: theme.secondary, labelTr: 'Mülakat Planı', labelEn: 'Interview Plan' };
        if (p.sporPlanTaskIds?.includes(task.id) || p.spor2PlanTaskIds?.includes(task.id) || p.spor3PlanTaskIds?.includes(task.id)) return { color: theme.success || '#10B981', labelTr: 'Spor Planı', labelEn: 'Workout Plan' };
        if (p.ramazanPlanTaskIds?.includes(task.id)) return { color: '#6366F1', labelTr: 'Ramazan Planı', labelEn: 'Ramadan Plan' };
        return null;
    }, [task.id, theme]);

    const finalLeftColor = modeInfo?.color || priorityColor(task.priority);"""

    content = content.replace(old_mode_logic, new_mode_logic)

    # Step 2: Inject the pill into the row
    # The container wrapper condition
    old_wrapper = "{(task.description || task.dueDate || task.dueTime) && ("
    new_wrapper = "{(task.description || task.dueDate || task.dueTime || modeInfo) && ("
    content = content.replace(old_wrapper, new_wrapper)

    # The pill insertion right before dueDate
    # Find: {task.dueDate && (
    # We will insert the modeInfo block right before the first occurrence of task.dueDate inside that row.
    # To be safe, let's use a regex or string index to find the exact spot.
    
    # Let's search for the exact MotiView opening block
    motiblock = """                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1, scale: task.isCompleted || completingIds.has(task.id) ? 0.97 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={{ flexShrink: 1 }}
                                    >"""
    # Wait, the exact block for the pills is:
    pills_wrapper = """                                        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}
                                    >"""
    
    new_pill = """
                                        {modeInfo && (
                                            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, { backgroundColor: modeInfo.color + '1A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <Sparkles size={12} color={modeInfo.color} opacity={0.9} />
                                                <Text style={[{ fontSize: 11 }, { color: modeInfo.color, fontWeight: '700' }]}>
                                                    {language === 'tr' ? modeInfo.labelTr : modeInfo.labelEn}
                                                </Text>
                                            </View>
                                        )}"""
                                        
    content = content.replace(pills_wrapper, pills_wrapper + new_pill)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added mode pill to tasks!")

add_mode_pill()
