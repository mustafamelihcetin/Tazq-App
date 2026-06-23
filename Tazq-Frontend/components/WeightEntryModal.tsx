/**
 * WeightEntryModal
 *
 * Task listesinde "weight_entry" tag'li bir göreve basılınca açılır.
 * Minimal bottom sheet: sadece kilo girişi + kaydet.
 * Modlar ekranına yönlendirmek yerine bu modal'ı kullanıyoruz.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Activity } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { useSporStore, getThisWeekEntry } from '../store/useSporStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useTaskStore } from '../store/useTaskStore';
import { TaskService } from '../services/api';
import { S, R, F, B } from '../constants/tokens';
import { usePlanAdaptations } from '../hooks/usePlanAdaptations';
import { Touchable } from '@/components/Touchable';

interface Props {
  visible: boolean;
  taskId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function WeightEntryModal({ visible, taskId, onClose, onSaved }: Props) {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const { weightLog, addWeightEntry, currentWeight: storedCW } = useSporStore();
  const { sporPlanTaskIds, sporPlanHabitIds, setPlanIds } = usePrefsStore();
  const { toggleTaskCompletion } = useTaskStore();
  const { runAdaptations } = usePlanAdaptations();

  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const thisWeek = getThisWeekEntry(weightLog);
  const lastWeight = weightLog[0]?.weight;

  useEffect(() => {
    if (visible) {
      setInput(lastWeight ? String(lastWeight) : '');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  const handleSave = async () => {
    const kg = parseFloat(input.replace(',', '.'));
    if (isNaN(kg) || kg < 20 || kg > 300) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      addWeightEntry(kg);

      // Mevcut weight_entry görevini tamamla
      if (taskId) {
        toggleTaskCompletion(taskId);
        await TaskService.updateTask(taskId, { isCompleted: true }).catch(() => {});
      }

      // 7 gün sonraya yeni tartı görevi oluştur
      if (sporPlanTaskIds.length > 0 || sporPlanHabitIds.length > 0) {
        const next = new Date();
        next.setDate(next.getDate() + 7);
        next.setHours(8, 0, 0, 0);
        try {
          const newTask = await TaskService.createTask({
            title: tr ? 'Haftalık tartı zamanı — sabah aç karna' : 'Weekly weigh-in — morning fasted',
            description: '',
            priority: 'Medium',
            dueDate: next.toISOString(),
            isCompleted: false,
            tags: ['weight_entry'],
          });
          if (newTask?.id) {
            useTaskStore.getState().addTask(newTask);
            setPlanIds('spor', sporPlanHabitIds, [...sporPlanTaskIds, newTask.id]);
          }
        } catch {}
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose();

      // Adaptasyon motoru çalıştır
      setTimeout(() => runAdaptations(true), 400);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const parsedInput = parseFloat(input.replace(',', '.'));
  const diff = lastWeight && !isNaN(parsedInput) && parsedInput > 0 ? parsedInput - lastWeight : null;
  const diffColor = diff === null ? theme.onSurfaceVariant : diff < 0 ? '#10B981' : diff > 0 ? '#EF4444' : theme.onSurfaceVariant;
  const diffLabel = diff === null ? '' : diff === 0 ? (tr ? 'Değişim yok' : 'No change') : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Touchable style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View
          style={{
            backgroundColor: isDark ? '#1C1C22' : '#FFFFFF',
            borderTopLeftRadius: R.xl,
            borderTopRightRadius: R.xl,
            paddingTop: S.sm,
            paddingBottom: insets.bottom > 0 ? insets.bottom : S.xl,
            paddingHorizontal: S.lg,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Handle */}
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', marginBottom: S.lg }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.lg }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#10B981" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>
                {tr ? 'Haftalık Tartı' : 'Weekly Weigh-In'}
              </Text>
              {thisWeek ? (
                <Text style={{ color: '#10B981', fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>
                  {tr ? `Bu hafta: ${thisWeek.weight} kg kaydedildi` : `This week: ${thisWeek.weight} kg logged`}
                </Text>
              ) : (
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                  {tr ? 'Sabah aç karna ölç — en doğru sonuç' : 'Measure fasted in the morning — most accurate'}
                </Text>
              )}
            </View>
          </View>

          {/* Input row */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: S.sm,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: R.md, borderWidth: B.thin,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            paddingHorizontal: S.md, paddingVertical: S.sm,
            marginBottom: S.sm,
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={lastWeight ? String(lastWeight) : (tr ? 'kg' : 'kg')}
              placeholderTextColor={theme.onSurfaceVariant + '60'}
              keyboardType="decimal-pad"
              autoFocus
              style={{ flex: 1, fontSize: 28, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}
            />
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontWeight: '700' }}>kg</Text>
          </View>

          {/* Diff indicator */}
          {diffLabel ? (
            <Text style={{ color: diffColor, fontSize: F.caption, fontWeight: '800', textAlign: 'right', marginBottom: S.md }}>
              {diffLabel}
            </Text>
          ) : (
            <View style={{ marginBottom: S.md }} />
          )}

          {/* Weight log mini (last 3) */}
          {weightLog.length > 0 && (
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.lg }}>
              {weightLog.slice(0, 3).map((e, i) => (
                <View key={e.date} style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.sm, paddingVertical: S.xs, alignItems: 'center' }}>
                  <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.caption }}>{e.weight} kg</Text>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.5, marginTop: 2 }}>
                    {new Date(e.date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Save button */}
          <Touchable
            onPress={handleSave}
            disabled={saving || !input}
            style={{
              backgroundColor: '#10B981',
              borderRadius: R.full,
              paddingVertical: S.md,
              alignItems: 'center',
              opacity: (!input || saving) ? 0.5 : 1,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: F.body }}>
              {saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save')}
            </Text>
          </Touchable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
