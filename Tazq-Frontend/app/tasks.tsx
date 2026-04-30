import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Check, Timer, Trash2, Plus, Settings, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function ActionCenter() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { tasks, toggleTaskCompletion } = useTaskStore();
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
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Sticky Header Fix (Using Absolute vs Fixed) */}
        <View style={styles.headerContainer} className="px-8 py-4 flex-row justify-between items-center z-50">
            <BlurView intensity={80} tint={colorScheme} style={StyleSheet.absoluteFill} />
            <Text className="font-black tracking-tighter text-2xl" style={{ color: theme.onSurface }}>TAZQ</Text>
            <TouchableOpacity className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low border border-white/10">
                <Plus size={22} color={theme.primary} />
            </TouchableOpacity>
        </View>

        <ScrollView 
            className="flex-1 px-6" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: 120 }}
        >
          {/* Headline */}
          <MotiView 
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            className="mb-8"
          >
            <Text className="text-5xl font-black tracking-tighter" style={{ color: theme.primary }}>
                Action Center
            </Text>
            <Text className="text-base mt-2 font-medium opacity-60" style={{ color: theme.onSurfaceVariant }}>
                Tüm görevlerin burada, aksiyona hazır mısın?
            </Text>
          </MotiView>

          {/* Bento Stats Overview */}
          <View className="flex-row gap-4 mb-10">
            <BentoCard className="flex-2" index={1}>
                <View className="flex-1 justify-between">
                    <View>
                        <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.primary }}>Currently Focusing</Text>
                        <Text className="text-base font-bold mt-1" style={{ color: theme.onSurface }}>Design Review</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => handleStartTimer('Design Review')}
                        className="bg-primary self-start rounded-full px-6 py-2.5 mt-4 shadow-lg shadow-primary/30"
                    >
                        <Text className="text-white text-xs font-black">Start Timer</Text>
                    </TouchableOpacity>
                </View>
            </BentoCard>

            <BentoCard className="flex-1 items-center justify-center text-center" index={2} glass>
                <View className="w-12 h-12 rounded-full bg-tertiary/10 items-center justify-center mb-2">
                    <Check size={24} color={theme.tertiary} />
                </View>
                <Text className="text-xl font-black" style={{ color: theme.onSurface }}>12</Text>
                <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: theme.onSurfaceVariant }}>Done</Text>
            </BentoCard>
          </View>

          {/* Task List */}
          <View className="mb-10">
            <Text className="text-xl font-black mb-6 tracking-tight" style={{ color: theme.onSurface }}>Sıradakiler</Text>
            
            <AnimatePresence>
                {tasks.map((task, i) => (
                <MotiView 
                    key={task.id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 80 }}
                    className="mb-4"
                >
                    <TouchableOpacity 
                        activeOpacity={0.9}
                        onPress={() => handleToggle(task.id)}
                        className="bg-surface-container-lowest rounded-[24px] p-5 flex-row items-center border border-white/10 shadow-sm"
                    >
                        <View 
                            className={`w-1.5 h-10 rounded-full mr-4 ${task.priority === 'High' ? 'bg-error' : 'bg-primary/20'}`} 
                        />
                        <View className="flex-1">
                            <Text 
                                className={`text-base font-bold ${task.isCompleted ? 'line-through opacity-40' : ''}`} 
                                style={{ color: theme.onSurface }}
                                numberOfLines={1}
                            >
                                {task.title}
                            </Text>
                            <Text className="text-[10px] font-medium opacity-50" style={{ color: theme.onSurfaceVariant }}>
                                {task.isCompleted ? 'Task Completed' : 'Waiting for action'}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            {task.priority === 'High' && !task.isCompleted && (
                                <View className="bg-error/10 px-2 py-1 rounded-full">
                                    <Text className="text-[8px] font-black text-error">HIGH</Text>
                                </View>
                            )}
                            <View className={`w-10 h-10 rounded-full items-center justify-center ${task.isCompleted ? 'bg-tertiary' : 'bg-surface-container'}`}>
                                <Check size={18} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
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
            Alert.alert("Ekle", "Yeni görev ekleme penceresi hazırlanıyor.");
        }}
        className="absolute bottom-32 right-8 w-16 h-16 rounded-full bg-primary items-center justify-center shadow-2xl shadow-primary/40 z-50"
      >
           <Plus size={32} color="white" />
      </TouchableOpacity>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  }
});
