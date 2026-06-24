import re

def apply_floating_header():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix MotiView syntax error
    content = content.replace("from={ opacity: 0, translateY: 20 }", "from={{ opacity: 0, translateY: 20 }}")

    # 2. Extract Top Header
    header_start = content.find("          {/* Dashboard-style Top Header */}")
    if header_start == -1:
        print("Header start not found.")
        return

    # The header is a View block. Find its end.
    # It starts with:
    # <View style={{
    #     flexDirection: 'row',
    #     alignItems: 'center', ...
    #
    # We will find the closing tag.
    header_end_target = "          </View>"
    header_end = content.find(header_end_target, header_start + 100)
    
    # Actually, the header ends right before:
    #         <MotiView 
    #           key="list"
    moti_list_start = content.find("<MotiView \n          key=\"list\"", header_start)
    if moti_list_start == -1:
        moti_list_start = content.find("<MotiView \n          key=\"list\"", header_start)
    if moti_list_start == -1:
        # fallback string search
        moti_list_start = content.find("key=\"list\"", header_start) - 20

    header_end = content.rfind("</View>", header_start, moti_list_start) + 7
    
    header_content_raw = content[header_start:header_end]
    
    # Now, strip the outer <View> wrapper and replace with floating wrapper
    # The inner content is everything inside the outer <View style={{...}}> ... </View>
    inner_start = header_content_raw.find(">") + 1
    inner_end = header_content_raw.rfind("</View>")
    
    inner_content = header_content_raw[inner_start:inner_end].strip()

    floating_header = """
        {/* Floating TopBar */}
        <MotiView
            from={{ translateY: -20, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            style={[
                styles.floatingTopBar,
                {
                    position: 'absolute',
                    top: insets.top + S.sm,
                    left: S.lg,
                    right: S.lg,
                    zIndex: 100,
                    backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    elevation: Platform.OS === 'android' ? 4 : 0,
                },
                Platform.OS !== 'android' && (isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow)
            ]}
        >
            {Platform.OS !== 'android' && (
              <BlurView
                  intensity={isDark ? 50 : 30}
                  tint={colorScheme}
                  style={StyleSheet.absoluteFill}
              />
            )}
            <View style={[styles.topBarContent, { paddingHorizontal: S.md }]}>
                __INNER_CONTENT__
            </View>
        </MotiView>
""".replace("__INNER_CONTENT__", inner_content)

    # Remove the old header from inside the SafeAreaView
    content = content[:header_start] + content[header_end:]
    
    # Insert floating header as a sibling to SafeAreaView
    safe_area_start = content.find("<SafeAreaView style={{ flex: 1 }} edges={['top']}>")
    if safe_area_start != -1:
        content = content[:safe_area_start] + floating_header + "\n      " + content[safe_area_start:]

    # Adjust FlatList padding to make space for floating header
    content = content.replace("paddingTop: 10", "paddingTop: 80")

    # Add missing styles if they don't exist
    if "floatingTopBar:" not in content:
        styles_end = content.find("});", content.rfind("const styles = StyleSheet.create({"))
        if styles_end != -1:
            styles_to_add = """
    floatingTopBar: { borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin },
    lightTopBarShadow: { shadowColor: '#2d2f31', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 8 },
    darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
    topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
"""
            content = content[:styles_end] + styles_to_add + content[styles_end:]

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Applied floating header!")

apply_floating_header()
