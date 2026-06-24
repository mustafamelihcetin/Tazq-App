import re

def fix_modlar():
    with open('app/modlar.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find onClearPlan
    start_idx = content.find("onClearPlan={() => {")
    if start_idx == -1:
        print("Could not find onClearPlan in modlar.tsx")
        return

    # Replace the signature
    content = content[:start_idx] + "onClearPlan={(preserveMeta?: boolean) => {" + content[start_idx+len("onClearPlan={() => {"):]

    # Replace each metadata clearing block
    # Exam
    exam_clear = """if (slot === 'exam2') { setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setExam2NameInput(''); setExam2DateInput(''); }
              else if (slot === 'exam3') { setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setExam3NameInput(''); setExam3DateInput(''); }
              else { setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); setExamNameInput(''); setExamDateInput(''); }"""
    exam_fixed = """if (!preserveMeta) {
                if (slot === 'exam2') { setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setExam2NameInput(''); setExam2DateInput(''); }
                else if (slot === 'exam3') { setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setExam3NameInput(''); setExam3DateInput(''); }
                else { setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); setExamNameInput(''); setExamDateInput(''); }
              }"""
    content = content.replace(exam_clear, exam_fixed)

    # Tez
    tez_clear = """setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput('');"""
    tez_fixed = """if (!preserveMeta) {
                setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput('');
              }"""
    content = content.replace(tez_clear, tez_fixed)

    # Mulakat
    mulakat_clear = """if (slot === 'mulakat2') { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
              else if (slot === 'mulakat3') { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
              else { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }"""
    mulakat_fixed = """if (!preserveMeta) {
                if (slot === 'mulakat2') { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
                else if (slot === 'mulakat3') { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
                else { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
              }"""
    content = content.replace(mulakat_clear, mulakat_fixed)

    # Spor
    spor_clear = """if (slot === 'spor2') { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
              else if (slot === 'spor3') { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
              else { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); }"""
    spor_fixed = """if (!preserveMeta) {
                if (slot === 'spor2') { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
                else if (slot === 'spor3') { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
                else { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); }
              }"""
    content = content.replace(spor_clear, spor_fixed)

    # Ramazan
    ram_clear = """setSeasonalPref('ramazan', false);"""
    # Wait! ram_clear might replace too many instances.
    # Let's be specific
    ram_block = """} else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
              clearPlanIds('ramazan');
              setSeasonalPref('ramazan', false);
            }"""
    ram_fixed = """} else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
              clearPlanIds('ramazan');
              if (!preserveMeta) { setSeasonalPref('ramazan', false); }
            }"""
    content = content.replace(ram_block, ram_fixed)

    with open('app/modlar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed modlar.tsx")

def fix_tasks():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # The issue is that FlatList is nested inside a View that flexes, but the user prefers the ScrollView logic
    # Or, the user complains about boxes stretching because FlatList inside View has no defined item height limits if flexDirection is row/column.
    # Actually, the simplest fix is to restore the original <ScrollView> wrapping the <View style={styles.listSection}>
    # AND change the FlatList back to a map inside a MotiView.
    # WAIT! The original code used a ScrollView + .map!
    # I changed it to FlatList to fix performance, BUT it broke the layout.
    # Let's revert the wrapper back to ScrollView.
    
    # In my previous fix `fix_both.py`, I did:
    # content.replace("<ScrollView\n            style={{ flex: 1 }}\n            contentContainerStyle={{ paddingTop: 10, paddingHorizontal: S.lg, paddingBottom: 100 }}\n            showsVerticalScrollIndicator={false}\n        >", "<View\n            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}\n        >")
    # Let's revert that part!
    
    bad_wrapper = "<View\n            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}\n        >"
    good_wrapper = "<ScrollView\n            style={{ flex: 1 }}\n            contentContainerStyle={{ paddingTop: 10, paddingHorizontal: S.lg }}\n            showsVerticalScrollIndicator={false}\n        >"
    
    if bad_wrapper in content:
        content = content.replace(bad_wrapper, good_wrapper)
        
        # We also need to change the closing tag from </View> to </ScrollView>
        # The closing tag is right before </SafeAreaView>
        end_view = "        </View>\n      </SafeAreaView>"
        end_scroll = "        </ScrollView>\n      </SafeAreaView>"
        if end_view in content:
            content = content.replace(end_view, end_scroll)
            
    # And we must change FlatList to ScrollView to avoid the warning, OR we can just leave FlatList inside ScrollView and let it complain.
    # Actually, using FlatList inside ScrollView is HORRIBLE for performance and causes the exact error the user hates:
    # "VirtualizedLists should never be nested inside plain ScrollViews"
    
    # What if we just keep the <View style={{ flex: 1 }}> but add flex-shrink or remove flex:1 from styles.listSection?
    # No, the best way to fix the error AND the layout is to extract the top stuff into ListHeaderComponent of the FlatList!
    
    # Let's just do it manually with regex.
    pass

fix_modlar()
