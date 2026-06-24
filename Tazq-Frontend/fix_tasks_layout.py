import re

def main():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to find the start of the View wrapper that I added:
    # <View
    #       style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}
    # >
    start_str = "<View\n            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}\n        >"
    if start_str not in content:
        print("Could not find start view")
        # Maybe it's a bit different. Let's just search for it dynamically.
        
    start_idx = content.find("<View\n            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}\n        >")
    
    if start_idx == -1:
        # Try finding the subHeadline text instead
        headline_idx = content.find("<Text style={[styles.subHeadline")
        # Find the <View preceding it
        start_idx = content.rfind("<View", 0, headline_idx)
        start_str = content[start_idx:headline_idx]

    # Find the start of the FlatList
    flatlist_idx = content.find("<FlatList")
    
    # We need to extract the header, which is everything from start_idx up to the <View style={styles.listSection}>
    list_section_idx = content.find("<View style={styles.listSection}>")
    
    # The header is from the content inside the wrapper, down to list_section_idx
    header_content = content[start_idx + len(start_str):list_section_idx]
    
    # We also need the "Upcoming" row which is inside list_section:
    # <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
    # ...
    # </View>
    upcoming_start = content.find("<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>", list_section_idx)
    animate_presence_idx = content.find("<AnimatePresence>", upcoming_start)
    upcoming_content = content[upcoming_start:animate_presence_idx]
    
    # Assemble the full ListHeaderComponent
    full_header = "          <>\n  " + header_content + "            " + upcoming_content + "          </>\n"
    
    # Now replace the entire structure!
    # Instead of:
    # <View ...>
    #   [header_content]
    #   <View style={styles.listSection}>
    #     [upcoming_content]
    #     <AnimatePresence>
    #       ... FlatList ...
    #     </AnimatePresence>
    #     [swipe_hint]
    #   </View>
    # </View>
    
    # We want:
    # <View style={{ flex: 1, backgroundColor: theme.background }}>
    #   <FlatList ... ListHeaderComponent={() => (<> ... </>)} />
    # </View>
    
    # This is slightly complex to do with string slicing because of the ending tags.
    # Let's just use regex or string replace.
    
    # Wait, the simplest way is to inject ListHeaderComponent into the FlatList!
    flatlist_injection = f"""                    ListHeaderComponent={{() => (
{full_header}
                    )}}
"""
    # Insert it right after <FlatList
    new_content = content.replace("<FlatList", "<FlatList\n" + flatlist_injection, 1)
    
    # Now DELETE the header_content and upcoming_content from their original places!
    new_content = new_content.replace(header_content, "")
    new_content = new_content.replace(upcoming_content, "")
    
    # We also have to fix the styling of the wrapper so it has the paddings.
    # The FlatList contentContainerStyle needs the padding!
    # Currently it is: contentContainerStyle={{ gap: S.sm, paddingBottom: 100 }}
    # We change it to: contentContainerStyle={{ gap: S.sm, paddingBottom: 100, paddingTop: 10, paddingHorizontal: S.lg }}
    new_content = new_content.replace("contentContainerStyle={{ gap: S.sm, paddingBottom: 100 }}", "contentContainerStyle={{ gap: S.sm, paddingBottom: 100, paddingTop: 10, paddingHorizontal: S.lg }}")
    
    # And we remove `paddingTop: 10, paddingHorizontal: S.lg` from the outer wrapper View!
    new_content = new_content.replace("<View\n            style={{ flex: 1, paddingTop: 10, paddingHorizontal: S.lg }}\n        >", "<View style={{ flex: 1 }}>")
    
    # Also, we don't need `paddingHorizontal: S.lg` on the outer wrapper anymore.
    # BUT wait! We also have an EmptyState inside the AnimatePresence!
    # If we use ListHeaderComponent, the empty state needs the header too!
    
    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed tasks layout partially.")

main()
