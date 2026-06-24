import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTaskStore } from '../store/useTaskStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { S, F, R, B } from '../constants/tokens';

export default function ArchiveScreen() {
    const { theme, isDark } = useAppTheme();
    const { language } = useLanguageStore();
    const router = useRouter();
    
    const tasks = useTaskStore(state => state.tasks);
    const updateTask = useTaskStore(state => state.updateTask);
    const deleteTask = useTaskStore(state => state.deleteTask);
    const enqueueOffline = useTaskStore(state => state.enqueueOffline);

    const archivedTasks = tasks.filter(t => t.isArchived);

    const handleRestore = (task: any) => {
        updateTask(task.id, { isArchived: false });
        enqueueOffline('update', { ...task, isArchived: false });
    };

    const handleDelete = (id: number) => {
        deleteTask(id);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.outline }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.onBackground} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.onBackground }]}>
                    {language === 'tr' ? 'Arşiv' : 'Archive'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={archivedTasks}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ padding: S.md, gap: S.sm }}
                ListEmptyComponent={() => (
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body }}>
                            {language === 'tr' ? 'Arşivde görev bulunmuyor.' : 'No archived tasks.'}
                        </Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <View style={[styles.taskCard, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outline }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600', textDecorationLine: item.isCompleted ? 'line-through' : 'none' }}>
                                {item.title}
                            </Text>
                            {item.description && (
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginTop: 4 }} numberOfLines={1}>
                                    {item.description}
                                </Text>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <TouchableOpacity onPress={() => handleRestore(item)} style={[styles.actionBtn, { backgroundColor: theme.primary + '1A' }]}>
                                <RotateCcw size={18} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.actionBtn, { backgroundColor: theme.error + '1A' }]}>
                                <Trash2 size={18} color={theme.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: S.md,
        paddingVertical: S.sm,
        borderBottomWidth: B.thin,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: F.head,
        fontWeight: '800',
    },
    taskCard: {
        flexDirection: 'row',
        padding: S.md,
        borderRadius: R.md,
        borderWidth: B.thin,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: R.sm,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
