import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { TaskService } from '../services/api';
import { GlassCard } from '../components/GlassCard';
import { MotiView } from 'moti';
import { Plus, Check, Calendar, Settings, Filter } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';

const TaskCard = ({ task, index }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const toggleTask = useTaskStore(state => state.toggleTaskCompletion);

  const handleToggle = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toggleTask(task.id);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 100, type: 'timing', duration: 400 }}
      style={{ marginBottom: 16 }}
    >
      <GlassCard>
        <TouchableOpacity 
          onPress={handleToggle}
          className="flex-row items-center space-x-4"
        >
          <View className={`w-10 h-10 rounded-full border-2 items-center justify-center ${task.isCompleted ? 'bg-indigo-500 border-indigo-500' : 'border-indigo-500/30'}`}>
            {task.isCompleted && <Check size={20} color="white" />}
          </View>
          
          <View className="flex-1">
            <Text 
              className={`text-lg font-bold ${task.isCompleted ? 'opacity-40 italic line-through' : ''}`}
              style={{ color: theme.text }}
            >
              {task.title}
            </Text>
            
            <View className="flex-row items-center mt-1 opacity-60">
              <Calendar size={12} color={theme.text} />
              <Text className="text-xs ml-1" style={{ color: theme.text }}>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('tr-TR') : 'Süresiz'}
              </Text>
              <Text className="text-xs mx-2">•</Text>
              <Text className="text-xs" style={{ color: theme.text }}>{task.priority}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </GlassCard>
    </MotiView>
  );
};

export default function HomeScreen() {
  const { tasks, isLoading, dailyProgressText, setTasks, setLoading } = useTaskStore();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const fetchTasks = async () => {
    setLoading(true);
    try {
      // Mocking for now to show UI, will connect to real API once backend is running
      const mockTasks = [
        { id: 1, title: 'Tazq-App Flutter Geçişi', description: 'Tüm frontendi fluttera taşı', isCompleted: false, priority: 'High', dueDate: new Date().toISOString() },
        { id: 2, title: 'Premium Tasarım İnce Ayarı', description: 'Animasyonları yağ gibi akıt', isCompleted: true, priority: 'Medium', dueDate: new Date().toISOString() },
      ];
      setTasks(mockTasks);
      
      // Real API call (uncomment when backend ready)
      // const data = await TaskService.getTasks();
      // setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <SafeAreaView className="flex-1 px-6">
      {/* Premium Header */}
      <View className="flex-row justify-between items-start mt-8 mb-6">
        <View>
          <Text className="text-3xl font-black tracking-tighter text-indigo-500">TAZQ</Text>
          <Text className="text-xs opacity-60 mt-1" style={{ color: theme.text }}>{dailyProgressText}</Text>
        </View>
        
        <View className="flex-row space-x-3">
           <TouchableOpacity className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <Filter size={20} color={theme.text} />
           </TouchableOpacity>
           <TouchableOpacity className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <Settings size={20} color={theme.text} />
           </TouchableOpacity>
        </View>
      </View>

      {/* Task List */}
      <FlatList
        data={tasks}
        renderItem={({ item, index }) => <TaskCard task={item} index={index} />}
        keyExtractor={item => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center mt-20 opacity-40">
            <Text className="text-6xl mb-4">✨</Text>
            <Text className="text-xl font-bold" style={{ color: theme.text }}>Tertemiz Bir Sayfa</Text>
            <Text className="text-sm text-center px-10 mt-2" style={{ color: theme.text }}>
              Bugün harika şeyler yapmak için mükemmel bir gün.
            </Text>
          </View>
        }
      />

      {/* Modern FAB */}
      <TouchableOpacity 
        className="absolute bottom-10 right-8 w-16 h-16 bg-indigo-500 rounded-3xl items-center justify-center shadow-2xl shadow-indigo-500/50"
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
      >
        <Plus size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
