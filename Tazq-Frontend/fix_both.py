import re

def fix_tasks():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the specific ScrollView opening tag
    old_scrollview = '''        <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 140, paddingHorizontal: S.lg }}
        >'''
    new_scrollview = '''        <View
            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}
        >'''
    
    if old_scrollview in content:
        content = content.replace(old_scrollview, new_scrollview)
    
    # We also need to replace the specific </ScrollView> that closes it.
    # It should be right before `</KeyboardAvoidingView>` or `</SafeAreaView>`.
    # Actually, it's at line 1496 based on grep.
    # Let's find the `</ScrollView>` that comes AFTER `</FlatList>`.
    parts = content.split('</FlatList>')
    if len(parts) > 1:
        # replace the first </ScrollView> in parts[1]
        parts[1] = parts[1].replace('</ScrollView>', '</View>', 1)
        content = '</FlatList>'.join(parts)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

def fix_modlar():
    with open('app/modlar.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the onDismiss block
    start_dismiss = content.find("onDismiss={() => {")
    if start_dismiss != -1:
        end_dismiss = content.find("}}", start_dismiss)
        if end_dismiss != -1:
            content = content[:start_dismiss] + "onDismiss={() => { setModePreview(null); }}" + content[end_dismiss+2:]

    # Find the onSheetClose block
    start_sheet = content.find("onSheetClose={() => {")
    if start_sheet != -1:
        end_sheet = content.find("}}", start_sheet)
        if end_sheet != -1:
            content = content[:start_sheet] + "onSheetClose={() => { setModePreview(null); }}" + content[end_sheet+2:]

    with open('app/modlar.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

fix_tasks()
fix_modlar()
print("Done")
