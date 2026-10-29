/*
 * KATMAN DÜZELTMESİ: bu dosya `shared/components` altındaydı.
 *
 * Bir GÖREV formu — genel bir bileşen değil. `features/tasks` yardımcılarına
 * (etiket ayrıştırma, ipucu çıkarma) doğrudan dayanıyor.
 *
 * `shared` en alt katman: yukarıdaki hiçbir şeyi bilmemeli. Buradaki her `features`
 * içe aktarımı, alt katmanın üst katmandan bilgi çekmesi demekti — modülerliği
 * bozar ve dosyayı tek başına test edilemez kılar. Taşınmasıyla yön düzeldi.
 *
 * ── YENİDEN TASARIM (2026-10-25) ────────────────────────────────────────────────
 * Ölçülen sorunlar ve karşılıkları:
 *  · Başlığın altında DOKUNULAMAYAN üç "özellik" yongası (Tarih/Öncelik/Hatırlatıcı)
 *    düğme gibi görünüp hiçbir şey yapmıyordu → kaldırıldı.
 *  · Kaydet formun EN DİBİNDEYDİ (kaydırmadan görünmüyordu) → başlık çubuğunun sağında,
 *    klavye açıkken de erişilebilir (iOS sayfa düzeni: kapat · başlık · ekle; M3 tam
 *    ekran iletişim kutusu da aynı: X · başlık · Kaydet). Başlık boşken pasif.
 *  · Tarih ham "2026-10-25", seçimi ▲/▼ → kısayol yongaları + platformun kendi
 *    seçicisi (bkz. ScheduleSection).
 *  · Öncelik/tekrar dolu doygun renkle boyanıyordu → nötr bölümlü seçici, anlam rengi
 *    yalnız noktada (bkz. SegmentedControl).
 *  · Silme ONAYSIZDI; kaydedilmemiş değişiklik kaydırınca/X'le SESSİZCE gidiyordu →
 *    ikisi de onay soruyor (HIG: yıkıcı eylem ve veri kaybı onaylanır).
 *  · Tablette sayfa 1024 pt'ye yayılıyordu → ortada, en çok 600 pt bir form sayfası.
 *  · iOS'ta klavye sayfanın altını örtüyordu → sayfa klavyenin üstüne çıkar (QuickAddSheet ile aynı).
 *  · Koyu temada kayıt göstergesi siyahtı, hatırlatıcı anahtarı rolsüz bir resimdi.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Platform, ActivityIndicator, ScrollView, Animated as RNAnimated, Keyboard, Pressable, useWindowDimensions } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { X, Sparkles, Mic, Repeat, Trash2, Plus, Check, Lock } from 'lucide-react-native';
import { isModeContentTask, protectModeContent } from '@/features/tasks/utils/modeTaskEdit';
import { getLocalizedTaskTitle, getLocalizedTaskDescription } from '@/features/tasks/store/useTaskStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import VoiceService from '@/shared/utils/voice';
import { parseTaskHint, visibleTextTags, translateTag } from '@/features/tasks';
import { ICON, S, R, F, B, HAIRLINE, MIN_TOUCH, TABLET_MIN, scale } from '@/shared/constants/tokens';
import { buildNlpChips } from '@/features/tasks/utils/nlpChips';
import { EMPTY_DRAFT, applyHint, markManual, rejectTag, visibleHint, type DraftControl, type OwnedField } from '@/features/tasks/nlp/draft';
import { CATEGORY_TAGS, type CategoryId } from '@/features/tasks/nlp/lexicon';
import { understand, titleOf } from '@/features/tasks/nlp/understand';
import { langOf, localeOf } from '@/shared/utils/lang';
import { NlpHintRow, hasNlpHint, EMPTY_NLP_HINT, type NlpHint } from '@/features/tasks/components/NlpHintRow';
/*
  SİSTEM UYARISI, CustomAlert DEĞİL — CustomAlert bir RN `Modal`; iOS, açık bir Modal'ın
  (bu form sayfası) üstüne ikinci bir Modal'ı sessizce SUNMUYOR. "Değişiklikler atılsın
  mı?" görünmüyor, form kapanmıyordu (cihazda görüldü, 2026-10-25). Sistem uyarısı en
  üstteki denetleyicinin üzerinde açılır (bkz. TurkishModeBanner, aynı gerekçe).
*/
import { Priority, RecurrenceType, SubtaskItem } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';
import { parseDateKey, calendarDayOf, toDateKey } from '@/shared/utils/dateKey';
import { upperFor } from '@/shared/utils/localeCase';
import { defaultReminderSlot, isFormDirty } from '@/features/tasks/utils/taskFormDates';
import { taskFormCopy, type TaskFormCopy } from '@/features/tasks/components/form/taskFormCopy';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { ScheduleSection } from '@/features/tasks/components/form/ScheduleSection';
import { workHourOf } from '@/shared/utils/productivityHour';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

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
  reminderEnabled: false,
};

