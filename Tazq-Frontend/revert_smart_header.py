import re

def revert_smart_header():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the start of the Animated.View that wraps the header
    header_view_start = content.find("<Animated.View style={headerAnimatedStyle}>")
    if header_view_start == -1:
        print("Could not find smart header Animated.View")
        return

    # Find the <Animated.FlatList
    flatlist_start = content.find("<Animated.FlatList", header_view_start)
    if flatlist_start == -1:
        print("Could not find FlatList")
        return

    # Extract the header content
    # The header is inside:
    # <Animated.View style={{headerAnimatedStyle}}>
    #     <View style={{paddingBottom: 10, backgroundColor: theme.background, zIndex: 999}}>
    #         {header_content}
    #     </View>
    # </Animated.View>
    
    # We want everything inside the inner View.
    inner_view_start = content.find("<View style={{paddingBottom: 10, backgroundColor: theme.background, zIndex: 999}}>", header_view_start)
    if inner_view_start == -1:
        # Check without double braces (in case my previous replace_file_content changed it slightly differently)
        inner_view_start = content.find("<View style={{paddingBottom: 10", header_view_start)
        
    if inner_view_start == -1:
        print("Could not find inner View")
        return

    # Find where the inner view ends. Since parsing HTML with regex is hard, we can just find the end of the Animated.View block
    animated_view_end = content.find("</Animated.View>", inner_view_start)
    if animated_view_end == -1:
        print("Could not find end of Animated.View")
        return

    # We need to strip the wrapping Views.
    # Actually, it's safer to just grab everything between the inner View start tag and its end tag.
    inner_view_content_start = content.find(">", inner_view_start) + 1
    
    # To find the end of the inner View, it's the </div> right before </Animated.View>
    inner_view_content_end = content.rfind("</View>", inner_view_content_start, animated_view_end)
    
    header_content = content[inner_view_content_start:inner_view_content_end].strip()

    # Reconstruct the ListHeaderComponent
    list_header_comp = f"""ListHeaderComponent={{() => (
        <React.Fragment>
            {header_content}
        </React.Fragment>
    )}}"""

    # Remove the entire <Animated.View style={{headerAnimatedStyle}}> block
    content = content[:header_view_start] + content[animated_view_end + len("</Animated.View>"):].lstrip()

    # Insert ListHeaderComponent back into FlatList
    # We can place it just before `ListEmptyComponent`
    empty_comp_idx = content.find("ListEmptyComponent={")
    if empty_comp_idx != -1:
        content = content[:empty_comp_idx] + list_header_comp + "\n            " + content[empty_comp_idx:]

    # Remove onScroll={scrollHandler} and scrollEventThrottle={16} from FlatList
    content = content.replace("onScroll={scrollHandler} scrollEventThrottle={16} ", "")

    # Revert padding: paddingTop: 150 to paddingTop: 10
    content = content.replace("paddingTop: 150", "paddingTop: 10")

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reverted Smart Header layout!")

revert_smart_header()
