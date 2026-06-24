import re

def add_archive_buttons():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Ensure archiveCompletedTasks is imported from useTaskStore
    old_store_import = "const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);"
    new_store_import = """const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const archiveCompletedTasks = useTaskStore(state => state.archiveCompletedTasks);"""
    
    if "archiveCompletedTasks = useTaskStore" not in content:
        content = content.replace(old_store_import, new_store_import)

    # 2. Ensure router is imported (it usually is, `const router = useRouter();`)

    # 3. Add an Archive button in the renderHeader!
    # Let's find the AI button in renderHeader
    old_header_ai = """        <Touchable onPress={() => setNlpModalVisible(true)} style={[styles.aiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Sparkles size={20} color={theme.tertiary} />
        </Touchable>"""
        
    new_header_buttons = """        <Touchable onPress={() => router.push('/archive')} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', marginRight: 8 }]}>
          <Archive size={20} color={theme.onSurfaceVariant} />
        </Touchable>
        <Touchable onPress={() => setNlpModalVisible(true)} style={[styles.aiBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Sparkles size={20} color={theme.tertiary} />
        </Touchable>"""
        
    if "Archive size={20}" not in content:
        content = content.replace(old_header_ai, new_header_buttons)

    # 4. Import Archive icon from lucide-react-native
    if "Archive" not in content[:1000]:
        content = content.replace("Target } from 'lucide-react-native';", "Target, Archive } from 'lucide-react-native';")

    # 5. Add "Tamamlananları Arşivle" inside the 'done' filter block
    # It looks like:
    #               <Text style={{ fontSize: F.caption, fontWeight: '700', color: filter === 'done' ? theme.tertiary : theme.onSurfaceVariant, opacity: 0.75, flex: 1 }} numberOfLines={1}>
    #                 {t.completedTasks}
    #               </Text>
    #             </Touchable>
    
    old_done_touchable_end = """                <Text style={{ fontSize: F.caption, fontWeight: '700', color: filter === 'done' ? theme.tertiary : theme.onSurfaceVariant, opacity: 0.75, flex: 1 }} numberOfLines={1}>
                  {t.completedTasks}
                </Text>
              </Touchable>"""
              
    new_done_touchable_end = """                <Text style={{ fontSize: F.caption, fontWeight: '700', color: filter === 'done' ? theme.tertiary : theme.onSurfaceVariant, opacity: 0.75, flex: 1 }} numberOfLines={1}>
                  {t.completedTasks}
                </Text>
              </Touchable>
              {filter === 'done' && (
                <Touchable 
                  onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      archiveCompletedTasks();
                  }}
                  style={{ justifyContent: 'center', paddingHorizontal: 8 }}
                >
                  <Archive size={18} color={theme.tertiary} opacity={0.8} />
                </Touchable>
              )}"""
              
    if "archiveCompletedTasks();" not in content:
        content = content.replace(old_done_touchable_end, new_done_touchable_end)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added archive buttons to tasks.tsx!")

add_archive_buttons()
