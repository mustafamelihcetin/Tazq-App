import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Animated as RNAnimated, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Calendar, Target, Bell, X, Sparkles, Mic, Timer, Repeat, Trash2, Plus, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { Touchable } from '@/shared/components/Touchable';
import VoiceService from '@/shared/utils/voice';
import { parseTaskHint, visibleTextTags, translateTag, isInternalTag, ICON_TAGS } from '@/features/tasks';
import { S, R, F, B, scale, verticalScale, moderateScale } from '@/shared/constants/tokens';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Priority, RecurrenceType, SubtaskItem } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';
import type { AppTheme } from '@/shared/constants/Colors';

const SWIPE_THRESHOLD = -80;

interface TaskForm {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string | null;
  priority: Priority;
  tags: string[];
  subtasks: SubtaskItem[];
  recurrence: RecurrenceType;
  reminderEnabled: boolean;
}

const EMPTY_FORM: TaskForm = { 
  title: '', 
  description: '', 
  priority: 'Medium', 
  dueDate: '', 
  dueTime: null, 
  tags: [], 
  subtasks: [], 
  recurrence: 'None',
  reminderEnabled: false 
};

const RECURRENCE_OPTIONS: { key: RecurrenceType; labelKey: string }[] = [
  { key: 'None', labelKey: 'recurrenceNone' },
  { key: 'Daily', labelKey: 'recurrenceDaily' },
  { key: 'Weekly', labelKey: 'recurrenceWeekly' },
  { key: 'Monthly', labelKey: 'recurrenceMonthly' },
];

function getNextOccurrenceLabel(dueDateStr: string | null | undefined, recurrence: RecurrenceType, lang: string): string {
  if (!dueDateStr) return '';
  const isTR = lang === 'tr';
  const dateObj = new Date(dueDateStr);
  if (isNaN(dateObj.getTime())) return '';
  const nextDate = new Date(dateObj);
  
  if (recurrence === 'Daily') {
    nextDate.setDate(dateObj.getDate() + 1);
  } else if (recurrence === 'Weekly') {
    nextDate.setDate(dateObj.getDate() + 7);
  } else if (recurrence === 'Monthly') {
    nextDate.setMonth(dateObj.getMonth() + 1);
  }
  
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const formatted = nextDate.toLocaleDateString(isTR ? 'tr-TR' : 'en-US', options);
  return isTR ? `Sonraki: ${formatted}` : `Next: ${formatted}`;
}

const VoiceWave = ({ active, theme }: { active: boolean; theme: AppTheme }) => (
  <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
    <RNAnimated.View
      style={{
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.primary,
        opacity: active ? 0.35 : 0,
        transform: [{ scale: active ? 1.4 : 1 }],
        zIndex: -1,
      }}
    />
    <Mic size={18} color={active ? theme.primary : theme.onSurfaceVariant} />
  </View>
);

