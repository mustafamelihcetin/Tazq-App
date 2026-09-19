import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TextInput, ScrollView } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { useActiveTasks, getLocalizedTaskTitle, isSomeday, type Task } from '@/features/tasks';
import { calendarDayOf, dateKeyFromNow } from '@/shared/utils/dateKey';
import { whenLabel } from '@/features/tasks/utils/horizon';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * SEANSIN KONUSU — isteğe bağlı bir etiket, bir TALİMAT değil.
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * Seansı bir göreve bağlamanın TEK yolu ana sayfadan ya da "Bugün" ekranından
 * gelmekti. Doğrudan odak ekranına giren kullanıcı adsız bir sayaç başlatıyordu:
 * ekran neye odaklanıldığını yazmıyor, dakikalar hiçbir göreve işlenmiyor ve seans
 * bitince sorulacak bir şey kalmıyordu.
 *
 * ── BU EKRAN YALNIZ "ÇALIŞMA" DEĞİL ────────────────────────────────────────
 * Nefes rehberi, ortam sesleri, zen modu ve aurora bu ekranı bir dinlenme/meditasyon
 * yüzeyi de yapıyor. Bu yüzden başlık "ne üzerinde çalışacaksın" demiyor: hazır
 * konular (dinlenme, nefes, meditasyon, okuma) görev listesiyle EŞİT konumda duruyor.
 * Etiketler emir kipinde DEĞİL — seçim isteğe bağlı, boş bırakılan seans da geçerli.
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    title: 'Konu',
    sub: 'İsteğe bağlı — görev, kendi konun ya da boş.',
    intents: [
      { emoji: '🎯', label: 'Çalışma' },
      { emoji: '📖', label: 'Okuma' },
      { emoji: '🌬️', label: 'Nefes' },
      { emoji: '🧘', label: 'Meditasyon' },
      { emoji: '🌙', label: 'Dinlenme' },
    ],
    tasksLabel: 'Bugünkü işlerin',
    placeholder: 'Kendi konunu yaz…',
    useText: 'Bunu kullan',
    none: 'Sessizce başla',
    today: 'Bugün',
    overdue: 'Gecikmiş',
    undated: 'Tarihsiz',
    empty: 'Bugün için açık işin yok.',
    close: 'Kapat',
  },
  en: {
    title: 'Topic',
    sub: 'Optional — a task, your own topic, or nothing.',
    intents: [
      { emoji: '🎯', label: 'Deep work' },
      { emoji: '📖', label: 'Reading' },
      { emoji: '🌬️', label: 'Breathing' },
      { emoji: '🧘', label: 'Meditation' },
      { emoji: '🌙', label: 'Unwind' },
    ],
    tasksLabel: 'Today’s work',
    placeholder: 'Write your own topic…',
    useText: 'Use this',
    none: 'Just begin',
    today: 'Today',
    overdue: 'Overdue',
    undated: 'No date',
    empty: 'Nothing open for today.',
    close: 'Close',
  },
};

/*
  ZEMİN UYGULAMA TEMASINI İZLER, YAZI DA ONU İZLEMELİ.

  Odak ekranı her iki temada da KOYU (kendi meditatif kimliği). Ama alt sayfaların
  zemini `GlassSurface` ve o, uygulamanın temasından geliyor: açık temada zemin AÇIK
  oluyordu, yazılar ise odak ekranının koyu paletinden (yani açık renkti) → açık
  üstüne açık, okunmuyordu. Renkler bu yüzden buradan, kendi zemininden alınır.
*/
export interface FocusTaskPickerProps {
  visible: boolean;
  language: Lang;
  onClose: () => void;
  /** taskId null → serbest başlık ya da bağsız seans. */
  onPick: (title: string, taskId: number | null) => void;
}

