import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTaskStore } from '../store/useTaskStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { S, F, R, B } from '../constants/tokens';
import { TaskService } from '../services/api';
import { useNetworkStore } from '../store/useNetworkStore';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { Touchable } from '@/components/Touchable';
import { CustomAlert as Alert } from '../components/CustomAlert';

export default function ArchiveScreen() {
    const { theme, isDark } = useAppTheme();
    const { language } = useLanguageStore();
    const router = useRouter();
    
    const tasks = useTaskStore(state => state.tasks);
    const updateTask = useTaskStore(state => state.updateTask);
    const removeTask = useTaskStore(state => state.removeTask);

    const archivedTasks = tasks.filter(t => t.isArchived);

    const handleRestore = async (task: any) => {
        const payload = { ...task, isArchived: false };
        updateTask(task.id, { isArchived: false });
        
        const isOnline = useNetworkStore.getState().isOnline;
        if (!isOnline) {
            useOfflineQueue.getState().enqueue({ type: 'update-task', id: task.id, payload });
        } else {
            try {
                await TaskService.updateTask(task.id, payload);
            } catch (err: any) {
                if (!err.response) {
                    useOfflineQueue.getState().enqueue({ type: 'update-task', id: task.id, payload });
                }
            }
        }
    };

    const performDelete = async (id: number) => {
        removeTask(id);

        const isOnline = useNetworkStore.getState().isOnline;
        if (!isOnline) {
            useOfflineQueue.getState().enqueue({ type: 'delete-task', id });
        } else {
            try {
                await TaskService.deleteTask(id);
            } catch (err: any) {
                if (!err.response) {
                    useOfflineQueue.getState().enqueue({ type: 'delete-task', id });
                }
            }
        }
    };

    // Kalıcı silme geri alınamaz → açık onay iste (uygulamanın geri kalanıyla aynı desen).
    const handleDelete = (id: number) => {
        Alert.alert(
            language === 'tr' ? 'Kalıcı olarak sil?' : 'Delete permanently?',
            language === 'tr' ? 'Bu görev kalıcı olarak silinecek. Bu işlem geri alınamaz.' : 'This task will be permanently deleted. This cannot be undone.',
            [
                { text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' },
                { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => performDelete(id) },
            ],
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.outline }]}>
                <Touchable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Geri' : 'Back'}>
                    <ArrowLeft size={24} color={theme.onBackground} />
                </Touchable>
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
                            <Touchable onPress={() => handleRestore(item)} style={[styles.actionBtn, { backgroundColor: theme.primary + '1A' }]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Geri yükle' : 'Restore'}>
                                <RotateCcw size={18} color={theme.primary} />
                            </Touchable>
                            <Touchable onPress={() => handleDelete(item.id)} style={[styles.actionBtn, { backgroundColor: theme.error + '1A' }]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kalıcı sil' : 'Delete permanently'}>
                                <Trash2 size={18} color={theme.error} />
                            </Touchable>
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
        fontSize: F.title,
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