const RECURRENCE_OPTIONS: { key: RecurrenceType; labelKey: string }[] = [
  { key: 'None', labelKey: 'recurrenceNone' },
  { key: 'Daily', labelKey: 'recurrenceDaily' },
  { key: 'Weekly', labelKey: 'recurrenceWeekly' },
  { key: 'Monthly', labelKey: 'recurrenceMonthly' },
];

const CATEGORY_IDS: CategoryId[] = ['work', 'education', 'personal', 'shopping', 'health', 'fitness', 'finance', 'home', 'social'];

/** Tablette form sayfası ortada ve bu genişliği aşmaz (iPad form sheet ≈ 540–620 pt). */
const SHEET_MAX_W = 600;

function getNextOccurrenceLabel(dueDateStr: string | null | undefined, recurrence: RecurrenceType, lang: string, c: TaskFormCopy): string {
  if (!dueDateStr) return '';
  // YEREL GÜN — dueDateStr 'YYYY-MM-DD'; ham new Date() UTC gece yarısı okur ve
  // negatif UTC-fark saat dilimlerinde "Sonraki: …" bir gün erken gösterilirdi.
  const dateObj = parseDateKey(dueDateStr);
  if (isNaN(dateObj.getTime())) return '';
  const nextDate = new Date(dateObj);

  if (recurrence === 'Daily') {
    nextDate.setDate(dateObj.getDate() + 1);
  } else if (recurrence === 'Weekly') {
    nextDate.setDate(dateObj.getDate() + 7);
  } else if (recurrence === 'Monthly') {
    /*
      AY-SONU KENETLEME: setMonth kenetlemez — 31 Ocak + 1 ay 3 Mart'a taşardı
      (Şubat 28/29 gün). Hedef ay son güne göre kırpılır.
    */
    const targetMonth = dateObj.getMonth() + 1;
    const clamped = new Date(dateObj.getFullYear(), targetMonth + 1, 0).getDate();
    nextDate.setDate(1);
    nextDate.setMonth(targetMonth);
    nextDate.setDate(Math.min(dateObj.getDate(), clamped));
  }

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return c.next(nextDate.toLocaleDateString(localeOf(lang), options));
}

const VoiceWave = ({ active, theme }: { active: boolean; theme: AppTheme }) => (
  <View style={styles.voiceWave}>
    <RNAnimated.View
      style={[styles.voiceHalo, { backgroundColor: theme.primary, opacity: active ? 0.35 : 0, transform: [{ scale: active ? 1.4 : 1 }] }]}
    />
    <Mic size={ICON.md} color={active ? theme.primary : theme.onSurfaceVariant} />
  </View>
);

