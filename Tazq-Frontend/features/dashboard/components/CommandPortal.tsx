import React, { useRef } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { ChevronRight, Play, Plus, Rocket, Sparkles, Target, X } from 'lucide-react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { Touchable } from '@/shared/components/Touchable';
import { AppIcon } from '@/shared/components/AppIcon';
import { F, S, R, ICON, HAIRLINE } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { getLocalizedTaskTitle, type Task } from '@/features/tasks';

/**
 * KOMUT PALETİ — görev arama + akıllı hızlı ekleme.
 *
 * app/index.tsx'ten çıkarıldı (bkz. fileSize → "sıradaki küçültme adresi"): ~250
 * satırlık kendi içine kapalı bir yüzey ana ekranın gövdesinde duruyordu. Davranış
 * AYNEN taşındı; kayıt yolu (`onSubmit`) ve açılma kararı hâlâ ana ekranda — palet
 * yalnız çiziyor ve kullanıcının niyetini yukarı iletiyor.
 */

export interface CommandPortalProps {
  visible: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  /** Yazılanı görev olarak kaydeder — ana ekranın TEK kayıt yolu (savePortalTask). */
  onSubmit: () => void;
  onQuickFocus: () => void;
  tasks: Task[];
  priorityColor: (p: string) => string;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
}

const copy = (tr: boolean) => tr
  ? {
      locale: 'tr-TR',
      placeholder: 'Görev ara veya hızlı görev yaz...',
      clear: 'TEMİZLE',
      close: 'Kapat',
      shortcuts: 'HIZLI KISAYOLLAR',
      focus: 'Hızlı Odak Seansı Başlat',
      focusDesc: '25 dakikalık odaklanma başlat',
      allTasks: 'Tüm Görevleri Listele',
      allTasksDesc: 'Görevler sayfasına yönlendir',
      modes: 'Aktif Modları Yönet',
      modesDesc: 'Alışkanlık planlarını keşfet',
      add: (q: string) => `"${q}" görevini ekle`,
      addDesc: 'Otomatik zaman ve öncelik tespiti ile ekler',
      tasks: 'GÖREVLER',
    }
  : {
      locale: 'en-US',
      placeholder: 'Search tasks or write a quick task...',
      clear: 'CLEAR',
      close: 'Close',
      shortcuts: 'QUICK SHORTCUTS',
      focus: 'Start Quick Focus Session',
      focusDesc: 'Launch a 25 min focus timer',
      allTasks: 'Show All Tasks List',
      allTasksDesc: 'Go to tasks management screen',
      modes: 'Manage Active Modes',
      modesDesc: 'Explore habits and life modes',
      add: (q: string) => `Add task "${q}"`,
      addDesc: 'Adds with automatic time & priority parsing',
      tasks: 'TASKS',
    };

