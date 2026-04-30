import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView } from 'moti';
import { Settings, TrendingUp, Calendar, Plus, FileText, ChevronRight, LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { tasks, isLoading, setTasks, setLoading } = useTaskStore();
  const { logout, user } = useAuthStore();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const mockTasks = [
        { id: 1, title: 'Design Review', description: 'Review the new mobile UI tokens', isCompleted: false, priority: 'High', tags: ['design'], dueDate: new Date().toISOString() },
        { id: 2, title: 'Coffee Break', description: 'Take a short break', isCompleted: true, priority: 'Low', tags: ['personal'], dueDate: new Date().toISOString() },
        { id: 3, title: 'Team Meeting', description: 'Weekly sync with the team', isCompleted: false, priority: 'Medium', tags: ['work'], dueDate: new Date().toISOString() },
      ];
      setTasks(mockTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      "Oturumu Kapat",
      "Çıkış yapmak istediğine emin misin?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Çıkış Yap", style: "destructive", onPress: () => {
             Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
             logout();
             router.replace('/login');
        }}
      ]
    );
  };

  const handleNewTask = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Yeni Görev", "Görev ekleme modülü yakında burada olacak!");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        {/* Top Bar */}
        <View className="px-8 pt-4 pb-2 flex-row justify-between items-center">
            <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20">
                    <Image 
                        source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFZ3m28QnuLs5EMoE9_1uEJEmGY1pjB6T07vElwibKzCCpVmT7Cj8z7EgnfYMDQDtMJvo9Y2eBwLV5eLzVNiAKE1prmMLuaDhXoKFom_6YAbaPlLwzPuN8Tw5j7p94PHtyi4XOnUk0quau6M5yplmOzTMftU3d8F-TztimMktFyZT6-joWCyyLhLyh58s8OdWLzcfqcaXddyeQN380_dkJUKerJ58KvudT8WguZ15qhFDnhr9Uhjp5ww7HOGl1TixrnPJCRY4RGXA' }} 
                        className="w-full h-full"
                    />
                </View>
                <Text className="text-xl font-black tracking-tighter" style={{ color: theme.onSurface }}>TAZQ</Text>
            </View>
            <TouchableOpacity 
                onPress={handleLogout}
                className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center border border-white/10"
            >
                <LogOut size={18} color={theme.error || '#ff4444'} />
            </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
          {/* Greeting */}
          <MotiView 
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            className="px-8 mt-6"
          >
            <Text className="text-4xl font-black tracking-tighter" style={{ color: theme.onSurface }}>
                Good Morning
            </Text>
            <Text className="text-sm mt-1 font-medium opacity-60" style={{ color: theme.onSurfaceVariant }}>
                Hi {user?.name || 'there'}, ready to conquer the day?
            </Text>
          </MotiView>

          {/* Dynamic Island Focus */}
          <DynamicIsland />

          {/* Bento Grid Layout - Refined Asymmetry */}
          <View className="px-6 flex-row flex-wrap gap-4 mt-2 mb-10">
            
            {/* Weekly Progress - Large (100% width) */}
            <BentoCard index={1} className="w-full">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-lg font-bold" style={{ color: theme.onSurface }}>Weekly Growth</Text>
                  <Text className="text-xs opacity-60" style={{ color: theme.onSurfaceVariant }}>You are 15% ahead of target.</Text>
                </View>
                <View className="bg-tertiary/20 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                    <TrendingUp size={12} color={theme.tertiary} />
                    <Text className="text-[10px] font-black uppercase" style={{ color: theme.tertiary }}>On Track</Text>
                </View>
              </View>
              <View className="flex-row items-end gap-2 h-24 mt-4">
                {[4, 6, 3, 9, 5, 2, 7].map((val, i) => (
                  <View 
                    key={i} 
                    className={`flex-1 rounded-t-xl ${i === 3 ? 'bg-primary' : 'bg-surface-container-high/50'}`} 
                    style={{ height: `${val * 10}%` }} 
                  />
                ))}
              </View>
            </BentoCard>

            {/* Upcoming Agenda - Asymmetric Split Left */}
            <BentoCard index={2} className="w-[58%]" glass>
              <View className="flex-row items-center gap-2 mb-4">
                <Calendar size={18} color={theme.secondary} />
                <Text className="text-base font-bold" style={{ color: theme.onSurface }}>Agenda</Text>
              </View>
              <View className="gap-3">
                 <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold" style={{ color: theme.onSurface }}>Design Sync</Text>
                    <ChevronRight size={14} color={theme.onSurfaceVariant} />
                 </View>
                 <Text className="text-[10px] opacity-60" style={{ color: theme.onSurfaceVariant }}>10:00 - 11:30 AM</Text>
              </View>
            </BentoCard>

            {/* Task Count - Asymmetric Split Right */}
            <BentoCard index={3} className="flex-1 items-center justify-center">
                <Text className="text-3xl font-black" style={{ color: theme.primary }}>{tasks.length}</Text>
                <Text className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: theme.onSurfaceVariant }}>Tasks</Text>
            </BentoCard>

            {/* Quick Actions */}
            <View className="w-full flex-row gap-4">
                <TouchableOpacity 
                    onPress={handleNewTask}
                    activeOpacity={0.9}
                    className="flex-1 bg-primary/5 rounded-[40px] px-6 py-8 items-center border border-primary/10"
                >
                    <View className="w-12 h-12 rounded-full bg-primary items-center justify-center mb-3 shadow-lg shadow-primary/20">
                        <Plus size={24} color="white" />
                    </View>
                    <Text className="text-xs font-bold" style={{ color: theme.primary }}>New Task</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    activeOpacity={0.9}
                    className="flex-1 bg-secondary/5 rounded-[40px] px-6 py-8 items-center border border-secondary/10"
                >
                    <View className="w-12 h-12 rounded-full bg-secondary items-center justify-center mb-3 shadow-lg shadow-secondary/20">
                        <FileText size={20} color="white" />
                    </View>
                    <Text className="text-xs font-bold" style={{ color: theme.secondary }}>Draft Note</Text>
                </TouchableOpacity>
            </View>

          </View>
          
          <View className="h-24" />
        </ScrollView>
      </SafeAreaView>

      <BottomNavBar />
    </View>
  );
}
