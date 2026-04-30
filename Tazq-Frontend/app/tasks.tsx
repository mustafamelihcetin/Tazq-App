import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Check, Timer, Trash2, Plus, Settings, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function ActionCenter() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { tasks, toggleTaskCompletion } = useTaskStore();
  const { t } = useLanguageStore();
  const router = useRouter();

  const handleToggle = (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toggleTaskCompletion(id);
  };

  const handleStartTimer = (taskName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push('/focus');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.headerContainer}>
            <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.logoText, { color: theme.onSurface }]}>TAZQ</Text>
                <TouchableOpacity 
                    onPress={() => Alert.alert(t.newTask, t.waitingForAction)}
                    style={[styles.plusBtn, { backgroundColor: theme.surfaceContainerLow }]}
                >
                    <Plus size={22} color={theme.primary} />
                </TouchableOpacity>
            </View>
        </View>

        <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: 120, paddingHorizontal: 24 }}
        >
          {/* Headline */}
          <MotiView 
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={{ marginBottom: 32 }}
          >
            <Text style={[styles.headlineTitle, { color: theme.primary }]}>
                {t.actionCenter}
            </Text>
            <Text style={[styles.headlineSub, { color: theme.onSurfaceVariant }]}>
                {t.allTasksReady}
            </Text>
          </MotiView>

          {/* Bento Stats Overview */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 40 }}>
            <BentoCard style={{ flex: 2 }} index={1}>
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View>
                        <Text style={[styles.statCategory, { color: theme.primary }]}>{t.activeStreak}</Text>
                        <Text style={[styles.statName, { color: theme.onSurface }]}>Design Review</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => handleStartTimer('Design Review')}
                        style={[styles.timerBtn, { backgroundColor: theme.primary }]}
                    >
                        <Text style={styles.timerBtnText}>Start Timer</Text>
                    </TouchableOpacity>
                </View>
            </BentoCard>

            <BentoCard style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} index={2} glass>
                <View style={[styles.checkCircle, { backgroundColor: theme.tertiary + '15' }]}>
                    <Check size={24} color={theme.tertiary} />
                </View>
                <Text style={[styles.statValue, { color: theme.onSurface }]}>{tasks.filter(t => t.isCompleted).length}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.completedTasks}</Text>
            </BentoCard>
          </View>

          {/* Task List */}
          <View>
            <Text style={[styles.listTitle, { color: theme.onSurface }]}>{t.upcoming}</Text>
            
            <AnimatePresence>
                {tasks.map((task, i) => (
                <MotiView 
                    key={task.id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 80 }}
                    style={{ marginBottom: 16 }}
                >
                    <TouchableOpacity 
                        activeOpacity={0.9}
                        onPress={() => handleToggle(task.id)}
                        style={[styles.taskItem, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant + '15' }]}
                    >
                        <View 
                            style={[styles.priorityIndicator, { backgroundColor: task.priority === 'High' ? theme.error : theme.primary + '20' }]} 
                        />
                        <View style={{ flex: 1 }}>
                            <Text 
                                style={[
                                    styles.taskTitle, 
                                    { color: theme.onSurface },
                                    task.isCompleted && { textDecorationLine: 'line-through', opacity: 0.4 }
                                ]}
                                numberOfLines={1}
                            >
                                {task.title}
                            </Text>
                            <Text style={[styles.taskStatus, { color: theme.onSurfaceVariant }]}>
                                {task.isCompleted ? t.taskCompleted : t.waitingForAction}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {task.priority === 'High' && !task.isCompleted && (
                                <View style={[styles.highPriorityBadge, { backgroundColor: theme.error + '15' }]}>
                                    <Text style={[styles.highPriorityText, { color: theme.error }]}>HIGH</Text>
                                </View>
                            )}
                            <View style={[styles.checkContainer, { backgroundColor: task.isCompleted ? theme.tertiary : theme.surfaceContainerHigh }]}>
                                <Check size={16} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
                            </View>
                        </View>
                    </TouchableOpacity>
                </MotiView>
                ))}
            </AnimatePresence>
          </View>
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity 
        onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(t.newTask, t.waitingForAction);
        }}
        style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
      >
           <Plus size={32} color="white" />
      </TouchableOpacity>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 70,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    zIndex: 50,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headlineTitle: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 52,
  },
  headlineSub: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
    opacity: 0.6,
  },
  statCategory: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  timerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  timerBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  taskItem: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  priorityIndicator: {
    width: 3,
    height: 32,
    borderRadius: 3,
    marginRight: 16,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  taskStatus: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.5,
  },
  highPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  highPriorityText: {
    fontSize: 8,
    fontWeight: '900',
  },
  checkContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 100,
  }
});