export function CommandPortal({
  visible, onClose, query, onQueryChange, onSubmit, onQuickFocus, tasks, priorityColor, theme, isDark, tr,
}: CommandPortalProps) {
  const c = copy(tr);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const rowBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';

  const shortcuts = [
    {
      icon: <Play size={ICON.sm} color={theme.tertiary} fill={theme.tertiary} />,
      label: c.focus,
      desc: c.focusDesc,
      onPress: () => { onClose(); onQuickFocus(); },
    },
    {
      icon: <Target size={ICON.sm} color={theme.primary} />,
      label: c.allTasks,
      desc: c.allTasksDesc,
      onPress: () => { onClose(); router.push('/tasks'); },
    },
    {
      icon: <Rocket size={ICON.sm} color={theme.primary} />,
      label: c.modes,
      desc: c.modesDesc,
      onPress: () => { onClose(); router.push('/modlar'); },
    },
  ];

  /*
    İki kusur: `toLowerCase()` Türkçe'de yanlış çalışıyor ('İ' → 'i̇') ve arama HAM
    `title` üzerinde yapılıyordu. Kullanıcı ekranda yerelleştirilmiş adı görüyor
    (bkz. getLocalizedTaskTitle), yani gördüğü kelimeyi arattığında bulamıyordu.
  */
  const needle = query.toLocaleLowerCase(c.locale);
  const matchedTasks = query.trim() === ''
    ? []
    : tasks.filter(t => getLocalizedTaskTitle(t, tr).toLocaleLowerCase(c.locale).includes(needle));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 80);
      }}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <AppBlur material="regular" />

        <TouchableWithoutFeedback accessible={false} onPress={() => { Keyboard.dismiss(); onClose(); }}>
          <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" />
        </TouchableWithoutFeedback>

        <SafeAreaView style={{ flex: 1, paddingHorizontal: S.lmd }} pointerEvents="box-none">
          <MotiView
            from={{ translateY: -30, opacity: 0, scale: 0.96 }}
            animate={{ translateY: 0, opacity: 1, scale: 1 }}
            exit={{ translateY: -30, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 180 }}
            style={{
              marginTop: S.xxl,
              borderRadius: R.sheet,
              borderWidth: 1.2,
              borderColor: theme.primary + '25',
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowRadius: 28,
              elevation: 12,
              overflow: 'hidden',
              maxHeight: '65%',
            }}
          >
            <GlassSurface radius={R.sheet} />
            {/* Search Input Area */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: S.md,
              paddingVertical: S.md,
              borderBottomWidth: HAIRLINE,
              borderBottomColor: theme.separator,
              gap: S.smd,
            }}>
              <Sparkles size={ICON.md} color={theme.primary} />
              <TextInput
                ref={inputRef}
                style={{
                  flex: 1,
                  fontSize: F.body,
                  fontWeight: '600',
                  color: theme.onSurface,
                  padding: 0,
                  margin: 0,
                }}
                placeholder={c.placeholder}
                placeholderTextColor={theme.onSurfaceVariant + '80'}
                value={query}
                onChangeText={onQueryChange}
                onSubmitEditing={() => onSubmit()}
                returnKeyType="done"
              />
              {query.length > 0 && (
                <Touchable onPress={() => onQueryChange('')} accessibilityRole="button" style={{ marginRight: S.xs }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>{c.clear}</Text>
                </Touchable>
              )}
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={c.close}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={ICON.md} color={theme.onSurfaceVariant} opacity={0.6} />
              </Touchable>
            </View>

            {/* Results / Navigation shortcuts */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: S.smd, gap: S.xs }}
            >
              {query.trim() === '' ? (
                <View style={{ gap: S.xs }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.onSurfaceMuted, paddingLeft: S.sm, paddingBottom: S.sm }}>
                    {c.shortcuts}
                  </Text>
                  {shortcuts.map((shortcut, idx) => (
                    <Touchable
                      key={idx}
                      onPress={shortcut.onPress}
                      accessibilityRole="button"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: S.smd,
                        paddingVertical: S.smd,
                        borderRadius: R.md,
                        backgroundColor: rowBg,
                        gap: S.smd,
                      }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                        {shortcut.icon}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: F.caption2, fontWeight: '700', color: theme.onSurface }}>{shortcut.label}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.onSurfaceMuted }}>{shortcut.desc}</Text>
                      </View>
                      <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.3} />
                    </Touchable>
                  ))}
                </View>
              ) : (
                <View style={{ gap: S.xs }}>
                  {/* Quick Add Row */}
                  <Touchable
                    onPress={() => onSubmit()}
                    accessibilityRole="button"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: S.smd,
                      paddingVertical: S.smd,
                      borderRadius: R.md,
                      backgroundColor: theme.primary + '12',
                      borderWidth: 1,
                      borderColor: theme.primary + '30',
                      gap: S.smd,
                      marginBottom: S.sm,
                    }}
                  >
                    <AppIcon Icon={Plus} color={theme.primary} size={28} radius={R.sm} iconSize={ICON.sm} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: F.caption2, fontWeight: '700', color: theme.primary }} numberOfLines={1}>
                        {c.add(query)}
                      </Text>
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceMuted }}>
                        {c.addDesc}
                      </Text>
                    </View>
                  </Touchable>

                  {/* Matching Tasks */}
                  {matchedTasks.length > 0 && (
                    <View style={{ gap: S.xs }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.onSurfaceMuted, paddingLeft: S.sm, paddingBottom: S.xs }}>
                        {c.tasks}
                      </Text>
                      {matchedTasks.slice(0, 5).map(task => (
                        <Touchable
                          key={task.id}
                          onPress={() => {
                            onClose();
                            router.push({ pathname: '/tasks', params: { highlightId: task.id } });
                          }}
                          accessibilityRole="button"
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: S.smd,
                            paddingVertical: S.smd,
                            borderRadius: R.md,
                            backgroundColor: rowBg,
                            gap: S.smd,
                          }}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: priorityColor(task.priority) }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{
                              fontSize: F.caption2,
                              fontWeight: '600',
                              color: task.isCompleted ? theme.onSurfaceVariant : theme.onSurface,
                              textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                              opacity: task.isCompleted ? 0.5 : 1,
                            }} numberOfLines={1}>
                              {getLocalizedTaskTitle(task, tr)}
                            </Text>
                          </View>
                          <ChevronRight size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.3} />
                        </Touchable>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </MotiView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
