import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { F, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { Task } from '@/features/tasks/store/useTaskStore';
import { Check } from 'lucide-react-native';
import { getLocalizedTaskTitle } from '@/features/tasks';

export interface TriageModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (keptTask: Task, tasksToMove: Task[]) => void;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
}

export const TriageModal = React.memo<TriageModalProps>(({ 
  visible, onClose, tasks, onSelectTask, theme, isDark, tr 
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={isDark ? 50 : 30} style={StyleSheet.absoluteFill} tint={isDark ? "dark" : "light"}>
        
        <View style={styles.contentContainer}>
          <MotiView 
            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250 }}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.outlineVariant, borderWidth: 1 }]}>
              
              <Text style={[styles.title, { color: theme.onSurface }]}>
                {tr ? 'Bugün Çok Dolusun' : 'Overwhelmed Today'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.onSurfaceMuted }]}>
                {tr 
                  ? 'Günü kurtarmak için yapacağın EN ÖNEMLİ tek bir görevi seç. Gerisini senin için diğer günlere dağıtacağım.' 
                  : 'To save the day, pick the ONE most important task you will do today. I will distribute the rest.'}
              </Text>

              <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
                {tasks.map(task => (
                  <TouchableOpacity 
                    key={task.id}
                    style={[styles.taskRow, { borderColor: theme.outlineVariant }]}
                    onPress={() => {
                      const tasksToMove = tasks.filter(t => t.id !== task.id);
                      onSelectTask(task, tasksToMove);
                    }}
                  >
                    <View style={styles.taskTextWrapper}>
                      <Text style={[styles.taskTitle, { color: theme.onSurface }]} numberOfLines={1}>
                        {getLocalizedTaskTitle(task, tr)}
                      </Text>
                    </View>
                    <View style={[styles.circle, { borderColor: theme.primary }]}>
                      <Check size={14} color="transparent" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={[styles.cancelText, { color: theme.onSurfaceMuted }]}>
                  {tr ? 'İptal' : 'Cancel'}
                </Text>
              </TouchableOpacity>

            </View>
          </MotiView>
        </View>
      </BlurView>
    </Modal>
  );
});

TriageModal.displayName = 'TriageModal';

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.lg,
    zIndex: 10,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: S.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  title: {
    fontSize: F.title,
    fontWeight: W.bold,
    marginBottom: S.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: F.subhead,
    textAlign: 'center',
    marginBottom: S.xl,
    lineHeight: 20,
  },
  taskList: {
    maxHeight: 300,
    marginBottom: S.lg,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskTextWrapper: {
    flex: 1,
    paddingRight: S.md,
  },
  taskTitle: {
    fontSize: F.body,
    fontWeight: W.medium,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: S.md,
  },
  cancelText: {
    fontSize: F.body,
    fontWeight: W.bold,
  }
});
