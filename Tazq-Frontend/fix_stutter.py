import re

def fix_stutter():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Add LinearTransition to imports
    if "LinearTransition" not in content:
        content = content.replace("import Animated, { Layout } from 'react-native-reanimated';", "import Animated, { Layout, LinearTransition } from 'react-native-reanimated';")

    # Remove the conflicting layout prop on MemoizedTaskItem's root
    # <Animated.View layout={Layout.springify().damping(20).stiffness(60).mass(1.2).delay(250)}>
    conflicting_layout = "<Animated.View layout={Layout.springify().damping(20).stiffness(60).mass(1.2).delay(250)}>"
    if conflicting_layout in content:
        content = content.replace(conflicting_layout, "<Animated.View>")
        
    # Also just in case they have a different delay or mass, let's use regex
    content = re.sub(r'<Animated\.View layout=\{Layout\.springify\([^}]+\}>', '<Animated.View>', content)

    # Change the itemLayoutAnimation on Animated.FlatList
    # <Animated.FlatList itemLayoutAnimation={Layout.springify().damping(20).stiffness(60).mass(1.2)}
    old_flatlist_layout = "<Animated.FlatList itemLayoutAnimation={Layout.springify().damping(20).stiffness(60).mass(1.2)}"
    # LinearTransition is the recommended way to handle list items shifting in Reanimated 3
    new_flatlist_layout = "<Animated.FlatList itemLayoutAnimation={LinearTransition.springify().damping(18).stiffness(90)}"
    
    if old_flatlist_layout in content:
        content = content.replace(old_flatlist_layout, new_flatlist_layout)
    else:
        # Fallback regex
        content = re.sub(r'<Animated\.FlatList itemLayoutAnimation=\{Layout\.springify\([^}]+\}', new_flatlist_layout, content)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed layout animation stutter!")

fix_stutter()
