with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. RNAnimated.View -> View
content = content.replace("<RNAnimated.View entering={i < 10 ? undefined : undefined}>", "<View>")
content = content.replace("</RNAnimated.View>", "</View>")

# 2. Styles replacements
content = content.replace("style={styles.taskMeta}", "style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}")
content = content.replace("styles.metaItem", "{ flexDirection: 'row', alignItems: 'center', gap: 4 }")
content = content.replace("styles.metaText", "{ fontSize: 11 }")
content = content.replace("styles.checkbox", "{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: S.sm }")

# 3. CalendarDays -> Calendar
content = content.replace("<CalendarDays", "<Calendar")
content = content.replace("CalendarDays,", "Calendar,")

# 4. Set<number> -> Set<string>
content = content.replace("useState<Set<number>>(new Set())", "useState<Set<string>>(new Set())")

with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