interface TaskFormModalProps {
  visible: boolean;
  onClose: () => void;
  task: any; // Task payload to edit, or null for creation
  /**
   * YENİ görevde başlığın ÖN DOLU gelmesi — hızlı ekleme sayfasındaki "Detaylar".
   *
   * Kullanıcı hızlı eklemeye bir cümle yazıp detaya geçtiğinde yazdığı kaybolursa
   * ikinci adım bir CEZA olur ve bir daha kimse detaya geçmez. Metin taşınıyor;
   * ayrıştırıcı da açılışta aynı cümleyi okuyup alanları dolduruyor.
   */
  initialTitle?: string;
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
  initialTitle,
  onSave,
  onDelete,
  theme,
  isDark,
  language,
  t,
}) => {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = winW >= TABLET_MIN;
  const c = taskFormCopy(language);
  // Mod görevi: başlık ve iki dilli yük kilitli (bkz. modeTaskEdit — ham JSON 'Notlar'a düşüyordu).
  const locked = isModeContentTask(task);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [nlpHint, setNlpHint] = useState<NlpHint>(EMPTY_NLP_HINT);

  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningDesc, setIsListeningDesc] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  /*
    ODAKLANILAN ALAN — hangi kutunun klavyeyi dinlediği, markanın mavisiyle hafif bir
    YIKAMA olarak görünür (kenar çizgisi kaba duruyordu, düzeni de oynatıyordu).
    Dokunmatik olmayan girişte (donanım klavyesi, iPad) odağın yeri — erişilebilirlik gereği.
  */
  const [focusedField, setFocusedField] = useState<'title' | 'desc' | 'subtask' | null>(null);
  const fieldFill = (f: 'title' | 'desc' | 'subtask') =>
    focusedField === f ? theme.primary + '1A' : theme.surfaceField;
  // Ortak hook (bkz. useKeyboardHeight). Android `resize` modunda pencere zaten küçülür.
  const keyboardHeight = useKeyboardHeight();
  // İki platformda da: edge-to-edge'de Android penceresi küçülmüyor (bkz. useKeyboardHeight).
  const iosKeyboard = keyboardHeight;

  /*
    KAPATMA TEK KAPIDAN — X, arka plan, geri tuşu ve aşağı kaydırma aynı yolu izler.
    Kaydırma kancası PanResponder'ı BİR KEZ kurar; kapanıştaki `form` bayat kalırdı.
    Bu yüzden kapı bir ref üzerinden çağrılıyor ve her çizimde güncelleniyor.
  */
  const initialRef = useRef<TaskForm>(EMPTY_FORM);
  const requestCloseRef = useRef<() => void>(() => {});

  const { panResponder, animatedStyle: taskSlide, prepare: prepareTask, slideIn: taskSlideIn } = useSwipeToDismiss({
    onDismiss: () => requestCloseRef.current(),
  });

  const requestClose = () => {
    if (saving) return;
    if (!isFormDirty(form, initialRef.current)) { onClose(); return; }
    Keyboard.dismiss();
    Alert.alert(c.discardTitle, c.discardBody, [
      // Kaydırarak kapatıldıysa sayfa ekranın dışında: geri getir.
      { text: c.keepEditing, style: 'cancel', onPress: taskSlideIn },
      { text: c.discard, style: 'destructive', onPress: onClose },
    ]);
  };
  requestCloseRef.current = requestClose;

  // Stop voice recognition when modal is hidden
  useEffect(() => {
    if (!visible && (isListeningTitle || isListeningDesc)) {
      VoiceService.stop().catch(() => {});
      setIsListeningTitle(false);
      setIsListeningDesc(false);
    }
  }, [visible, isListeningTitle, isListeningDesc]);

  // Motorun bu taslakta neye dokunabileceği: elle seçilen alanlar ve reddedilen etiketler.
  const draftRef = useRef<DraftControl>(EMPTY_DRAFT);
  /*
    KUTUNUN HER YERİ ODAKLAMALI, YALNIZ METNİN ÜSTÜ DEĞİL — dış `View` bir `Pressable`;
    dokununca ref'ten `focus()` çağrılır (bkz. ModeField.tsx'teki AYNI düzeltme).
  */
  const titleInputRef = useRef<TextInput>(null);
  const descInputRef = useRef<TextInput>(null);
  const subtaskInputRef = useRef<TextInput>(null);
  const touch = (...fields: OwnedField[]) => { draftRef.current = markManual(draftRef.current, ...fields); };

  /*
    FORM YALNIZ AÇILIŞTA (ya da BAŞKA bir görev açılınca) DOLAR — nesne kimliğine değil
    görevin KİMLİĞİNE bakılır (2026-10-25, cihazda görüldü; bkz. taskFormReset.test.tsx).
    Görevler ekranı düzenlenen görevi her çizimde listeden yeniden buluyor; arka plan
    eşitlemesi aynı görevin yeni bir kopyasını getirince form sıfırlanıyor, sayfa gizleniyor
    ve kullanıcının yazdıkları siliniyordu.
  */
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) { openedFor.current = null; return; }
    const key = task ? `task:${task.id}` : `new:${initialTitle ?? ''}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    {
      draftRef.current = EMPTY_DRAFT;
      prepareTask();
      setSaving(false);
      setTitleError(false);
      setNlpHint(EMPTY_NLP_HINT);
      setNewSubtaskText('');
      // Önceki açılıştan kalan odak rengi sıfırlanır: sayfa kapanırken onBlur gelmiyor,
      // düzenleme formu odak yokken mavi açılıyordu (cihazda görüldü).
      setFocusedField(null);

      if (task) {
        const loaded: TaskForm = {
          title: locked ? getLocalizedTaskTitle(task, langOf(language) === 'tr') : task.title,
          description: locked ? (getLocalizedTaskDescription(task, langOf(language) === 'tr') ?? '') : task.description || '',
          priority: (task.priority as Priority) || 'Medium',
          // YEREL GÜN — ham `.split('T')[0]` sunucunun ISO damgasının UTC gününü alıyordu;
          // yerel gün UTC'den farklıysa (gece kuşağı) form yanlış günle açılıp, tarihe hiç
          // dokunmadan kaydedilince tarihi sessizce bir gün kaydırıyordu.
          dueDate: calendarDayOf(task.dueDate) ?? '',
          dueTime: task.dueTime || null,
          tags: task.tags || [],
          subtasks: task.subtasks || [],
          recurrence: (task.recurrence as RecurrenceType) || 'None',
          reminderEnabled: task.tags?.includes('hatırlatıcı') || task.tags?.includes('reminder') || false,
        };
        initialRef.current = loaded;
        setForm(loaded);
      } else if (initialTitle) {
        /*
          HIZLI EKLEMEDEN GELDİ. Yalnız başlığı taşımak yetmez: kullanıcı "yarın 15:00"
          yazdıysa o bilgi zaten cümlede var; forma boş tarih/saatle gelmek onu AYNI
          şeyi ikinci kez girmeye zorlardı. Aynı ayrıştırıcı burada da çalışıyor.
          Taban BOŞ form: hızlı eklemede yazılan cümle de kaybedilmemesi gereken bir değişiklik.
        */
        const parsed = parseTaskHint(initialTitle, language as 'tr' | 'en');
        const applied = applyHint({ ...EMPTY_FORM, title: initialTitle }, parsed, EMPTY_DRAFT);
        draftRef.current = applied.draft;
        initialRef.current = EMPTY_FORM;
        setForm(applied.form);
        setNlpHint({ message: '', chips: buildNlpChips(parsed, language) });
      } else {
        initialRef.current = EMPTY_FORM;
        setForm(EMPTY_FORM);
      }
    }
  }, [visible, task, initialTitle, language, prepareTask]);

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

    if (titleError) setTitleError(false);

    /*
      VAR OLAN GÖREV düzenlenirken motor devreye girmez: o görevin tarihi, önceliği ve
      etiketleri verilmiş kararlardır. Başlıktaki bir yazım düzeltmesi onları değiştirmemeli.
    */
    if (task) {
      setForm(f => ({ ...f, title: text }));
      return;
    }

    // Yeni görev: dokunulmamış alanlar cümlenin aynası, elle seçilenler kullanıcının
    // (bkz. nlp/draft). Taslak denetimi yalnız ipucuna ve önceki denetime bağlı —
    // formun anlık hâline değil — bu yüzden güncelleyicinin dışında hesaplanabiliyor.
    const hint = parseTaskHint(text, language as 'tr' | 'en');
    const before = draftRef.current;
    draftRef.current = applyHint(EMPTY_FORM, hint, before).draft;
    setForm(f => applyHint({ ...f, title: text }, hint, before).form);

    // Çipler yalnız motorun GERÇEKTEN uyguladığını gösterir (elle seçilen alan çip olmaz).
    setNlpHint({ message: '', chips: buildNlpChips(visibleHint(hint, draftRef.current), language) });
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

    haptic.commit();
    field === 'title' ? setIsListeningTitle(true) : setIsListeningDesc(true);

    await VoiceService.start({
      language: localeOf(language),
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
        if (msg === 'permission-denied') Alert.alert(c.micTitle, c.micBody);
        else if (msg === 'not-available') Alert.alert(c.voiceNaTitle, c.voiceNaBody);
      },
      onEnded: () => {
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      }
    });
  };

  const setReminder = (on: boolean) => {
    // Anahtar tarih ve saati de kuruyor; saat yoksa kullanıcının VERİMLİ SAATİ (bkz. productivityHour.ts).
    touch('reminder', 'dueDate', 'dueTime');
    setForm(f => (on ? { ...f, ...defaultReminderSlot(f, new Date(), workHourOf(usePrefsStore.getState().productivityHour)), reminderEnabled: true } : { ...f, reminderEnabled: false }));
  };

  const addSubtask = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    setForm(f => ({ ...f, subtasks: [...f.subtasks, { text, done: false }] }));
    setNewSubtaskText('');
  };

  const toggleTag = (tag: string, has: boolean) => {
    haptic.select();
    if (has) { draftRef.current = rejectTag(draftRef.current, tag); setForm(f => ({ ...f, tags: f.tags.filter(x => x !== tag) })); }
    else setForm(f => ({ ...f, tags: [...f.tags, tag] }));
  };

  const canSave = form.title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (saving) return;
    if (!form.title.trim()) {
      setTitleError(true);
      haptic.error();
      titleInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      /*
        SAAT, TARİHSİZ KALAMAZ. Kullanıcı yalnız saati seçip kaydederse görev "saati var
        ama tarihi yok" gibi tutarsız bir haldeydi. Bir saat, ait olduğu günü bilmeden
        anlamsız; en makul varsayım bugündür.
      */
      const safeDueDate = !form.dueDate && form.dueTime ? toDateKey(new Date()) : form.dueDate;
      // YENİ görevde cümleden alana aktarılan kısımlar başlıktan çıkar ("Sunumu bitir yarın
      // 15:00 acil" → "Sunumu bitir"; cihazda görüldü). Düzenlemede motor çalışmaz, başlık olduğu gibi.
      // Mod görevinde başlık + iki dilli yük olduğu gibi korunur (bkz. modeTaskEdit).
      const kept = protectModeContent(task, form);
      const title = task ? kept.title : titleOf(form.title.trim(), understand(form.title.trim(), langOf(language)));
      await onSave({
        ...form,
        title,
        description: kept.description,
        dueDate: safeDueDate,
      });
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!task || !onDelete || saving) return;
    Keyboard.dismiss();
    Alert.alert(c.deleteTitle, c.deleteBody(form.title.trim() || task.title), [
      { text: c.cancel, style: 'cancel' },
      {
        text: c.delete,
        style: 'destructive',
        onPress: async () => {
          haptic.commit();
          setSaving(true);
          try {
            await onDelete(task.id);
            onClose();
          } catch (e) { swallow('TaskFormModal.delete', e); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  const floating = isTablet || iosKeyboard > 0;
  const sheetMaxH = winH - iosKeyboard - insets.top - (isTablet ? S.xxl * 2 : S.md);
  const sectionLabel = (text: string) => (
    <Text style={[styles.optionLabel, { color: theme.onSurfaceMuted }]}>{upperFor(text, language)}</Text>
  );
  const customTags = visibleTextTags(form.tags).filter(tag => !CATEGORY_IDS.some(id => CATEGORY_TAGS[id][langOf(language)] === tag));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={requestClose}
      onShow={() => {
        taskSlideIn();
        // Yeni görevde klavye başlığa hazır gelir (Hatırlatıcılar / Things). Sayfa
        // kayarken odaklamak Android'de klavyeyi titretiyordu — kayma bitince.
        if (!task) setTimeout(() => titleInputRef.current?.focus(), 320);
      }}
    >
      <View style={[styles.overlay, isTablet && styles.overlayCentered]}>
        {/* Sayfanın arka planı — ekran okuyucuda adsız bir kontrol olarak belirmesin. */}
        <Touchable accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} activeOpacity={1} onPress={requestClose} />

        <View style={[styles.sheetContainer, { maxWidth: SHEET_MAX_W, marginBottom: iosKeyboard }]}>
          <RNAnimated.View
            style={[
              styles.sheet,
              taskSlide,
              {
                maxHeight: sheetMaxH,
                borderBottomLeftRadius: floating ? R.sheet : 0,
                borderBottomRightRadius: floating ? R.sheet : 0,
              },
            ]}
          >
            {/* Yüzen sayfa (tablet / klavye üstü) → dört köşe; dibe yapışıkken üst köşeler. */}
            <GlassSurface corners={floating ? 'all' : 'top'} />

            {/* Tutamaç + başlık çubuğu birlikte sürüklenir (iOS sayfası); düğmeler dokunuşu önce alır. */}
            <View {...panResponder.panHandlers}>
              <View style={styles.dragHandleContainer}>
                <View style={[styles.handle, { backgroundColor: theme.outline }]} />
              </View>

              <View style={styles.sheetHeader}>
                <View style={styles.headerSide}>
                  <Touchable
                    onPress={requestClose}
                    style={[styles.closeBtn, { backgroundColor: theme.surfaceField }]}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={c.close}
                  >
                    <X size={ICON.sm} color={saving ? theme.onSurfaceMuted : theme.onSurfaceVariant} strokeWidth={2.2} />
                  </Touchable>
                </View>
                <Text numberOfLines={1} accessibilityRole="header" style={[styles.sheetTitle, { color: theme.onSurface }]}>
                  {task ? t.editTask : t.addTask}
                </Text>
                <View style={[styles.headerSide, styles.headerSideEnd]}>
                  <Touchable
                    onPress={handleSave}
                    disabled={!canSave}
                    accessibilityRole="button"
                    accessibilityLabel={task ? c.save : c.add}
                    accessibilityState={{ disabled: !canSave, busy: saving }}
                    style={[styles.saveBtn, { backgroundColor: canSave || saving ? theme.primary : theme.surfaceField }]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={theme.onPrimary} />
                    ) : (
                      <Text style={[styles.saveText, { color: canSave ? theme.onPrimary : theme.onSurfaceMuted }]}>{task ? c.save : c.add}</Text>
                    )}
                  </Touchable>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: (floating ? S.lg : insets.bottom + S.lg) }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* BAŞLIK + NOT — tek gruplu kart (Hatırlatıcılar), başlık formun en büyük yazısı. */}
              <View style={styles.titleCard}>
                <Pressable
                  onPress={() => { if (!locked) titleInputRef.current?.focus(); }}
                  accessible={false}
                  style={[styles.titleRow, { backgroundColor: titleError ? theme.error + '14' : fieldFill('title') }]}
                >
                  <TextInput
                    ref={titleInputRef}
                    style={[styles.titleInput, { color: theme.onSurface }]}
                    placeholder={isListeningTitle ? t.listeningLabel : c.titlePlaceholder}
                    placeholderTextColor={theme.onSurfaceMuted}
                    value={form.title}
                    editable={!locked}
                    onChangeText={handleTitleChange}
                    onFocus={() => setFocusedField('title')}
                    onBlur={() => setFocusedField(null)}
                    maxLength={150}
                    multiline
                    submitBehavior="blurAndSubmit"
                    returnKeyType="done"
                    accessibilityLabel={t.taskTitle}
                    underlineColorAndroid="transparent"
                  />
                  {hasNlpHint(nlpHint) ? <Sparkles size={ICON.sm} color={theme.primary} /> : null}
                  {locked ? <Lock size={ICON.sm} color={theme.onSurfaceMuted} /> : <Touchable
                    onPress={() => toggleVoice('title')}
                    style={styles.micBtn}
                    accessibilityRole="button"
                    accessibilityLabel={isListeningTitle ? c.voiceStop : c.voice}
                    accessibilityState={{ busy: isListeningTitle }}
                  >
                    <VoiceWave active={isListeningTitle} theme={theme} />
                  </Touchable>}
                </Pressable>
                <View style={[styles.cardSeparator, { backgroundColor: theme.separator }]} />
                <Pressable
                  onPress={() => { if (!locked) descInputRef.current?.focus(); }}
                  accessible={false}
                  style={[styles.notesRow, { backgroundColor: fieldFill('desc') }]}
                >
                  <TextInput
                    ref={descInputRef}
                    style={[styles.notesInput, { color: theme.onSurface }]}
                    placeholder={isListeningDesc ? t.listeningLabel : c.notesPlaceholder}
                    placeholderTextColor={theme.onSurfaceMuted}
                    value={form.description}
                    editable={!locked}
                    onChangeText={handleDescriptionChange}
                    onFocus={() => setFocusedField('desc')}
                    onBlur={() => setFocusedField(null)}
                    multiline
                    maxLength={500}
                    accessibilityLabel={t.taskDescription}
                    underlineColorAndroid="transparent"
                  />
                  {!locked && <Touchable
                    onPress={() => toggleVoice('description')}
                    style={styles.micBtn}
                    accessibilityRole="button"
                    accessibilityLabel={isListeningDesc ? c.voiceStop : c.voice}
                    accessibilityState={{ busy: isListeningDesc }}
                  >
                    <VoiceWave active={isListeningDesc} theme={theme} />
                  </Touchable>}
                </Pressable>
              </View>

              {locked ? (
                <View style={styles.smartHint}>
                  <Lock size={ICON.xs} color={theme.onSurfaceMuted} />
                  <Text style={[styles.helper, { color: theme.onSurfaceVariant, flex: 1 }]}>{c.modeLocked}</Text>
                </View>
              ) : titleError ? (
                <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: theme.error }]}>{c.titleRequired}</Text>
              ) : hasNlpHint(nlpHint) ? (
                <NlpHintRow hint={nlpHint} theme={theme} />
              ) : !task && !form.title ? (
                <View style={styles.smartHint}>
                  <Sparkles size={ICON.xs} color={theme.primary} />
                  <Text style={[styles.helper, styles.helperInline, { color: theme.onSurfaceVariant }]}>{c.smartHint}</Text>
                </View>
              ) : null}

              {/* NE ZAMAN — kısayollar, saat, hatırlatıcı */}
              <View style={styles.section}>
                {sectionLabel(c.date)}
                <ScheduleSection
                  value={form}
                  onDate={(dueDate) => { touch('dueDate'); setForm(f => ({ ...f, dueDate })); }}
                  onTime={(dueTime) => { touch('dueTime'); setForm(f => ({ ...f, dueTime })); }}
                  onReminder={setReminder}
                  theme={theme}
                  isDark={isDark}
                  language={language}
                  c={c}
                />
              </View>

              {/* ÖNCELİK — anlam rengi yalnız noktada */}
              <View style={styles.section}>
                {sectionLabel(c.priority)}
                <SegmentedControl<Priority>
                  accessibilityLabel={c.priority}
                  value={form.priority}
                  onChange={(p) => { touch('priority'); setForm(f => ({ ...f, priority: p })); }}
                  theme={theme}
                  isDark={isDark}
                  options={([
                    { key: 'Low', label: t.filterLow },
                    { key: 'Medium', label: t.filterMedium },
                    { key: 'High', label: t.filterHigh },
                  ] as { key: Priority; label: string }[]).map(p => ({
                    ...p,
                    leading: () => <View style={[styles.priorityDot, { backgroundColor: priorityColor(p.key) }]} />,
                  }))}
                />
              </View>

              {/* TEKRAR */}
              <View style={styles.section}>
                {sectionLabel(c.repeat)}
                <SegmentedControl<RecurrenceType>
                  accessibilityLabel={c.repeat}
                  value={form.recurrence}
                  onChange={(r) => { touch('recurrence'); setForm(f => ({ ...f, recurrence: r })); }}
                  theme={theme}
                  isDark={isDark}
                  options={RECURRENCE_OPTIONS.map(r => ({ key: r.key, label: (t as Record<string, string>)[r.labelKey] }))}
                />
                {form.recurrence !== 'None' && (
                  <View style={styles.smartHint}>
                    <Repeat size={ICON.xs} color={form.dueDate ? theme.primary : theme.onSurfaceMuted} />
                    <Text style={[styles.helper, styles.helperInline, { color: form.dueDate ? theme.primary : theme.onSurfaceVariant }]}>
                      {form.dueDate ? getNextOccurrenceLabel(form.dueDate, form.recurrence, language, c) : c.repeatNeedsDate}
                    </Text>
                  </View>
                )}
              </View>

              {/* ALT GÖREVLER — gruplu liste, ekleme satırı listenin son satırı (Things kontrol listesi) */}
              <View style={styles.section}>
                {sectionLabel(c.subtasks)}
                <View style={[styles.groupCard, { backgroundColor: theme.surfaceField }]}>
                  {form.subtasks.map((sub, i) => (
                    <React.Fragment key={`${i}-${sub.text}`}>
                      <View style={styles.subtaskRow}>
                        <Touchable
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: sub.done }}
                          accessibilityLabel={`${sub.text} — ${sub.done ? c.subtaskDone : c.subtaskOpen}`}
                          onPress={() => {
                            /*
                              FONKSİYONEL GÜNCELLEME + YENİ NESNE: kapanıştaki bayat diziyi okumak
                              hızlı iki dokunuşta ilkini kaybettiriyordu; nesneyi yerinde değiştirmek
                              Kaydet'e basılmadan üst bileşendeki ORİJİNAL göreve işliyordu.
                            */
                            setForm(f => ({
                              ...f,
                              subtasks: f.subtasks.map((s, idx) => idx === i ? { ...s, done: !s.done } : s),
                            }));
                            haptic.surface();
                          }}
                          style={[styles.checkbox, { borderColor: sub.done ? theme.success : theme.outline, backgroundColor: sub.done ? theme.success + '1A' : 'transparent' }]}
                        >
                          {sub.done ? <Check size={ICON.xs} color={theme.success} strokeWidth={2.6} /> : null}
                        </Touchable>
                        <Text style={[styles.subtaskText, { color: sub.done ? theme.onSurfaceMuted : theme.onSurface, textDecorationLine: sub.done ? 'line-through' : 'none' }]}>
                          {sub.text}
                        </Text>
                        <Touchable
                          accessibilityRole="button"
                          accessibilityLabel={c.removeSubtask}
                          onPress={() => {
                            haptic.commit();
                            setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, idx) => idx !== i) }));
                          }}
                          style={styles.iconBtn}
                        >
                          {/* Yıkıcı eylem `error` ile çizilir; `priorityHigh` görevin ACİLİYETİNİ anlatır. */}
                          <Trash2 size={ICON.sm} color={theme.error} />
                        </Touchable>
                      </View>
                      <View style={[styles.subtaskSeparator, { backgroundColor: theme.separator }]} />
                    </React.Fragment>
                  ))}
                  <Pressable
                    onPress={() => subtaskInputRef.current?.focus()}
                    accessible={false}
                    style={[styles.subtaskRow, { backgroundColor: focusedField === 'subtask' ? fieldFill('subtask') : 'transparent' }]}
                  >
                    <Plus size={ICON.sm} color={theme.primary} strokeWidth={2.4} />
                    <TextInput
                      ref={subtaskInputRef}
                      style={[styles.subtaskInput, { color: theme.onSurface }]}
                      placeholder={c.addSubtask}
                      placeholderTextColor={theme.onSurfaceMuted}
                      value={newSubtaskText}
                      onChangeText={setNewSubtaskText}
                      onFocus={() => setFocusedField('subtask')}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={addSubtask}
                      // Art arda madde yazılabilsin: Enter klavyeyi kapatmaz.
                      submitBehavior="submit"
                      returnKeyType="next"
                      accessibilityLabel={c.addSubtask}
                    />
                    {newSubtaskText.trim() ? (
                      <Touchable accessibilityRole="button" accessibilityLabel={c.addSubtask} onPress={addSubtask} style={[styles.addSubtaskBtn, { backgroundColor: theme.primary }]}>
                        <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={2.6} />
                      </Touchable>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              {/* ETİKETLER — kategori yongaları açılıp kapanır; motorun/kullanıcının özel etiketleri kaldırılabilir */}
              <View style={styles.section}>
                {sectionLabel(t.tags || c.tags)}
                {customTags.length > 0 && (
                  <View style={styles.customTags}>
                    {customTags.map(tag => (
                      <Touchable
                        key={tag}
                        accessibilityRole="button"
                        accessibilityLabel={c.removeTag(tag)}
                        onPress={() => toggleTag(tag, true)}
                        style={[styles.tagChip, { backgroundColor: theme.primary + '1F' }]}
                      >
                        <Text style={[styles.tagText, { color: theme.primary, fontWeight: '600' }]}>{translateTag(tag, language as 'tr' | 'en')}</Text>
                        <X size={ICON.xs} color={theme.primary} />
                      </Touchable>
                    ))}
                  </View>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.tagRow}>
                  {CATEGORY_IDS.map(id => CATEGORY_TAGS[id][langOf(language)]).map(tagOption => {
                    const hasTag = form.tags.includes(tagOption);
                    return (
                      <Touchable
                        key={tagOption}
                        accessibilityRole="button"
                        accessibilityLabel={translateTag(tagOption, language as 'tr' | 'en')}
                        accessibilityState={{ selected: hasTag }}
                        onPress={() => toggleTag(tagOption, hasTag)}
                        style={[styles.tagChip, { backgroundColor: hasTag ? theme.primary + '1F' : theme.surfaceField }]}
                      >
                        {hasTag ? <Check size={ICON.xs} color={theme.primary} strokeWidth={2.4} /> : null}
                        <Text style={[styles.tagText, { color: hasTag ? theme.primary : theme.onSurfaceVariant, fontWeight: hasTag ? '600' : '500' }]}>
                          {translateTag(tagOption, language as 'tr' | 'en')}
                        </Text>
                      </Touchable>
                    );
                  })}
                </ScrollView>
              </View>

              {task && onDelete && (
                <Touchable
                  onPress={confirmDelete}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={c.deleteTask}
                  style={[styles.deleteBtn, { backgroundColor: theme.error + '12' }]}
                >
                  <Trash2 size={ICON.sm} color={theme.error} />
                  <Text style={[styles.deleteText, { color: theme.error }]}>{c.deleteTask}</Text>
                </Touchable>
              )}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </View>
      <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlayCentered: { justifyContent: 'center' },
  sheetContainer: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    borderWidth: B.thin,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    paddingTop: S.sm,
    paddingBottom: S.xs,
    alignItems: 'center',
  },
  handle: {
    width: scale(36),
    height: 5,
    borderRadius: R.full,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
  },
  headerSide: { flex: 1, alignItems: 'flex-start' },
  headerSideEnd: { alignItems: 'flex-end' },
  sheetTitle: {
    fontSize: F.subhead,
    fontWeight: '600',
    letterSpacing: -0.2,
    maxWidth: '55%',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minWidth: 72,
    height: 36,
    paddingHorizontal: S.md,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: F.body, fontWeight: '600', letterSpacing: 0 },
  formContainer: { flexGrow: 0 },
  titleCard: { borderRadius: R.lg, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingLeft: S.md, paddingRight: S.xs, minHeight: 56 },
  titleInput: {
    flex: 1,
    fontSize: F.subhead,
    fontWeight: '600',
    paddingVertical: S.smd,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xs, paddingLeft: S.md, paddingRight: S.xs, minHeight: 76 },
  notesInput: {
    flex: 1,
    fontSize: F.body,
    paddingTop: S.smd,
    paddingBottom: S.smd,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  cardSeparator: { height: HAIRLINE, marginLeft: S.md },
  micBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  voiceWave: { alignItems: 'center', justifyContent: 'center' },
  voiceHalo: { position: 'absolute', width: 32, height: 32, borderRadius: R.full, zIndex: -1 },
  smartHint: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, paddingHorizontal: S.xs },
  helper: { fontSize: F.caption2, fontWeight: '500', marginTop: S.sm, paddingHorizontal: S.xs },
  helperInline: { flex: 1, marginTop: 0, paddingHorizontal: 0 },
  section: { marginTop: S.lg },
  optionLabel: {
    /*
      PUNTO ÖLÇEKTEN — `F.caption` okunabilirliğin alt sınırı (bkz. tokens.ts); başlıklar
      eskiden 10 pt ile "okunmak için değil, var olmak için" yazılmıştı.
    */
    fontSize: F.caption,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: S.sm,
    marginLeft: S.xs,
  },
  priorityDot: { width: 8, height: 8, borderRadius: R.full },
  groupCard: { borderRadius: R.lg, overflow: 'hidden' },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: MIN_TOUCH + S.xs, paddingLeft: S.md, paddingRight: S.xs },
  subtaskSeparator: { height: HAIRLINE, marginLeft: S.md + 22 + S.smd },
  checkbox: { width: 22, height: 22, borderRadius: R.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  subtaskText: { flex: 1, fontSize: F.body, paddingVertical: S.sm },
  subtaskInput: { flex: 1, fontSize: F.body, paddingVertical: S.sm },
  addSubtaskBtn: { width: 28, height: 28, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginRight: S.xs },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  customTags: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm },
  tagRow: { gap: S.xs, paddingRight: S.xs },
  tagChip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.smd, borderRadius: R.full },
  tagText: { fontSize: F.footnote, letterSpacing: 0 },
  deleteBtn: {
    marginTop: S.xl,
    minHeight: MIN_TOUCH + S.xs,
    borderRadius: R.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
  },
  deleteText: { fontSize: F.body, fontWeight: '600' },
});
