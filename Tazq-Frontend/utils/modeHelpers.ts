export const getModeInfoForTask = (taskId: number, prefsStoreState: any, theme: any) => {
    const p = prefsStoreState;
    if (!p) return null;

    // Exam Modes
    if (p.examPlanTaskIds?.includes(taskId)) return { color: theme.primary, labelTr: p.seasonal?.examName || 'Sınav Planı', labelEn: p.seasonal?.examName || 'Exam Plan' };
    if (p.exam2PlanTaskIds?.includes(taskId)) return { color: theme.primary, labelTr: p.seasonal?.exam2Name || 'Sınav Planı 2', labelEn: p.seasonal?.exam2Name || 'Exam Plan 2' };
    if (p.exam3PlanTaskIds?.includes(taskId)) return { color: theme.primary, labelTr: p.seasonal?.exam3Name || 'Sınav Planı 3', labelEn: p.seasonal?.exam3Name || 'Exam Plan 3' };
    
    // Thesis / Project
    if (p.tezPlanTaskIds?.includes(taskId)) return { color: theme.tertiary, labelTr: p.seasonal?.tezName || 'Tez/Proje', labelEn: p.seasonal?.tezName || 'Thesis' };
    
    // Interview
    if (p.mulakatPlanTaskIds?.includes(taskId)) return { color: theme.secondary, labelTr: p.seasonal?.mulakatName || 'Mülakat Planı', labelEn: p.seasonal?.mulakatName || 'Interview Plan' };
    if (p.mulakat2PlanTaskIds?.includes(taskId)) return { color: theme.secondary, labelTr: p.seasonal?.mulakat2Name || 'Mülakat Planı 2', labelEn: p.seasonal?.mulakat2Name || 'Interview Plan 2' };
    if (p.mulakat3PlanTaskIds?.includes(taskId)) return { color: theme.secondary, labelTr: p.seasonal?.mulakat3Name || 'Mülakat Planı 3', labelEn: p.seasonal?.mulakat3Name || 'Interview Plan 3' };
    
    // Sports
    if (p.sporPlanTaskIds?.includes(taskId)) return { color: theme.success || '#10B981', labelTr: p.seasonal?.sporGoal || 'Spor Planı', labelEn: p.seasonal?.sporGoal || 'Workout Plan' };
    if (p.spor2PlanTaskIds?.includes(taskId)) return { color: theme.success || '#10B981', labelTr: p.seasonal?.spor2Goal || 'Spor Planı 2', labelEn: p.seasonal?.spor2Goal || 'Workout Plan 2' };
    if (p.spor3PlanTaskIds?.includes(taskId)) return { color: theme.success || '#10B981', labelTr: p.seasonal?.spor3Goal || 'Spor Planı 3', labelEn: p.seasonal?.spor3Goal || 'Workout Plan 3' };
    
    // Ramadan
    if (p.ramazanPlanTaskIds?.includes(taskId)) return { color: '#6366F1', labelTr: 'Ramazan Planı', labelEn: 'Ramadan Plan' };
    
    return null;
};
