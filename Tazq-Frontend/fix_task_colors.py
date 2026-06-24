import re

def fix_colors():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Restore the component declaration
    # Currently it is:
    # }
    # 
    # 
    #     const { task, i, theme, isDark, highlightedId, ... }
    
    # We need to add back `const MemoizedTaskItem = React.memo((props: any) => {`
    broken_start = "    const { task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedId, subtaskSaveTimers } = props;\n    \n    const modeColor = useMemo(() => {"
    
    fixed_start = """const MemoizedTaskItem = React.memo((props: any) => {
    const { task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedId, subtaskSaveTimers } = props;
    
    const modeColor = useMemo(() => {"""
    
    if broken_start in content:
        content = content.replace(broken_start, fixed_start)

    # Now let's fix the indicator style
    # Currently it is:
    #                             <View style={[{
    #                                         width: 4, height: 16, borderRadius: 2,
    #                                         backgroundColor: finalLeftColor,
    #                                         opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1,
    #                                     }]} />
    
    # We want to restore the original styling:
    # <View style={[styles.priorityIndicator, { backgroundColor: finalLeftColor, width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm }]} />
    
    broken_indicator = """                            <View style={[{
                                        width: 4, height: 16, borderRadius: 2,
                                        backgroundColor: finalLeftColor,
                                        opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1,
                                    }]} />"""
                                    
    # It might have different indentation or spacing, so let's use regex.
    # The regex targets the <View style={[{ ... }]} /> block
    content = re.sub(
        r'<View style=\{\[\{\s*width: 4, height: 16, borderRadius: 2,\s*backgroundColor: finalLeftColor,\s*opacity: task\.isCompleted \|\| completingIds\.has\(task\.id\) \? 0\.3 : 1,\s*\}\]\} \/>',
        r'<View style={[styles.priorityIndicator, { backgroundColor: finalLeftColor, width: S.xs, height: \'100%\', borderRadius: R.sm, marginRight: S.sm, opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1 }]} />',
        content
    )
    
    # If the regex didn't match, let's just do a manual search for finalLeftColor
    if 'width: 4, height: 16' in content:
        start_idx = content.find('<View style={[{')
        end_idx = content.find('}]} />', start_idx)
        if start_idx != -1 and end_idx != -1:
            old_indicator = content[start_idx:end_idx + 6]
            new_indicator = "<View style={[styles.priorityIndicator, { backgroundColor: finalLeftColor, width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm, opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1 }]} />"
            content = content.replace(old_indicator, new_indicator)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed task colors and syntax!")

fix_colors()
