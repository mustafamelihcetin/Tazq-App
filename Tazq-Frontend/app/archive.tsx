import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTaskStore } from '@/features/tasks';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { ICON, S, F, R, B, MAX_W, topBarSpace } from '@/shared/constants/tokens';
import { TaskService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { isNetworkError } from '@/shared/utils/errors';

export default function ArchiveScreen() {
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useAppTheme();
    const { language } = useLanguageStore();
    const router = useRouter();
    const { scrollY, onScroll } = useCollapsibleHeader();
    
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
            } catch (err: unknown) {
                if (isNetworkError(err)) {
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
            } catch (err: unknown) {
                if (isNetworkError(err)) {
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
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Ortak başlık: yapışık 44pt, hairline ayraç, 17pt başlık — ana ekranlarla
                aynı sistem. Eskiden satır içi kendi kopyasıydı ve başlığı 22pt'ydi;
                yani alt sayfaya inince başlık BÜYÜYORDU (hiyerarşi ters). */}
            <ScreenHeader
                onBack={() => router.back()}
                title={language === 'tr' ? 'Arşiv' : 'Archive'}
                scrollY={scrollY}
            />

            <FlatList
                data={archivedTasks}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xl, gap: S.sm, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
                ListEmptyComponent={() => (
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: S.xxl }}>
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
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginTop: S.xs }} numberOfLines={1}>
                                    {item.description}
                                </Text>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <Touchable onPress={() => handleRestore(item)} style={[styles.actionBtn, { backgroundColor: theme.primary + '1A' }]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Geri yükle' : 'Restore'}>
                                <RotateCcw size={ICON.md} color={theme.primary} />
                            </Touchable>
                            <Touchable onPress={() => handleDelete(item.id)} style={[styles.actionBtn, { backgroundColor: theme.error + '1A' }]} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kalıcı sil' : 'Delete permanently'}>
                                <Trash2 size={ICON.md} color={theme.error} />
                            </Touchable>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
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
