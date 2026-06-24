import re

with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add FlatList if missing
if "FlatList" not in content.split("from 'react-native';")[0]:
    content = content.replace("import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager } from 'react-native';",
                              "import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, LayoutAnimation, UIManager, FlatList } from 'react-native';")

# 2. Fix Set<string> back to Set<number>
content = content.replace("useState<Set<string>>(new Set())", "useState<Set<number>>(new Set())")

# 3. Fix handleLongPress / handleBulkSelect type inside FlatList renderItem
content = content.replace("handleLongPress={(id: string) => {", "handleLongPress={(id: number) => {")
content = content.replace("handleBulkSelect={(id: string) => {", "handleBulkSelect={(id: number) => {")

# 4. If expandedId was modified to string, check its useState.
# Actually, the user error says:
# "Argument of type 'string' is not assignable to parameter of type 'number'."
# Let's check where it says this.
# Line 1546: handleToggleExpand(task.id) -> handleToggleExpand expects `number`, task.id is `number`. 
# Wait, let's fix `(id: string)` in `MemoizedTaskItem` if I added it anywhere else.

with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