interface TaskFormModalProps {
  visible: boolean;
  onClose: () => void;
  task: any; // Task payload to edit, or null for creation
  onSave: (payload: any) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  t: any;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  visible,
  onClose,
  task,
  onSave,
  onDelete,
  theme,
  isDark,
  language,
  t,
}) => {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [nlpHint, setNlpHint] = useState('');
  const [showSmartHint, setShowSmartHint] = useState(true);
  
  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningDesc, setIsListeningDesc] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [pickerDate, setPickerDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [pickerTime, setPickerTime] = useState({ hour: 9, minute: 0 });
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { panResponder, animatedStyle: taskSlide, prepare: prepareTask, slideIn: taskSlideIn } = useSwipeToDismiss({
    onDismiss: () => !saving && onClose(),
  });

  // Track keyboard height
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Stop voice recognition when modal is hidden
  useEffect(() => {
    if (!visible && (isListeningTitle || isListeningDesc)) {
      VoiceService.stop().catch(() => {});
      setIsListeningTitle(false);
      setIsListeningDesc(false);
    }
  }, [visible, isListeningTitle, isListeningDesc]);

  // Populate form on edit/create toggle
  useEffect(() => {
    if (visible) {
      prepareTask();
      setSaving(false);
      setTitleError(false);
      setDateError(false);
      setNlpHint('');
      setShowDatePicker(false);
      setShowTimePicker(false);
      setNewSubtaskText('');
      
      if (task) {
        setForm({
          title: task.title,
          description: task.description || '',
          priority: (task.priority as Priority) || 'Medium',
          dueDate: task.dueDate?.split('T')[0] ?? '',
          dueTime: task.dueTime || '',
          tags: task.tags || [],
          subtasks: task.subtasks || [],
          recurrence: (task.recurrence as RecurrenceType) || 'None',
          reminderEnabled: task.tags?.includes('hatırlatıcı') || task.tags?.includes('reminder') || false
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [visible, task, prepareTask]);

  const priorityColor = (p: Priority) => {
    if (p === 'High') return theme.priorityHigh;
    if (p === 'Medium') return theme.priorityMedium;
    return theme.priorityLow;
  };

  const handleTitleChange = (text: string) => {
    if (isListeningTitle) {
      VoiceService.stop().catch(() => {});
      setIsListeningTitle(false);
    }

    if (!text.trim() && !task) {
      setForm(f => ({ ...f, title: '', priority: 'Medium', tags: [], dueDate: '', dueTime: null }));
      setNlpHint('');
      if (titleError) setTitleError(false);
      return;
    }

    const hint = parseTaskHint(text, language as 'tr' | 'en');
    const hasReminderWord = text.toLowerCase().includes('hatırlat') || text.toLowerCase().includes('remind');
    const nlpTags = hint.tags || [];

    setForm(f => {
      const currentInternal = f.tags.filter(t => isInternalTag(t) || ICON_TAGS.includes(t));
      let mergedTags = Array.from(new Set([...currentInternal, ...nlpTags]));
      if (hasReminderWord && !mergedTags.includes('hatırlatıcı')) {
        mergedTags.push('hatırlatıcı');
      }
      return {
        ...f,
        title: text,
        priority: hint.priority || f.priority,
        dueDate: hint.dueDate || f.dueDate,
        dueTime: hint.dueTime || f.dueTime,
        recurrence: hint.recurrence || f.recurrence,
        reminderEnabled: hasReminderWord ? true : f.reminderEnabled,
        tags: mergedTags
      };
    });

    if (titleError) setTitleError(false);

    // Build user facing NLP hint message
    const parts = [];
    if (hint.dueDate) {
      const dateStr = new Date(hint.dueDate).toLocaleDateString();
      parts.push(`📅 ${dateStr}`);
    }
    if (hint.dueTime) {
      const timeStr = new Date(hint.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push(`⏰ ${timeStr}`);
    }
    if (hint.recurrence && hint.recurrence !== 'None') {
      const isTR = language === 'tr';
      const recurrenceLabel: Record<string, string> = {
        Daily: isTR ? 'Her gün' : 'Daily',
        Weekly: isTR ? 'Her hafta' : 'Weekly',
        Monthly: isTR ? 'Her ay' : 'Monthly',
      };
      const label = hint.recurrenceDayLabel
        ? `Her ${hint.recurrenceDayLabel}`
        : recurrenceLabel[hint.recurrence];
      parts.push(`🔁 ${label}`);
    }

    const userFacingTags = visibleTextTags(hint.tags);
    if (userFacingTags.length > 0) {
      const translated = userFacingTags.map(t => translateTag(t, language as 'tr' | 'en'));
      parts.push(`🏷️ ${translated.join(', ')}`);
    }

    const fullHint = [
      hint.wittyMessage,
      parts.length > 0 ? `(${parts.join('  ')})` : ''
    ].filter(Boolean).join(' ');

    setNlpHint(fullHint);
  };

  const handleDescriptionChange = (text: string) => {
    if (isListeningDesc) {
      VoiceService.stop().catch(() => {});
      setIsListeningDesc(false);
    }
    setForm(f => ({ ...f, description: text }));
  };

  const toggleVoice = async (field: 'title' | 'description') => {
    const isActive = field === 'title' ? isListeningTitle : isListeningDesc;
    
    if (isActive) {
      await VoiceService.stop();
      field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      return;
    }

    if (isListeningTitle || isListeningDesc) {
      await VoiceService.stop();
      setIsListeningTitle(false);
      setIsListeningDesc(false);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    field === 'title' ? setIsListeningTitle(true) : setIsListeningDesc(true);

    await VoiceService.start({
      language: language === 'tr' ? 'tr-TR' : 'en-US',
      initialText: field === 'title' ? form.title : form.description,
      onResults: (results: string[]) => {
        if (results.length > 0) {
          const text = results[0];
          if (field === 'title') {
            handleTitleChange(text);
          } else {
            setForm(f => ({ ...f, description: text }));
          }
        }
      },
      onError: (err: any) => {
        const msg = err?.message ?? String(err);
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
        if (msg === 'permission-denied') {
          Alert.alert(
            language === 'tr' ? 'Mikrofon İzni Gerekli' : 'Microphone Permission Required',
            language === 'tr'
              ? 'Lütfen uygulama ayarlarından mikrofon iznini etkinleştirin.'
              : 'Please enable microphone permission in your device settings.'
          );
        } else if (msg === 'not-available') {
          Alert.alert(
            language === 'tr' ? 'Desteklenmiyor' : 'Not Supported',
            language === 'tr'
              ? 'Ses tanıma bu ortamda desteklenmiyor.'
              : 'Voice recognition is not supported in this environment.'
          );
        }
      },
      onEnded: () => {
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      }
    });
  };

  const openDatePicker = () => {
    const base = form.dueDate ? new Date(form.dueDate) : new Date();
    setPickerDate({ year: base.getFullYear(), month: base.getMonth() + 1, day: base.getDate() });
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    const base = form.dueTime ? new Date(form.dueTime) : new Date();
    setPickerTime({ hour: base.getHours(), minute: base.getMinutes() });
    setShowTimePicker(true);
  };

  const confirmDate = () => {
    const { year, month, day } = pickerDate;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    
    const selected = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selected < today) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setDateError(true);
      setTimeout(() => setDateError(false), 2500);
      return;
    }

    setDateError(false);
    setForm(f => ({ ...f, dueDate: `${year}-${mm}-${dd}` }));
    setShowDatePicker(false);
  };

  const confirmTime = () => {
    const base = new Date();
    base.setHours(pickerTime.hour, pickerTime.minute, 0, 0);
    setForm(f => ({ ...f, dueTime: base.toISOString() }));
    setShowTimePicker(false);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  const handleSave = async () => {
    if (!form.title.trim()) { 
      setTitleError(true); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      Alert.alert(t.errorTitle, t.titleRequired);
      return; 
    }
    
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => !saving && onClose()}
      onShow={taskSlideIn}
    >
      <View style={styles.overlay}>
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && onClose()} />

        <View style={styles.sheetContainer}>
          <RNAnimated.View
            style={[
              styles.sheet,
              taskSlide,
              {
                backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
                padding: S.lg,
                borderBottomLeftRadius: keyboardHeight > 0 ? S.xl : 0,
                borderBottomRightRadius: keyboardHeight > 0 ? S.xl : 0,
                maxHeight: scale(620), // Standard viewport layout protection
              },
            ]}
          >
            {/* Drag Handle */}
            <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
              <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
            </View>

            {/* Header */}
            <View style={[styles.sheetHeader, { marginBottom: !task ? S.sm : S.lg }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface, fontSize: F.title }]}>
                {task ? t.editTask : t.addTask}
              </Text>
              <Touchable
                onPress={() => !saving && onClose()}
                style={[styles.closeModalBtn, saving && { opacity: 0.35 }]}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
              >
                <X size={20} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>

            {/* Form Features Chips */}
            {!task && (
              <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.lg, flexWrap: 'wrap' }}>
                {[
                  { text: language === 'tr' ? 'Tarih' : 'Due date', icon: <Calendar size={10} color={theme.primary} /> },
                  { text: language === 'tr' ? 'Öncelik' : 'Priority', icon: <Target size={10} color={theme.primary} /> },
                  { text: language === 'tr' ? 'Hatırlatıcı' : 'Reminder', icon: <Bell size={10} color={theme.primary} /> }
                ].map((chip) => (
                  <View key={chip.text} style={{ backgroundColor: theme.primary + '14', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {chip.icon}
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary, letterSpacing: 0.3 }}>{chip.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: S.lg }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              {/* Title Section */}
              <View style={styles.section}>
                <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 60 }]}>
                  <TextInput
                    style={[styles.modalInput, { color: theme.onSurface, fontSize: F.body }]}
                    placeholder={isListeningTitle ? t.listeningLabel : t.taskTitle}
                    placeholderTextColor={theme.onSurfaceVariant + '99'}
                    value={form.title}
                    onChangeText={handleTitleChange}
                    maxLength={150}
                    underlineColorAndroid="transparent"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    {nlpHint ? <Sparkles size={16} color={theme.primary} /> : null}
                    <Touchable
                      onPress={() => toggleVoice('title')}
                      style={{ padding: S.xs, alignItems: 'center', justifyContent: 'center' }}
                      accessibilityRole="button"
                      accessibilityLabel={isListeningTitle ? (language === 'tr' ? 'Dinlemeyi durdur' : 'Stop listening') : (language === 'tr' ? 'Sesle yaz' : 'Voice input')}
                      accessibilityState={{ busy: isListeningTitle }}
                    >
                      <VoiceWave active={isListeningTitle} theme={theme} />
                    </Touchable>
                  </View>
                </View>

                {nlpHint ? (
                  <Text style={{ color: theme.primary, fontSize: F.caption, marginTop: S.sm, marginLeft: S.md, fontWeight: '600', letterSpacing: 0.5 }}>
                    {nlpHint}
                  </Text>
                ) : showSmartHint && !task ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, marginLeft: S.md }}>
                    <Sparkles size={11} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '600', opacity: 0.75 }}>
                      {language === 'tr'
                        ? '"yarın", "acil", "hatırlatıcı" gibi kelimeler otomatik algılanır'
                        : '"tomorrow", "urgent", "reminder" are auto-detected'}
                    </Text>
                  </View>
                ) : null}

                {/* Description */}
                <View style={[styles.inputGroup, styles.modalTextArea, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, marginTop: S.sm, height: 100 }]}>
                  <TextInput
                    style={[styles.modalInput, { color: theme.onSurface, paddingTop: S.sm, fontSize: F.body }]}
                    placeholder={isListeningDesc ? t.listeningLabel : t.taskDescription + '...'}
                    placeholderTextColor={theme.onSurfaceVariant + '99'}
                    value={form.description}
                    onChangeText={handleDescriptionChange}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    underlineColorAndroid="transparent"
                  />
                  <Touchable
                    onPress={() => toggleVoice('description')}
                    style={{ position: 'absolute', right: S.md, top: 14, padding: S.xs, alignItems: 'center', justifyContent: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel={isListeningDesc ? (language === 'tr' ? 'Dinlemeyi durdur' : 'Stop listening') : (language === 'tr' ? 'Sesle yaz' : 'Voice input')}
                    accessibilityState={{ busy: isListeningDesc }}
                  >
                    <VoiceWave active={isListeningDesc} theme={theme} />
                  </Touchable>
                </View>
              </View>

              {/* Date & Time Selection */}
              <View style={styles.section}>
                {!showDatePicker && !showTimePicker && (
                  <View style={styles.dateTimeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.md }]}>
                        {t.dueDate.toUpperCase()}
                      </Text>
                      <Touchable
                        onPress={openDatePicker}
                        style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                      >
                        <Timer size={14} color={theme.primary} />
                        <Text style={[styles.chipText, { color: form.dueDate ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]} numberOfLines={1}>
                          {form.dueDate || t.selectDate}
                        </Text>
                      </Touchable>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.md }]}>
                        {t.dueTime.toUpperCase()}
                      </Text>
                      <Touchable
                        onPress={openTimePicker}
                        style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                      >
                        <Sparkles size={14} color={theme.secondary} />
                        <Text style={[styles.chipText, { color: form.dueTime ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]} numberOfLines={1}>
                          {form.dueTime ? new Date(form.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.selectTime}
                        </Text>
                      </Touchable>
                    </View>
                  </View>
                )}

                {/* Inline Date Picker */}
                {showDatePicker && (
                  <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueDate}</Text>
                    <View style={styles.pickerRow}>
                      <View style={styles.pickerCol}>
                        <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.day}</Text>
                        <Touchable onPress={() => setPickerDate(d => ({ ...d, day: Math.min(d.day + 1, daysInMonth(d.year, d.month)) }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                        <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.day).padStart(2, '0')}</Text>
                        <Touchable 
                          onPress={() => setPickerDate(d => {
                            const now = new Date();
                            const minDay = (d.year === now.getFullYear() && d.month === (now.getMonth() + 1)) ? now.getDate() : 1;
                            return { ...d, day: Math.max(d.day - 1, minDay) };
                          })} 
                          style={styles.pickerArrow}
                        >
                          <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                        </Touchable>
                      </View>
                      <View style={styles.pickerCol}>
                        <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.month}</Text>
                        <Touchable onPress={() => setPickerDate(d => ({ ...d, month: d.month === 12 ? 1 : d.month + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                        <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.month).padStart(2, '0')}</Text>
                        <Touchable 
                          onPress={() => setPickerDate(d => {
                            const now = new Date();
                            const minMonth = d.year === now.getFullYear() ? (now.getMonth() + 1) : 1;
                            return { ...d, month: Math.max(d.month - 1, minMonth) };
                          })} 
                          style={styles.pickerArrow}
                        >
                          <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                        </Touchable>
                      </View>
                      <View style={styles.pickerCol}>
                        <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.year}</Text>
                        <Touchable onPress={() => setPickerDate(d => ({ ...d, year: d.year + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                        <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{pickerDate.year}</Text>
                        <Touchable 
                          onPress={() => setPickerDate(d => ({ ...d, year: Math.max(d.year - 1, new Date().getFullYear()) }))} 
                          style={styles.pickerArrow}
                        >
                          <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                        </Touchable>
                      </View>
                    </View>
                    {dateError && (
                      <View style={{ backgroundColor: theme.error + '15', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                        <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '600' }}>{t.invalidDate}</Text>
                      </View>
                    )}
                    <View style={styles.pickerActions}>
                      <Touchable onPress={() => setShowDatePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></Touchable>
                      <Touchable onPress={confirmDate} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: theme.onPrimary, fontWeight: '600' }]}>{t.save}</Text></Touchable>
                    </View>
                  </View>
                )}

                {/* Inline Time Picker */}
                {showTimePicker && (
                  <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueTime}</Text>
                    <View style={styles.pickerRow}>
                      <View style={styles.pickerCol}>
                        <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.hour}</Text>
                        <Touchable onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 23 ? 0 : pt.hour + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                        <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.hour).padStart(2, '0')}</Text>
                        <Touchable onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 0 ? 23 : pt.hour - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></Touchable>
                      </View>
                      <Text style={[styles.pickerColon, { color: theme.onSurface }]}>:</Text>
                      <View style={styles.pickerCol}>
                        <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.minute}</Text>
                        <Touchable onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 59 ? 0 : pt.minute + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                        <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.minute).padStart(2, '0')}</Text>
                        <Touchable onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 0 ? 59 : pt.minute - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></Touchable>
                      </View>
                    </View>
                    <View style={styles.pickerActions}>
                      <Touchable onPress={() => setShowTimePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></Touchable>
                      <Touchable onPress={confirmTime} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: theme.onPrimary, fontWeight: '600' }]}>{t.save}</Text></Touchable>
                    </View>
                  </View>
                )}
              </View>

              {/* Priority Selectors */}
              <View style={styles.section}>
                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.priority.toUpperCase()}</Text>
                <View style={[styles.priorityRow, { gap: S.sm }]}>
                  {([
                    { key: 'Low', label: t.filterLow },
                    { key: 'Medium', label: t.filterMedium },
                    { key: 'High', label: t.filterHigh }
                  ] as { key: Priority; label: string }[]).map((p) => (
                    <Touchable
                      key={p.key}
                      onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, priority: p.key })); }}
                      style={[styles.priorityTab, { backgroundColor: form.priority === p.key ? priorityColor(p.key) : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: 48 }]}
                    >
                      <Text style={[
                        styles.priorityTabText,
                        {
                          color: form.priority === p.key
                            ? (p.key === 'Low' ? theme.onTertiary : 'white')
                            : theme.onSurfaceVariant,
                          fontSize: F.body
                        }
                      ]}>
                        {p.label}
                      </Text>
                    </Touchable>
                  ))}
                </View>
              </View>

              {/* Recurrence Selectors */}
              <View style={styles.section}>
                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.recurrence.toUpperCase()}</Text>
                <View style={[styles.priorityRow, { gap: S.sm }]}>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <Touchable
                      key={r.key}
                      hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
                      onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, recurrence: r.key })); }}
                      style={[styles.priorityTab, { backgroundColor: form.recurrence === r.key ? theme.secondary : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: 42 }]}
                    >
                      {r.key !== 'None' && <Repeat size={12} color={form.recurrence === r.key ? 'white' : theme.onSurfaceVariant} />}
                      <Text style={[styles.priorityTabText, { color: form.recurrence === r.key ? 'white' : theme.onSurfaceVariant, fontSize: F.caption }]}>
                        {(t as any)[r.labelKey]}
                      </Text>
                    </Touchable>
                  ))}
                </View>
                {form.recurrence !== 'None' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                    <Repeat size={11} color={theme.secondary} />
                    {form.dueDate ? (
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.secondary }}>
                        {getNextOccurrenceLabel(form.dueDate, form.recurrence, language)}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant }}>
                        {language === 'tr' ? 'Tekrar için tarih seçin' : 'Set a due date to track recurrence'}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Reminder Switch */}
              <View style={styles.section}>
                <Touchable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setForm(f => {
                      const nextReminderEnabled = !f.reminderEnabled;
                      let nextDueTime = f.dueTime;
                      let nextDueDate = f.dueDate;

                      if (nextReminderEnabled) {
                        const now = new Date();
                        const defaultTime = new Date();
                        const formatLocal = (dObj: Date) => {
                          const y = dObj.getFullYear();
                          const m = String(dObj.getMonth() + 1).padStart(2, '0');
                          const d = String(dObj.getDate()).padStart(2, '0');
                          return `${y}-${m}-${d}`;
                        };

                        if (!f.dueTime) {
                          if (!f.dueDate) {
                            if (now.getHours() < 9) {
                              defaultTime.setHours(9, 0, 0, 0);
                              nextDueTime = defaultTime.toISOString();
                              nextDueDate = formatLocal(now);
                            } else {
                              const tomorrow = new Date(now);
                              tomorrow.setDate(now.getDate() + 1);
                              defaultTime.setHours(9, 0, 0, 0);
                              nextDueTime = defaultTime.toISOString();
                              nextDueDate = formatLocal(tomorrow);
                            }
                          } else {
                            const targetDate = new Date(f.dueDate);
                            targetDate.setHours(0, 0, 0, 0);
                            const todayZero = new Date();
                            todayZero.setHours(0, 0, 0, 0);
                            
                            if (targetDate > todayZero) {
                              defaultTime.setHours(9, 0, 0, 0);
                              nextDueTime = defaultTime.toISOString();
                            } else {
                              let nextHour = now.getHours() + 1;
                              if (nextHour > 23) {
                                const tomorrow = new Date(now);
                                tomorrow.setDate(now.getDate() + 1);
                                nextDueDate = formatLocal(tomorrow);
                                defaultTime.setHours(9, 0, 0, 0);
                                nextDueTime = defaultTime.toISOString();
                              } else {
                                defaultTime.setHours(nextHour, 0, 0, 0);
                                nextDueTime = defaultTime.toISOString();
                              }
                            }
                          }
                        } else if (!f.dueDate) {
                          const { hours, minutes } = parseTimeParts(f.dueTime);
                          const target = new Date(now);
                          target.setHours(hours, minutes, 0, 0);
                          if (target < now) {
                            const tomorrow = new Date(now);
                            tomorrow.setDate(now.getDate() + 1);
                            nextDueDate = formatLocal(tomorrow);
                          } else {
                            nextDueDate = formatLocal(now);
                          }
                        }
                      }

                      return {
                        ...f,
                        reminderEnabled: nextReminderEnabled,
                        dueTime: nextDueTime,
                        dueDate: nextDueDate
                      };
                    });
                  }}
                  style={[styles.inputGroup, {
                    backgroundColor: form.reminderEnabled
                      ? theme.priorityMedium + (isDark ? '1F' : '14')
                      : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow),
                    height: 52,
                  }]}
                >
                  <Bell size={18} color={form.reminderEnabled ? theme.priorityMedium : theme.onSurfaceVariant} />
                  <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: form.reminderEnabled ? theme.priorityMedium : theme.onSurfaceVariant, marginLeft: S.sm }}>
                    {t.reminderLabel}
                  </Text>
                  <View style={{
                    width: 44, height: 26, borderRadius: 13,
                    backgroundColor: form.reminderEnabled ? theme.priorityMedium : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                    justifyContent: 'center', paddingHorizontal: 2,
                  }}>
                    <RNAnimated.View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: 'white',
                        transform: [{ translateX: form.reminderEnabled ? 18 : 0 }]
                      }}
                    />
                  </View>
                </Touchable>
              </View>

              {/* Subtasks Editor */}
              <View style={styles.section}>
                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.subtasks.toUpperCase()}</Text>
                {form.subtasks.map((sub, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                    <Touchable
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: sub.done }}
                      accessibilityLabel={`${sub.text} — ${sub.done ? (language === 'tr' ? 'tamamlandı' : 'done') : (language === 'tr' ? 'tamamlanmadı' : 'not done')}`}
                      onPress={() => {
                        const subs = [...form.subtasks];
                        subs[i].done = !subs[i].done;
                        setForm(f => ({ ...f, subtasks: subs }));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: sub.done ? '#10B981' : theme.outline, alignItems: 'center', justifyContent: 'center', backgroundColor: sub.done ? '#10B9811A' : 'transparent' }}
                    >
                      {sub.done ? <Check size={14} color="#10B981" /> : null}
                    </Touchable>
                    <Text style={{ flex: 1, fontSize: F.body, color: sub.done ? theme.onSurfaceVariant : theme.onSurface, textDecorationLine: sub.done ? 'line-through' : 'none', opacity: sub.done ? 0.6 : 1 }}>
                      {sub.text}
                    </Text>
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={language === 'tr' ? 'Alt görevi sil' : 'Delete subtask'}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, idx) => idx !== i) }));
                      }}
                      style={{ padding: S.xs }}
                    >
                      <Trash2 size={16} color={theme.priorityHigh} />
                    </Touchable>
                  </View>
                ))}
                
                {/* Add Subtask Input */}
                <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                  <View style={[styles.inputGroup, { flex: 1, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 44 }]}>
                    <TextInput
                      style={{ flex: 1, fontSize: F.caption, color: theme.onSurface, fontWeight: '600' }}
                      placeholder={language === 'tr' ? 'Alt görev ekle...' : 'Add subtask...'}
                      placeholderTextColor={theme.onSurfaceVariant + '80'}
                      value={newSubtaskText}
                      onChangeText={setNewSubtaskText}
                      onSubmitEditing={() => {
                        if (!newSubtaskText.trim()) return;
                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                        setNewSubtaskText('');
                      }}
                    />
                  </View>
                  <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'tr' ? 'Alt görev ekle' : 'Add subtask'}
                    onPress={() => {
                      if (!newSubtaskText.trim()) return;
                      setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                      setNewSubtaskText('');
                    }}
                    style={{ width: 44, height: 44, borderRadius: R.md, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={20} color={theme.onPrimary} />
                  </Touchable>
                </View>
              </View>

              {/* Tag Editor (Visual selector chips) */}
              <View style={styles.section}>
                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{(t as any).tags?.toUpperCase() || (language === 'tr' ? 'ETİKETLER' : 'TAGS')}</Text>
                <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap', marginBottom: S.sm }}>
                  {visibleTextTags(form.tags).map(tag => (
                    <View key={tag} style={{ backgroundColor: theme.primary + '1F', borderRadius: 8, paddingLeft: S.sm, paddingRight: 4, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>
                        {translateTag(tag, language as 'tr' | 'en')}
                      </Text>
                      <Touchable accessibilityRole="button" accessibilityLabel={language === 'tr' ? `${tag} etiketini kaldır` : `Remove tag ${tag}`} onPress={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))} style={{ padding: 2 }}>
                        <X size={12} color={theme.primary} />
                      </Touchable>
                    </View>
                  ))}
                </View>
                
                {/* Pre-defined/Custom Tags selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs }}>
                  {['Work', 'Study', 'Personal', 'Shopping', 'Health'].map(tagOption => {
                    const hasTag = form.tags.includes(tagOption);
                    return (
                      <Touchable
                        key={tagOption}
                        onPress={() => {
                          Haptics.selectionAsync();
                          if (hasTag) setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tagOption) }));
                          else setForm(f => ({ ...f, tags: [...f.tags, tagOption] }));
                        }}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.md, backgroundColor: hasTag ? theme.primary : (isDark ? '#2C2C2E' : '#E5E5EA'), borderWidth: 0.5, borderColor: theme.outlineVariant + '40' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: hasTag ? theme.onPrimary : theme.onSurfaceVariant }}>
                          {translateTag(tagOption, language as 'tr' | 'en')}
                        </Text>
                      </Touchable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Form Submission Actions */}
              <Touchable onPress={handleSave} style={styles.modalSaveBtn} disabled={saving}>
                <View style={[styles.modalSaveGradient, { backgroundColor: theme.primary }]}>
                  {saving ? (
                    <ActivityIndicator color="black" />
                  ) : (
                    <>
                      <Text style={[styles.modalSaveText, { color: theme.onPrimary }]}>{t.save}</Text>
                    </>
                  )}
                </View>
              </Touchable>

              {/* Task Delete Trigger */}
              {task && onDelete && (
                <Touchable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setSaving(true);
                    try {
                      await onDelete(task.id);
                      onClose();
                    } catch (e) { swallow('TaskFormModal.toggleTag', e); }
                    finally { setSaving(false); }
                  }}
                  style={{ alignSelf: 'center', marginTop: S.sm, padding: S.sm }}
                  disabled={saving}
                >
                  <Text style={{ color: theme.priorityHigh, fontWeight: '700', fontSize: F.body }}>
                    {t.deleteTask || (language === 'tr' ? 'Görevi Sil' : 'Delete Task')}
                  </Text>
                </Touchable>
              )}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </View>
    </Modal>
  );
};

