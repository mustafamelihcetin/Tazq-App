import re

def build_smart_header():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Import reanimated hooks
    if "useSharedValue" not in content:
        content = content.replace("useMemo, useCallback } from 'react';", "useMemo, useCallback } from 'react';\nimport { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withTiming } from 'react-native-reanimated';")

    # 2. Add scroll hooks inside ActionCenter component
    hooks_insertion = """
  const scrollY = useSharedValue(0);
  const scrollDir = useSharedValue(0); // 0 = up, 1 = down
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentScrollY = event.contentOffset.y;
      if (currentScrollY > scrollY.value + 5 && currentScrollY > 50) {
        scrollDir.value = 1; // scrolling down
      } else if (currentScrollY < scrollY.value - 5) {
        scrollDir.value = 0; // scrolling up
      }
      scrollY.value = currentScrollY;
    }
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: withTiming(scrollDir.value === 1 ? -300 : 0, { duration: 300 }) }],
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: theme.background
    };
  });
"""
    if "const scrollY = useSharedValue(0);" not in content:
        target = "export default function ActionCenter() {"
        idx = content.find(target)
        if idx != -1:
            next_line_idx = content.find('\n', idx) + 1
            theme_idx = content.find("const isDark = colorScheme === 'dark';", next_line_idx)
            if theme_idx != -1:
                insert_idx = content.find('\n', theme_idx) + 1
                content = content[:insert_idx] + hooks_insertion + content[insert_idx:]

    # 3. Extract ListHeaderComponent
    start_str = "ListHeaderComponent={() => ("
    start_idx = content.find(start_str)
    
    if start_idx != -1:
        end_str = "ListEmptyComponent={"
        end_idx = content.find(end_str, start_idx)
        
        if end_idx != -1:
            header_content = content[start_idx + len(start_str):end_idx].strip()
            if header_content.endswith(')}'):
                header_content = header_content[:-2].strip()
                if header_content.endswith(','):
                    header_content = header_content[:-1].strip()
                
            # Remove ListHeaderComponent from FlatList
            content = content[:start_idx] + content[end_idx:]
            
            flatlist_start = content.find("<Animated.FlatList")
            
            if flatlist_start != -1:
                # Use double braces to escape f-string evaluation!
                wrapped_header = f"""
        <Animated.View style={{headerAnimatedStyle}}>
            <View style={{paddingBottom: 10, backgroundColor: theme.background, zIndex: 999}}>
                {header_content}
            </View>
        </Animated.View>
"""
                content = content[:flatlist_start] + wrapped_header + content[flatlist_start:]
                
            if "onScroll={scrollHandler}" not in content:
                content = content.replace("<Animated.FlatList", "<Animated.FlatList onScroll={scrollHandler} scrollEventThrottle={16}")
                
            content = content.replace("paddingTop: 10", "paddingTop: 150")

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Implemented Smart Header!")

build_smart_header()