/** Bugün ve öncesi önce, sonra tarihsizler, en sonra ileri tarihliler. */
/** "14:30" — saat alanı hem ISO hem "HH:MM" gelebiliyor. */
function clockOf(dueTime: string | null | undefined): string | null {
  if (!dueTime) return null;
  if (dueTime.includes('T')) {
    const d = new Date(dueTime);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const [h, m] = dueTime.split(':');
  if (h == null || m == null) return null;
  return `${h.padStart(2, '0')}:${m.slice(0, 2).padStart(2, '0')}`;
}

/** Hatırlatma/etkinlik/not kayıtları — "yapılacak iş" değil, "unutma" notu. */
const REMINDER_TAGS = new Set(['hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note']);

/**
 * ŞİMDİ ÜZERİNDE ÇALIŞILABİLECEK işler — bugün, gecikmiş ve tarihsiz olanlar.
 *
 * ── NEDEN İLERİ TARİHLİLER YOK ─────────────────────────────────────────────
 * Liste başta TÜM açık görevleri gösteriyordu. "Ayın 27'sinde banka ödemesi" bir odak
 * KONUSU değil: o gün gelince bir dakikada yapılacak bir iş ve bugün 25 dakika
 * odaklanmanın karşılığı yok. Bugün yapılabilecek olan listelenir; o görev de vadesi
 * geldiğinde kendiliğinden listeye girer.
 *
 * Aynı gerekçeyle hatırlatıcı/etkinlik/not kayıtları dışarıda: onlar bir ZAMANI
 * işaretliyor, bir çalışmayı değil.
 */
export function orderForFocus(tasks: Task[], today: string): Task[] {
  const workable = tasks.filter((t) => {
    if (!t || t.isCompleted || isSomeday(t)) return false;
    if ((t.tags ?? []).some((tag) => REMINDER_TAGS.has(tag))) return false;
    const day = calendarDayOf(t.dueDate);
    return !day || day <= today; // ileri tarihli iş bugünün konusu değil
  });
  return workable
    .map((t, i) => ({ t, i, day: calendarDayOf(t.dueDate) }))
    // Önce tarihli olanlar (eskiden yeniye), tarihsizler en sonda
    .sort((a, b) => (!!a.day !== !!b.day ? (a.day ? -1 : 1) : (a.day ?? '') !== (b.day ?? '') ? (a.day ?? '').localeCompare(b.day ?? '') : a.i - b.i))
    .slice(0, 40)
    .map((x) => x.t);
}

export const FocusTaskPicker: React.FC<FocusTaskPickerProps> = ({ visible, language, onClose, onPick }) => {
  const { theme } = useAppTheme();
  const [text, setText] = useState('');
  const tasks = useActiveTasks();
  const c = COPY[language];
  const today = dateKeyFromNow(0);
  const list = useMemo(() => orderForFocus(tasks, today), [tasks, today]);

  /*
    Sağdaki etiket İNSAN DİLİNDE: ileri tarihler "09.25" gibi yazılıyordu ve neyi
    anlattığı belli değildi. Saat varsa eklenir — "Bugün · 14:30".
  */
  const label = (t: Task) => {
    const day = calendarDayOf(t.dueDate);
    if (!day) return c.undated;
    const time = clockOf(t.dueTime);
    if (day < today) return time ? `${c.overdue} · ${time}` : c.overdue;
    const base = day === today ? c.today : (whenLabel(t.dueDate, language) ?? c.today);
    return time ? `${base} · ${time}` : base;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Touchable accessibilityRole="button" accessibilityLabel={c.close} style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ maxHeight: '76%', borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl, overflow: 'hidden' }}>
          <GlassSurface corners="top" />
          <View style={{ alignItems: 'center', marginBottom: S.md }}>
            <View style={{ width: 36, height: 4, borderRadius: R.xs, backgroundColor: theme.onSurface + '1F' }} />
          </View>

          <Text style={{ fontSize: F.title3, fontWeight: '700', color: theme.onSurface, textAlign: 'center' }}>{c.title}</Text>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'center', marginTop: S.xxs, marginBottom: S.md }}>{c.sub}</Text>

          {/* Serbest başlık: her odak konusu bir görev değildir. */}
          <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', marginBottom: S.md }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={c.placeholder}
              placeholderTextColor={theme.onSurfaceMuted}
              returnKeyType="done"
              onSubmitEditing={() => { if (text.trim()) onPick(text.trim(), null); }}
              style={{ flex: 1, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.onSurface + '26', color: theme.onSurface, fontSize: F.body }}
            />
            {text.trim().length > 0 && (
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={c.useText}
                onPress={() => onPick(text.trim(), null)}
                style={{ paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }}
              >
                <Check size={ICON.sm} color={theme.onPrimary} strokeWidth={2.4} />
              </Touchable>
            )}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.xs, paddingBottom: S.md }}>
            {/* Hazır niyetler — her seans bir "iş" değildir. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm }}>
              {c.intents.map((intent) => (
                <Touchable
                  key={intent.label}
                  accessibilityRole="button"
                  accessibilityLabel={intent.label}
                  onPress={() => onPick(intent.label, null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.onSurface + '1F' }}
                >
                  <Text style={{ fontSize: F.caption }}>{intent.emoji}</Text>
                  <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurfaceVariant }}>{intent.label}</Text>
                </Touchable>
              ))}
            </View>

            {list.length > 0 && (
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.4, marginBottom: S.xxs }}>
                {c.tasksLabel}
              </Text>
            )}
            {list.length === 0 ? (
              <Text style={{ fontSize: F.body, color: theme.onSurfaceMuted, textAlign: 'center', paddingVertical: S.lg }}>{c.empty}</Text>
            ) : (
              list.map((task) => (
                <Touchable
                  key={task.id}
                  accessibilityRole="button"
                  accessibilityLabel={getLocalizedTaskTitle(task, language === 'tr')}
                  onPress={() => onPick(getLocalizedTaskTitle(task, language === 'tr'), task.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.smd, paddingHorizontal: S.md, borderRadius: R.lg, backgroundColor: theme.onSurface + '0D' }}
                >
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: theme.onSurface }}>
                    {getLocalizedTaskTitle(task, language === 'tr')}
                  </Text>
                  <Text style={{ fontSize: F.caption, fontWeight: '700', color: label(task).startsWith(c.overdue) ? theme.error : theme.onSurfaceMuted }}>
                    {label(task)}
                  </Text>
                </Touchable>
              ))
            )}
          </ScrollView>

          <Touchable
            accessibilityRole="button"
            accessibilityLabel={c.none}
            onPress={() => onPick('', null)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.smd, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.onSurface + '26' }}
          >
            <X size={ICON.xs} color={theme.onSurfaceVariant} />
            <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurfaceVariant }}>{c.none}</Text>
          </Touchable>
        </View>
      </View>
    </Modal>
  );
};