function parseTimeParts(isoString: string) {
  const date = new Date(isoString);
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: S.xl,
    borderTopRightRadius: S.xl,
    borderWidth: B.thin,
    borderBottomWidth: 0,
  },
  dragHandleContainer: {
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
  },
  handle: {
    width: scale(40),
    height: scale(4),
    borderRadius: R.sm,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  closeModalBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 4,
  },
  section: {
    marginBottom: S.md,
  },
  inputGroup: {
    borderRadius: R.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
  },
  modalInput: {
    flex: 1,
    fontWeight: '600',
    height: '100%',
    textAlignVertical: 'center',
  },
  modalTextArea: {
    alignItems: 'flex-start',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: S.sm,
  },
  dateTimeChip: {
    flex: 1,
    borderRadius: R.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    gap: scale(10),
  },
  chipText: {
    flex: 1,
    fontWeight: '600',
  },
  optionLabel: {
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: S.sm,
    marginLeft: S.xs,
    opacity: 0.6,
  },
  priorityRow: {
    flexDirection: 'row',
  },
  priorityTab: {
    flex: 1,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityTabText: {
    fontWeight: '600',
  },
  modalSaveBtn: {
    borderRadius: R.lg,
    overflow: 'hidden',
    marginTop: S.lg,
    marginBottom: S.xl,
  },
  modalSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    height: verticalScale(56),
  },
  modalSaveText: {
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingTop: Platform.OS === 'ios' ? 2 : 0,
  },
  inlinePicker: {
    borderRadius: R.lg,
    padding: S.md,
    alignItems: 'center',
    borderWidth: B.thin,
  },
  inlinePickerTitle: {
    fontSize: F.body,
    fontWeight: '600',
    marginBottom: S.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    marginBottom: S.md,
  },
  pickerCol: {
    alignItems: 'center',
    minWidth: scale(60),
  },
  pickerColLabel: {
    fontSize: F.caption,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: S.sm,
    opacity: 0.5,
  },
  pickerArrow: {
    padding: S.sm,
  },
  pickerArrowText: {
    fontSize: F.body,
    fontWeight: '600',
  },
  pickerValue: {
    fontSize: moderateScale(32),
    fontWeight: '600',
    letterSpacing: -1,
    lineHeight: verticalScale(40),
  },
  pickerColon: {
    fontSize: moderateScale(28),
    fontWeight: '600',
    marginTop: S.sm,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: S.sm,
    width: '100%',
    marginTop: S.sm,
  },
  pickerCancelBtn: {
    flex: 1,
    borderRadius: R.md,
    borderWidth: B.medium,
    height: verticalScale(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerConfirmBtn: {
    flex: 1,
    borderRadius: R.md,
    height: verticalScale(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnText: {
    fontWeight: '600',
    paddingTop: Platform.OS === 'ios' ? 2 : 0,
  },
});
