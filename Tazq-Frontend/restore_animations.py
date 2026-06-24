import re

def restore_animations():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the FlatList declaration
    flatlist_start = content.find("<FlatList")
    if flatlist_start == -1:
        print("FlatList not found")
        return

    # Replace <FlatList with <Animated.FlatList
    content = content.replace("<FlatList", "<Animated.FlatList itemLayoutAnimation={Layout.springify().damping(14).stiffness(150)}\n")

    # Replace the end tag
    content = content.replace("/>\n      </SafeAreaView>", "/>\n      </SafeAreaView>") # wait, the end tag is /> not </FlatList>
    
    # We want to wrap Animated.FlatList in a MotiView for the entry animation!
    # Where does the FlatList start?
    
    # Let's extract the exact FlatList component from start to />
    # Finding the exact `/>` of FlatList is tricky if there are nested functions.
    # We can just inject the MotiView wrapper around the FlatList.
    
    # Let's do string replacement for the wrapper:
    old_start = "<Animated.FlatList itemLayoutAnimation={Layout.springify().damping(14).stiffness(150)}\n"
    new_start = """<MotiView 
          key="list" 
          from={{ opacity: 0, translateY: 20 }} 
          animate={{ opacity: 1, translateY: 0 }} 
          style={{ flex: 1 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          <Animated.FlatList itemLayoutAnimation={Layout.springify().damping(14).stiffness(150)}\n"""
          
    content = content.replace(old_start, new_start)
    
    # Now close the MotiView after the FlatList />
    # We know the FlatList ends right before </SafeAreaView>
    end_tag = "/>\n      </SafeAreaView>"
    new_end = "/>\n        </MotiView>\n      </SafeAreaView>"
    content = content.replace(end_tag, new_end)
    
    # Wait, the empty state is also in ListEmptyComponent. We should wrap it in MotiView too, but it already has one!
    # Check ListEmptyComponent:
    # ListEmptyComponent={() => (
    #     <MotiView key="empty" from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={styles.emptyState}>
    # It has its own animation!

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Animations restored!")

restore_animations()
