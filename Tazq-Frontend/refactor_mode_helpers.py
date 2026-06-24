import re

def refactor_mode_helpers():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Import getModeInfoForTask
    if "getModeInfoForTask" not in content:
        import_stmt = "import { getModeInfoForTask } from '../utils/modeHelpers';\n"
        content = content.replace("import { usePrefsStore } from '../store/usePrefsStore';", "import { usePrefsStore } from '../store/usePrefsStore';\n" + import_stmt)

    # Replace the inline useMemo logic
    old_logic = """    const modeInfo = useMemo(() => {
        const p = usePrefsStore.getState();
        if (p.examPlanTaskIds?.includes(task.id) || p.exam2PlanTaskIds?.includes(task.id) || p.exam3PlanTaskIds?.includes(task.id)) return { color: theme.primary, labelTr: 'Sınav Planı', labelEn: 'Exam Plan' };
        if (p.tezPlanTaskIds?.includes(task.id)) return { color: theme.tertiary, labelTr: 'Tez/Proje', labelEn: 'Thesis' };
        if (p.mulakatPlanTaskIds?.includes(task.id) || p.mulakat2PlanTaskIds?.includes(task.id) || p.mulakat3PlanTaskIds?.includes(task.id)) return { color: theme.secondary, labelTr: 'Mülakat Planı', labelEn: 'Interview Plan' };
        if (p.sporPlanTaskIds?.includes(task.id) || p.spor2PlanTaskIds?.includes(task.id) || p.spor3PlanTaskIds?.includes(task.id)) return { color: theme.success || '#10B981', labelTr: 'Spor Planı', labelEn: 'Workout Plan' };
        if (p.ramazanPlanTaskIds?.includes(task.id)) return { color: '#6366F1', labelTr: 'Ramazan Planı', labelEn: 'Ramadan Plan' };
        return null;
    }, [task.id, theme]);"""
    
    new_logic = """    const modeInfo = useMemo(() => {
        return getModeInfoForTask(task.id, usePrefsStore.getState(), theme);
    }, [task.id, theme]);"""

    if old_logic in content:
        content = content.replace(old_logic, new_logic)
    else:
        # Fallback if there are whitespace differences
        content = re.sub(
            r'const modeInfo = useMemo\(\(\) => \{[\s\S]+?return null;\s*\}, \[task\.id, theme\]\);',
            new_logic,
            content
        )

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Refactored tasks.tsx to use modeHelpers!")

refactor_mode_helpers()
