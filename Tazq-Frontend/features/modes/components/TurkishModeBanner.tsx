import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Animated, useWindowDimensions, Alert, TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import { X, ChevronRight, Check, Zap, ArrowLeft, Flame, Target, RefreshCw, Trash2, TrendingUp, CheckCircle2, Circle, Star, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { TaskService } from '@/shared/services/api';
import { TurkishMode, StudyTemplate, ModeHabit, ModeTask } from '../utils/turkishModes';
import { getCurrentRamadanStatus } from '@/shared/utils/ramadanDates';
import { renderModeEmojiIcon } from '../utils/modeIcons';
import { extractPlanFromText, QUICK_EMOJIS, QUICK_COLORS, DraftHabit, DraftTask } from '@/shared/utils/planExtractor';
import { S, R, F, B } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { Touchable } from '@/shared/components/Touchable';
import { usePrefsStore, PlanMode, PlanSpec, SeasonalPrefs } from '../store/usePrefsStore';
import { usePlanAdaptations } from '../hooks/usePlanAdaptations';

interface Props {
  mode: TurkishMode;
  onDismiss: () => void;
  showSheetImmediately?: boolean;
  onApplied?: (habitIds: string[], taskIds: number[], meta?: { templateId?: string; dailyMinutes?: number }) => void;
  onSheetClose?: () => void;
  planApplied?: boolean;
  planHabitIds?: string[];
  planTaskIds?: number[];
  onClearPlan?: (preserveMeta?: boolean) => void;
  defaultTemplateId?: string;
  onRatingChange?: (rating: number) => void;
  activeSlot?: string;
}

const ALGORITHM_DESCRIPTIONS = {
  exam: {
    tr: 'Sınav tarihine kalan güne göre 5 farklı eğitim fazı (Konu Tarama ➔ Derinleşme ➔ Hızlanma ➔ Sprint ➔ Sınav Günü) otomatik tetiklenir ve günlük çalışma süresi bu fazlara göre adapte edilir.',
    en: 'Automatically schedules 5 study phases (Coverage ➔ Deepening ➔ Focus ➔ Sprint ➔ Exam Day) based on your remaining days, adjusting daily minutes and difficulty.'
  },
  tez: {
    tr: 'Tezin teslim tarihine kalan güne göre haftalık raporlama sıklığı ve teslim adımları (son 2 hafta kaynakça/dipnot format kontrolü vb.) otomatik planlanır.',
    en: 'Weekly reporting frequencies and final formatting checks (footnotes, bibliography in final 2 weeks) are automatically adapted based on your deadline.'
  },
  mulakat: {
    tr: 'Mülakat tarihine kalan süreye göre hazırlık havuzunu daraltır (Son 14 gün CV uyarlama, son 7 gün şirket araştırması, son 3 gün mock mülakat ve ses kaydı, son 24 saat hazırlık).',
    en: 'Narrows your preparation focus as the date nears (CV tailoring 14 days out, company research at 7 days, mock interviews/recording at 3 days, final details in last 24h).'
  },
  spor: {
    tr: 'Spor tarihine kalan süreyi izler. Maraton için son 3 hafta tapering (mesafe azaltma) evresini başlatır; Güç planı için her 4 haftada bir hafif çalışma (Deload) haftası atar.',
    en: 'Monitors remaining weeks. Triggers 3-week tapering (mileage drop) for marathons, and schedules deload weeks every 4 weeks for strength/hypertrophy programs.'
  },
  ramazan: {
    tr: 'Bayram tarihine kalan süreyi hesaplar ve son 10 güne girildiğinde Kadir Gecesi ibadet programı görevi gibi dönemsel görevler üretir.',
    en: 'Counts down to the end of Ramadan, automatically generating laylat al-qadr worship plans and bayram preparation steps during the final 10 days.'
  },
  tasarruf: {
    tr: 'Hedeflenen bütçe/birikim tarihine kalan süreyi izler, haftalık harcama ve bütçe planlamalarını bu ritme göre organize eder.',
    en: 'Tracks remaining weeks to your savings target date, structuring weekly spending reviews and emergency fund actions around your timeline.'
  },
  birakma: {
    tr: 'Bir bitiş tarihi yerine, başladığın andan itibaren geçen temiz gün serini takip eder, kritik haftalık ve aylık dönemeçlerde özel kilometre taşları belirler.',
    en: 'Instead of counting down to a deadline, it tracks your elapsed clean days, creating custom milestones at critical weekly and monthly intervals.'
  }
};

export const TurkishModeBanner: React.FC<Props> = ({
  mode, onDismiss, showSheetImmediately, onApplied, onSheetClose,
  planApplied, planHabitIds = [], planTaskIds = [], onClearPlan,
  defaultTemplateId, onRatingChange, activeSlot,
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { habits, addHabit, getStreak } = useHabitStore();
  const { tasks, addTask } = useTaskStore();
  const { setDailyGoal } = useFocusStore();
  const ramazanStatus = useMemo(() => getCurrentRamadanStatus(), []);
  const isRamazanActive = ramazanStatus.isActive;

  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StudyTemplate | null>(() => {
    if (defaultTemplateId && mode.templates?.length) {
      return mode.templates.find(t => t.id === defaultTemplateId) ?? null;
    }
    return null;
  });
  const [deselectedHabits, setDeselectedHabits] = useState<Set<string>>(new Set());
  const sheetWasOpenRef = React.useRef(false);
  const appliedRef = React.useRef(false);
  const onSheetCloseRef = React.useRef(onSheetClose);
  onSheetCloseRef.current = onSheetClose;

  const [step, setStep] = useState<'template' | 'review' | 'custom'>(() => {
    const hasItems = habits.some(h => planHabitIds.includes(h.id)) || tasks.some(t => planTaskIds.includes(t.id));
    const reallyApplied = !!planApplied && hasItems;
    if (reallyApplied || !mode.templates?.length) return 'review';
    if (defaultTemplateId && mode.templates?.some(t => t.id === defaultTemplateId)) return 'review';
    return 'template';
  });

  // Custom plan state
  const [customHabits, setCustomHabits] = useState<DraftHabit[]>([]);
  const [customTasks,  setCustomTasks]  = useState<DraftTask[]>([]);
  const [customAiText, setCustomAiText] = useState('');
  const [customGoal,   setCustomGoal]   = useState(60);

  // Timeline editing state
  const [isEditingTimeline, setIsEditingTimeline] = useState(false);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const planSpecs = usePrefsStore(s => s.planSpecs);
  const setPlanSpec = usePrefsStore(s => s.setPlanSpec);
  const seasonal = usePrefsStore(s => s.seasonal);
  const { runAdaptations: runPlanAdaptations } = usePlanAdaptations();
  const { show: showToast } = useToastStore();

  const initialDateStr = useMemo(() => {
    if (!activeSlot) return '';
    const dateKeyMap: Record<string, keyof SeasonalPrefs> = {
      exam: 'examDate', exam2: 'exam2Date', exam3: 'exam3Date',
      tez: 'tezDate', mulakat: 'mulakatDate', mulakat2: 'mulakat2Date',
      mulakat3: 'mulakat3Date', spor: 'sporDate', spor2: 'spor2Date',
      spor3: 'spor3Date', tasarruf: 'tasarrufDate'
    };
    const key = dateKeyMap[activeSlot];
    return key ? (seasonal[key] as string || '') : '';
  }, [activeSlot, seasonal]);

  const initialMinutes = useMemo(() => {
    if (!activeSlot) return 60;
    const spec = planSpecs[activeSlot as PlanMode];
    return spec?.dailyMinutes ?? 60;
  }, [activeSlot, planSpecs]);

  const [editedDate, setEditedDate] = useState(initialDateStr);
  const [editedMinutes, setEditedMinutes] = useState(initialMinutes);

  useEffect(() => {
    setEditedDate(initialDateStr);
  }, [initialDateStr]);

  useEffect(() => {
    setEditedMinutes(initialMinutes);
  }, [initialMinutes]);

  const handleSaveTimeline = () => {
    if (!activeSlot) return;
    
    if (activeSlot !== 'birakma' && activeSlot !== 'ramazan') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(editedDate)) {
        Alert.alert(
          tr ? 'Geçersiz Tarih' : 'Invalid Date',
          tr ? 'Lütfen tarihi YYYY-AA-GG formatında girin.' : 'Please enter the date in YYYY-MM-DD format.'
        );
        return;
      }
      
      const parsed = Date.parse(editedDate);
      if (isNaN(parsed)) {
        Alert.alert(
          tr ? 'Geçersiz Tarih' : 'Invalid Date',
          tr ? 'Girdiğiniz tarih geçerli değil.' : 'The date you entered is not valid.'
        );
        return;
      }

      const dateKeyMap: Record<string, keyof SeasonalPrefs> = {
        exam: 'examDate', exam2: 'exam2Date', exam3: 'exam3Date',
        tez: 'tezDate', mulakat: 'mulakatDate', mulakat2: 'mulakat2Date',
        mulakat3: 'mulakat3Date', spor: 'sporDate', spor2: 'spor2Date',
        spor3: 'spor3Date', tasarruf: 'tasarrufDate'
      };
      const key = dateKeyMap[activeSlot];
      if (key) {
        setSeasonalPref(key, editedDate);
      }
    }

    if (activeSlot !== 'birakma') {
      const currentSpec = planSpecs[activeSlot as PlanMode] || {};
      setPlanSpec(activeSlot as PlanMode, {
        ...currentSpec,
        dailyMinutes: editedMinutes
      });
      setDailyGoal(editedMinutes);
    }

    setIsEditingTimeline(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(tr ? 'Zaman çizelgesi güncellendi ve plan adapte edildi.' : 'Timeline updated and plan adapted.', 'success');

    setTimeout(() => {
      runPlanAdaptations(true);
    }, 300);
  };

  useEffect(() => {
    if (sheetVisible) {
      sheetWasOpenRef.current = true;
      // Auto-select the recommended template when the sheet first opens
      if (defaultTemplateId && !selectedTemplate && mode.templates?.length) {
        const match = mode.templates.find(t => t.id === defaultTemplateId);
        if (match) setSelectedTemplate(match);
      }
    } else if (sheetWasOpenRef.current) {
      sheetWasOpenRef.current = false;
      if (!appliedRef.current) onSheetCloseRef.current?.();
    }
  }, [sheetVisible]);

  const { panResponder, animatedStyle, prepare: prepareSheet, slideIn } = useSwipeToDismiss({
    onDismiss: () => setSheetVisible(false),
  });

  const hasTemplates = (mode.templates?.length ?? 0) > 0;
  const activeHabits = selectedTemplate?.habits ?? mode.habits;
  const activeTasks = selectedTemplate?.tasks ?? mode.tasks;

  const existingHabitNames = new Set(habits.map(h => h.name.toLowerCase()));
  const existingTaskTitles = new Set(tasks.map(t => t.title.toLowerCase()));

  const newHabits = activeHabits.filter(h => !existingHabitNames.has(h.name.toLowerCase()));
  const newTasksRaw = activeTasks.filter(t =>
    !existingTaskTitles.has(t.titleTr.toLowerCase()) &&
    !existingTaskTitles.has(t.titleEn.toLowerCase())
  );
  // Gelecek-tarihli (daysFromNow > 1) görevler artık günlük plan motoru tarafından üretiliyor;
  // plan uygulanırken materyalize edilmez. Yalnızca setup görevleri + kilo zincirini başlatan
  // tek bir weight_entry görevi gerçekten oluşturulur. Sayım/buton/uygula hepsi bunu yansıtır.
  let keptWeightEntry = false;
  const newTasks = newTasksRaw.filter(t => {
    const isFar = t.daysFromNow !== undefined && t.daysFromNow > 1;
    if (!isFar) return true;
    if (t.tags?.includes('weight_entry') && !keptWeightEntry) { keptWeightEntry = true; return true; }
    return false;
  });
  const allDone = newHabits.length === 0 && newTasks.length === 0;

  // Plan view data — active habits/tasks from this plan
  const todayKey = fmtDateKey();
  const planHabits = useMemo(
    () => habits.filter(h => planHabitIds.includes(h.id)),
    [habits, planHabitIds]
  );
  const planTasks = useMemo(
    () => tasks.filter(t => planTaskIds.includes(t.id)),
    [tasks, planTaskIds]
  );

  // GERÇEK uygulanmış durum: id'ler var AMA karşılık gelen öğeler de mevcut.
  // Stale id (öğeler silinmiş) → uygulanmamış say → oluşturma/şablon akışı açılır.
  const effectiveApplied = !!planApplied && (planHabits.length + planTasks.length > 0);

  // Last 7 days keys for weekly stats
  const last7Keys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return fmtDateKey(d);
    });
  }, []);

  const planHabitStats = useMemo(() => planHabits.map(h => {
    const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
    const streak = getStreak(h);
    const doneToday = dates.includes(todayKey);
    const weekDone = last7Keys.filter(k => dates.includes(k)).length;
    return { ...h, streak, doneToday, weekDone };
  }), [planHabits, todayKey, last7Keys, getStreak]);

  const planTaskStats = useMemo(() => planTasks.map(t => ({
    ...t,
    done: !!t.isCompleted,
  })), [planTasks]);

  const completedPlanTasks = planTaskStats.filter(t => t.done).length;
  const totalPlanTasks = planTaskStats.length;
  const avgHabitWeekPct = planHabitStats.length > 0
    ? Math.round(planHabitStats.reduce((s, h) => s + h.weekDone / 7, 0) / planHabitStats.length * 100)
    : 0;

  const [rating, setRating] = useState<number | null>(null);
  const ratingKey = `tazq_eval_${mode.type}_${todayKey}`;

  useEffect(() => {
    if (sheetVisible) {
      AsyncStorage.getItem(ratingKey).then(val => {
        if (val) {
          setRating(parseInt(val, 10));
        } else {
          setRating(null);
        }
      }).catch(() => {});
    }
  }, [sheetVisible, ratingKey]);

  const saveRating = async (score: number) => {
    try {
      Haptics.selectionAsync();
      setRating(score);
      await AsyncStorage.setItem(ratingKey, score.toString());
      onRatingChange?.(score);
    } catch (e) {
      console.warn('Failed to save daily rating', e);
    }
  };

  const insightText = useMemo(() => {
    const now = new Date().getTime();
    const MS_IN_DAY = 24 * 60 * 60 * 1000;

    // Check if the plan is brand new (all habits in the plan created within the last 36 hours and no completions recorded yet)
    const isNewPlan = planHabits.length > 0 && planHabits.every(h => {
      const createdTime = h.createdAt ? new Date(h.createdAt).getTime() : now;
      return (now - createdTime) < 1.5 * MS_IN_DAY;
    }) && planHabits.reduce((acc, h) => acc + (h.completedDates?.length ?? 0), 0) === 0;

    const completedTodayCount = planHabitStats.filter(h => h.doneToday).length;
    const allTodayCompleted = planHabitStats.length > 0 && completedTodayCount === planHabitStats.length;
    const bestStreak = planHabitStats.length > 0 ? Math.max(...planHabitStats.map(h => h.streak)) : 0;

    const isHigh = avgHabitWeekPct >= 70 || (totalPlanTasks > 0 && completedPlanTasks / totalPlanTasks >= 0.70);
    const isLow = avgHabitWeekPct < 35;
    
    if (mode.type === 'exam') {
      if (isNewPlan) {
        return tr
          ? "Sınav hazırlık planın hazır! İlk adımı atmak en zorudur ama seni hedeflerine ulaştıracak olan da budur. Bugün listenden bir alışkanlık veya görevi tamamlayarak harika bir başlangıç yapabilirsin."
          : "Your exam prep plan is ready! Taking the first step is the hardest, but it's what leads you to your goals. You can make a great start today by completing just one habit or task from your list.";
      } else if (allTodayCompleted) {
        return tr
          ? "Harika! Bugünün tüm hedeflerini tamamladın. Bu günlük odaklanma ve kararlılık sınav gününde seni zirveye taşıyacak. Dinlenmeyi hak ettin!"
          : "Great job! You've completed all of today's goals. This daily focus and determination will carry you to the top on exam day. You've earned some rest!";
      } else if (bestStreak >= 3) {
        return tr
          ? `Sınav hazırlığında ${bestStreak} günlük harika bir seri yakaladın! İstikrar en büyük kozun. Zinciri kırmamak için bugün de hedeflerini tamamla.`
          : `You've caught a great ${bestStreak}-day streak in your exam prep! Consistency is your biggest asset. Complete today's goals to keep the chain unbroken.`;
      } else if (isHigh) {
        return tr 
          ? "Sınav disiplinin mükemmel seviyede! Haftalık alışkanlıkların ve görev tamamlama oranın oldukça yüksek. Bu tempoyu korursan hedefine ulaşmaman için hiçbir neden yok."
          : "Your exam discipline is at an excellent level! Your weekly habits and task completion rates are very high. Keep this pace up and there is no reason not to reach your goal.";
      } else if (isLow) {
        return tr
          ? "Bu ara tempodan düşmüş görünüyorsun. Kendine çok yüklenmeden, bugün sadece en kolay sınav görevine veya tek bir alışkanlığa odaklanarak ivme kazanmaya ne dersin?"
          : "Looks like you've lost momentum recently. Without pushing yourself too hard, how about starting with the easiest exam task or just a single habit today to gain momentum?";
      } else {
        return tr
          ? "İyi bir tempon var ama biraz daha istikrar sınav başarını katlayacaktır. Günlük planına sadık kalmaya çalış. Adım adım hedefe ilerliyorsun."
          : "You have a good tempo, but a bit more consistency will boost your exam success. Try to stay true to your daily plan. You are moving step by step to your goal.";
      }
    } else if (mode.type === 'tez') {
      if (isNewPlan) {
        return tr
          ? "Akademik maratonun başlıyor! Tez yazımında en önemli şey düzenli çalışmadır. Bugün kendine sadece 15 dakikalık okuma veya yazma hedefi koyarak ilk adımı atabilirsin."
          : "Your academic marathon begins! The most important thing in thesis writing is regular work. Today, you can take the first step by setting a simple 15-minute reading or writing goal.";
      } else if (allTodayCompleted) {
        return tr
          ? "Harika! Bugünün tez hedeflerini eksiksiz bitirdin. Her gün atılan bu küçük adımlar, o tezin başarıyla tamamlanmasını sağlayacak en önemli güçtür."
          : "Great! You completed today's thesis goals completely. These small daily steps are the key force that will ensure your thesis is successfully finished.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Tez çalışmanda ${bestStreak} günlük bir seri yakaladın! Akademik disiplinin harika gidiyor. Rutinini bozmadan bugün de devam et.`
          : `You've built a ${bestStreak}-day streak in your thesis work! Your academic discipline is going great. Keep it up today without breaking the routine.`;
      } else if (isHigh) {
        return tr
          ? "Akademik disiplinin takdire şayan! Tez sürecinde en önemli şey sürekliliktir ve sen bunu başarıyorsun. Yazma ve araştırma rutinlerini korumaya devam et."
          : "Your academic discipline is highly commendable! Consistency is key in the thesis process and you're achieving it. Keep maintaining your writing and research routines.";
      } else if (isLow) {
        return tr
          ? "Yazma blokajı mı yaşıyorsun? Tezi gözünde büyütmek yerine sadece bugün için tek bir küçük kaynak okumayı veya bir paragraf yazmayı dene. Büyük işler küçük adımlarla başlar."
          : "Experiencing writer's block? Instead of letting the thesis overwhelm you, try reading just one source or writing a single paragraph today. Big tasks start with small steps.";
      } else {
        return tr
          ? "Tez yazımında ilerleme kaydediyorsun fakat bloklar halinde değil, düzenli çalışmak işini kolaylaştıracaktır. Bu hafta rutinlerini biraz daha yukarı taşımaya odaklan."
          : "You are making progress on your thesis, but working regularly rather than in big chunks will make it easier. Focus on boosting your routines a bit more this week.";
      }
    } else if (mode.type === 'mulakat') {
      if (isNewPlan) {
        return tr
          ? "Kariyer hedeflerine giden yolda ilk adım! Mülakat hazırlığı bir süreçtir. Bugün temel bir teknik konuyu gözden geçirerek veya özgeçmişine bakarak profesyonel başlangıcını yapabilirsin."
          : "The first step toward your career goals! Interview prep is a process. Today, you can make your professional start by reviewing a basic technical topic or looking over your resume.";
      } else if (allTodayCompleted) {
        return tr
          ? "Bugünün mülakat hazırlık görevlerini başarıyla tamamladın! Bu planlı çalışma sayesinde görüşme gününde kendine güvenin tam olacak."
          : "You've successfully completed today's interview prep tasks! Thanks to this planned effort, you will be fully confident on interview day.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Mülakat hazırlığında ${bestStreak} günlük bir seri yakaladın! Her gün pratik yapmak seni rakiplerinden öne geçirecektir. Seriyi bugün de koru.`
          : `You've hit a ${bestStreak}-day streak in your interview prep! Daily practice will set you apart from other candidates. Maintain the streak today.`;
      } else if (isHigh) {
        return tr
          ? "Mülakata hazırlığın son derece profesyonel. Düzenli pratik ve hazırlık sayesinde hayalindeki o iş teklifini almaya çok yakınsın. Harika iş!"
          : "Your prep for the interview is extremely professional. Thanks to regular practice and prep, you are very close to landing that dream job offer. Great job!";
      } else if (isLow) {
        return tr
          ? "Hazırlığı erteleme eğiliminde misin? Bugün sadece 5 dakikalık bir kendini tanıtma simülasyonu yapmayı veya tek bir mülakat sorusuna yanıt aramayı dene."
          : "Are you tending to delay your prep? Today, try just a 5-minute self-introduction simulation or find an answer to a single common interview question.";
      } else {
        return tr
          ? "Hazırlığın iyi gidiyor ama teknik konuları veya mülakat simülasyonlarını biraz daha sıklaştırmalısın. Rutin pratikler mülakat heyecanını azaltacaktır."
          : "Your prep is going well, but you should practice technical topics or interview simulations more frequently. Routine practice will reduce your interview anxiety.";
      }
    } else if (mode.type === 'spor') {
      if (isNewPlan) {
        return tr
          ? "Sağlıklı ve güçlü bir beden için harika bir karar! Sporda en önemli şey başlamaktır. Bugün sadece hafif bir egzersiz veya su içme alışkanlığıyla ilk adımı atabilirsin."
          : "A great decision for a healthy and strong body! The most important thing in sports is starting. Today, you can take the first step with just a light exercise or drinking water habit.";
      } else if (allTodayCompleted) {
        return tr
          ? "Bugünün tüm spor hedeflerini tamamladın! Vücudun bu disipline minnettar kalacak. Kendini ödüllendir ve kaslarının dinlenmesine izin ver."
          : "You completed all of today's sports goals! Your body will thank you for this discipline. Reward yourself and allow your muscles to recover.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Sporda ${bestStreak} günlük harika bir seri yakaladın! Vücudun bu ritme alışmaya başladı. İstikrarı sürdürmek için bugün de rutinini tamamla.`
          : `You've built a great ${bestStreak}-day sports streak! Your body is getting used to this rhythm. Complete your routine today to keep the consistency going.`;
      } else if (isHigh) {
        return tr
          ? "Performansın zirvede! Alışkanlıkların ve spor rutinin harika ilerliyor. Bu disiplin ve güç seni hedeflerine çok hızlı ulaştıracak. Aynen devam!"
          : "Your performance is peak! Your habits and sports routine are progressing wonderfully. This discipline and strength will bring you to your goals very fast. Keep it up!";
      } else if (isLow) {
        return tr
          ? "Sporda motivasyon kaybı normaldir, en önemli şey tekrar başlamaktır. Kendini zorlamadan bugün sadece hafif bir yürüyüş veya esneme yaparak rutine geri dönebilirsin."
          : "Loss of motivation in sports is normal; the key is starting again. Without pushing yourself, you can warm back into the routine with just a light walk or stretch today.";
      } else {
        return tr
          ? "Aktifsin ama antrenman ve beslenme rutinlerinde daha fazla istikrar hedefine daha hızlı ulaştıracaktır. Günlük takiplere devam et, sonuçları göreceksin."
          : "You are active, but more consistency in training and nutrition routines will bring you to your goal faster. Keep tracking daily, you will see results.";
      }
    } else {
      // Default / Ramadan mode
      if (isNewPlan) {
        return tr
          ? "Yeni manevi ve fiziksel rutinin hayırlı olsun! Alışkanlıklarına alışmak zaman alabilir, acele etme. Bugün sadece küçük bir niyet veya hafif bir okuma ile başlayabilirsin."
          : "Welcome to your new spiritual and physical routine! It can take time to adjust to your habits, don't rush. You can start today with just a small intention or light reading.";
      } else if (allTodayCompleted) {
        return tr
          ? "Mükemmel! Bugünün tüm rutinlerini tamamlayarak manevi ve zihinsel odaklanmanı en üst seviyede tuttun. Huzurlu ve verimli bir gün geçirdin."
          : "Perfect! By completing all of today's routines, you kept your spiritual and mental focus at the highest level. You had a peaceful and productive day.";
      } else if (bestStreak >= 3) {
        return tr
          ? `Rutinlerinde ${bestStreak} günlük harika bir istikrar yakaladın! Zihinsel ve bedensel huzurunu korumak için bugün de hedeflerini tamamla.`
          : `You've achieved a great ${bestStreak}-day consistency in your routines! Complete your goals today to maintain your mental and physical peace.`;
      } else if (isHigh) {
        return tr
          ? "Disiplinin ve sadakatin mükemmel seviyede. Planına olan bağlılığın manevi ve zihinsel odaklanmanı artıracaktır. Hayırlı ve verimli günler dileriz!"
          : "Your discipline and dedication are at an excellent level. Your loyalty to the plan will enhance your spiritual and mental focus. Wishing you blessed and productive days!";
      } else if (isLow) {
        return tr
          ? "Yeni tempoya alışmak zaman alabilir. Kendini çok yormadan, günlük küçük niyetler ve kolay hedeflerle planına yeniden odaklanabilirsin."
          : "Getting used to the new pace can take time. Without pushing yourself too hard, you can refocus on your plan with small daily intentions and easy goals.";
      } else {
        return tr
          ? "Rutinlerin fena gitmiyor. Günlük ibadet, okuma veya dinlenme dengeni korumak için planına sadık kalmaya çalış. İstikrar huzur getirecektir."
          : "Your routines are not going bad. Try to stay committed to your plan to keep your daily prayer, reading, or resting balance. Consistency brings peace.";
      }
    }
  }, [mode.type, avgHabitWeekPct, completedPlanTasks, totalPlanTasks, tr, planHabits, planHabitStats]);

  const openSheet = () => {
    prepareSheet();
    setSheetVisible(true);
  };

  useEffect(() => {
    if (showSheetImmediately) {
      setTimeout(() => openSheet(), 150);
    }
  }, [showSheetImmediately]);

  const applyAll = async () => {
    if (applying || allDone) return;
    setApplying(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Temiz bir sayfa açmak ve eski (çifte) hedefleri önlemek için önceki planı sil:
    onClearPlan?.(true);

    if (selectedTemplate?.dailyGoalMinutes) setDailyGoal(selectedTemplate.dailyGoalMinutes);

    const addedHabitIds: string[] = [];
    for (const h of newHabits.filter(h => !deselectedHabits.has(h.name))) {
      const hid = `habit_${mode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const habitName = tr ? h.nameTr : h.name;
      addHabit(habitName, h.emoji, h.color, hid, mode.type, h.nameTr, h.name);
      addedHabitIds.push(hid);
    }

    // Smart scheduling: tasks drip in over multiple days, not all at once
    // High priority → today, Medium → +1/+2/... days, Low → +4 days, weight_entry → +7 days
    const localDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const today = new Date();
    let mediumOffset = 1;
    const dayOffset = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return localDateStr(d);
    };

    // Ramazan tasks created before Ramazan starts get the start date as dueDate
    const ramazanStartDate = mode.type === 'ramazan' && !isRamazanActive
      ? (ramazanStatus.period?.start ?? undefined)
      : undefined;

    const getTaskDueDate = (task: ModeTask): string | undefined => {
      if (ramazanStartDate) return ramazanStartDate;
      // weight_entry zinciri WeightEntryModal/saveWeightEntry tarafından sürdürülür — ilk görevi +7'ye sabitle
      if (task.tags?.includes('weight_entry')) return dayOffset(7);
      // Template'in belirlediği gün offseti varsa onu kullan (bugün/yarınki setup görevleri)
      if (task.daysFromNow !== undefined) return dayOffset(task.daysFromNow);
      // Fallback: priority bazlı sıralama
      if (task.priority === 'High') return dayOffset(0);
      if (task.priority === 'Medium') return dayOffset(mediumOffset++);
      return dayOffset(4); // Low
    };

    // newTasks zaten gelecek-tarihli dökümü hariç tutuyor (bkz. tanımı) — doğrudan oluştur.
    const addedTaskIds: number[] = [];
    const visibleTagsMap: Record<string, string> = {
      exam: 'education',
      tez: 'education',
      mulakat: 'work',
      spor: 'fitness',
      ramazan: 'ramazan',
    };
    const extraVisibleTag = visibleTagsMap[mode.type];

    for (const task of newTasks) {
      const title = tr ? task.titleTr : task.titleEn;
      const dueDate = getTaskDueDate(task);
      const description = JSON.stringify({ tr: task.titleTr, en: task.titleEn });
      
      const finalTags = [mode.type, ...(task.tags ?? [])];
      if (extraVisibleTag && !finalTags.includes(extraVisibleTag)) {
        finalTags.push(extraVisibleTag);
      }

      try {
        const created = await TaskService.createTask({
          title, description, priority: task.priority,
          isCompleted: false, tags: finalTags, subtasks: [],
          ...(dueDate && { dueDate }),
        } as any);
        addTask({ ...created, title, titleTr: task.titleTr, titleEn: task.titleEn } as any);
        addedTaskIds.push(created.id);
      } catch {
        const localId = Math.floor(Date.now() + Math.random() * 1000);
        addTask({
          id: localId, title, description, priority: task.priority,
          isCompleted: false, tags: finalTags, subtasks: [],
          ...(dueDate && { dueDate }),
          titleTr: task.titleTr, titleEn: task.titleEn,
        } as any);
        addedTaskIds.push(localId);
      }
    }

    onApplied?.(addedHabitIds, addedTaskIds, {
      templateId: selectedTemplate?.id,
      dailyMinutes: selectedTemplate?.dailyGoalMinutes,
    });
    setApplying(false);
    appliedRef.current = true;
    setApplied(true);
  };

  const modeAccent =
    mode.type === 'ramazan' ? (isDark ? '#A5B4FC' : '#6366F1')
    : mode.type === 'yks' ? (isDark ? '#93C5FD' : '#3B82F6')
    : mode.type === 'exam' ? (isDark ? '#93C5FD' : '#3B82F6')
    : mode.type === 'tez' ? (isDark ? '#C4B5FD' : '#8B5CF6')
    : mode.type === 'mulakat' ? (isDark ? '#6EE7B7' : '#10B981')
    : mode.type === 'spor' ? (isDark ? '#FCA5A1' : '#F97316')
    : (isDark ? '#F9A8D4' : '#EC4899');

  const renderAlgorithmInfo = () => {
    const desc = ALGORITHM_DESCRIPTIONS[mode.type as keyof typeof ALGORITHM_DESCRIPTIONS];
    if (!desc) return null;

    return (
      <View style={{
        backgroundColor: isDark ? modeAccent + '0C' : modeAccent + '06',
        borderColor: isDark ? modeAccent + '25' : modeAccent + '15',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 6,
        marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Zap size={12} color={modeAccent} fill={modeAccent} strokeWidth={0} />
          <Text style={{ fontSize: 9.5, fontWeight: '800', color: modeAccent, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {tr ? 'Akıllı Sistem Mantığı' : 'Smart Engine Logic'}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, lineHeight: 15.5, fontWeight: '500', opacity: 0.9 }}>
          {tr ? desc.tr : desc.en}
        </Text>
      </View>
    );
  };

  const selectTemplate = (tpl: StudyTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTemplate(tpl);
    setDeselectedHabits(new Set());
    setApplied(false);
    appliedRef.current = false;
    setStep('review');
  };

  // ── Custom Plan Step ──
  const renderCustomStep = () => {
    // Yalnız DOLU öğeleri say (boş satırlar "3 öğe" gibi yanıltmasın).
    const totalItems = customHabits.filter(h => h.nameTr.trim()).length + customTasks.filter(t => t.titleTr.trim()).length;
    const canProceed = customHabits.some(h => h.nameTr.trim()) || customTasks.some(t => t.titleTr.trim());

    const cycleEmoji = (idx: number) => {
      setCustomHabits(prev => {
        const next = [...prev];
        const cur = QUICK_EMOJIS.indexOf(next[idx].emoji);
        next[idx] = { ...next[idx], emoji: QUICK_EMOJIS[(cur + 1) % QUICK_EMOJIS.length] };
        return next;
      });
    };

    const cycleColor = (idx: number) => {
      setCustomHabits(prev => {
        const next = [...prev];
        const cur = QUICK_COLORS.indexOf(next[idx].color);
        next[idx] = { ...next[idx], color: QUICK_COLORS[(cur + 1) % QUICK_COLORS.length] };
        return next;
      });
    };

    const suggest = () => {
      const toast = useToastStore.getState().show;
      if (!customAiText.trim()) {
        toast(tr ? 'Önce planını birkaç cümleyle yaz' : 'Describe your plan first', 'info');
        return;
      }
      const { habits: hs, tasks: ts } = extractPlanFromText(customAiText, tr);
      if (hs.length) setCustomHabits(prev => [...prev, ...hs].slice(0, 5));
      if (ts.length) setCustomTasks(prev => [...prev, ...ts].slice(0, 7));
      if (hs.length + ts.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Net geri bildirim: kaç öğe eklendi → "çalışıyor mu" belirsizliği biter.
        toast(tr ? `${hs.length} alışkanlık · ${ts.length} görev eklendi` : `${hs.length} habits · ${ts.length} tasks added`, 'success');
      } else {
        toast(tr ? 'Bundan öneri çıkaramadık — aşağıdan elle ekleyebilirsin' : "Couldn't extract — add manually below", 'info');
      }
    };

    const proceed = () => {
      const tpl: StudyTemplate = {
        id: `custom_${Date.now()}`,
        titleTr: 'Kişisel Planım',
        titleEn: 'My Custom Plan',
        descTr: 'Kendi oluşturduğum plan',
        descEn: 'My own plan',
        targetTr: '', targetEn: '',
        emoji: '✨',
        dailyGoalMinutes: customGoal,
        habits: customHabits
          .filter(h => h.nameTr.trim())
          .map(h => ({ name: h.name || h.nameTr, nameTr: h.nameTr, emoji: h.emoji, color: h.color })),
        tasks: customTasks
          .filter(t => t.titleTr.trim())
          .map(t => ({ titleTr: t.titleTr, titleEn: t.titleEn || t.titleTr, priority: t.priority })),
      };
      selectTemplate(tpl);
    };

    return (
      <>
        <View style={styles.sheetHeader}>
          <Touchable
            onPress={() => { Haptics.selectionAsync(); setStep('template'); }}
            style={{ marginRight: S.sm, padding: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={theme.onSurfaceVariant} />
          </Touchable>
          {renderModeEmojiIcon('✨', 26, modeAccent)}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
              {tr ? 'Kendi Planını Oluştur' : 'Build Your Own Plan'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Alışkanlık ve görevleri kendin belirle' : 'Set your own habits & tasks'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {/* AI text suggest */}
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, marginBottom: S.xs }}>
              {tr ? '✦ Planını birkaç cümleyle anlat, önerelim' : '✦ Describe your plan, we\'ll suggest habits & tasks'}
            </Text>
            <TextInput
              value={customAiText}
              onChangeText={setCustomAiText}
              multiline
              numberOfLines={3}
              placeholder={tr ? 'Örn: Sabah koşusu, kilo vermek, daha sağlıklı beslenmek...' : 'E.g. Morning run, lose weight, eat healthier...'}
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
              style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '500', minHeight: 54, lineHeight: 20, textAlignVertical: 'top' }}
            />
            <Touchable
              onPress={suggest}
              style={{ alignSelf: 'flex-end', backgroundColor: modeAccent, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs + 1, marginTop: S.xs }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: F.caption, fontWeight: '500' }}>{tr ? 'Öner' : 'Suggest'}</Text>
            </Touchable>
          </View>

          {/* Habits */}
          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginBottom: S.sm }]}>
            {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
          </Text>
          {customHabits.map((h, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs + 1 }}>
              <Touchable
                onPress={() => cycleEmoji(idx)}
                style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: h.color + '20', borderWidth: B.thin, borderColor: h.color + '40' }}
                activeOpacity={0.7}
              >
                {renderModeEmojiIcon(h.emoji, 16, h.color)}
              </Touchable>
              <TextInput
                value={h.nameTr}
                onChangeText={v => setCustomHabits(prev => { const n = [...prev]; n[idx] = { ...n[idx], nameTr: v, name: v }; return n; })}
                placeholder={tr ? 'Alışkanlık adı...' : 'Habit name...'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                returnKeyType="next"
                underlineColorAndroid="transparent"
              />
              <Touchable onPress={() => cycleColor(idx)} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: h.color, borderWidth: B.medium, borderColor: isDark ? 'rgba(255,255,255,0.4)' : '#fff' }} activeOpacity={0.7} />
              <Touchable onPress={() => setCustomHabits(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }} activeOpacity={0.7}>
                <X size={14} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>
          ))}
          {customHabits.length < 5 && (
            <Touchable
              onPress={() => setCustomHabits(prev => [...prev, { name: '', nameTr: '', emoji: QUICK_EMOJIS[prev.length % QUICK_EMOJIS.length], color: QUICK_COLORS[prev.length % QUICK_COLORS.length] }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: modeAccent }}>{tr ? 'Alışkanlık Ekle' : 'Add Habit'}</Text>
            </Touchable>
          )}

          {/* Tasks */}
          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: S.md, marginBottom: S.sm }]}>
            {tr ? 'GÖREVLER' : 'TASKS'}
          </Text>
          {customTasks.map((t, idx) => (
            <View key={idx} style={{ marginBottom: S.sm, gap: S.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <TextInput
                  value={t.titleTr}
                  onChangeText={v => setCustomTasks(prev => { const n = [...prev]; n[idx] = { ...n[idx], titleTr: v, titleEn: v }; return n; })}
                  placeholder={tr ? 'Görev başlığı...' : 'Task title...'}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
                  style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                  returnKeyType="next"
                  underlineColorAndroid="transparent"
                />
                <Touchable onPress={() => setCustomTasks(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }} activeOpacity={0.7}>
                  <X size={14} color={theme.onSurfaceVariant} />
                </Touchable>
              </View>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {(['High', 'Medium', 'Low'] as const).map(p => {
                  const pColor = p === 'High' ? '#EF4444' : p === 'Medium' ? '#F59E0B' : (theme.onSurfaceVariant as string);
                  const pLabel = tr ? (p === 'High' ? 'Yüksek' : p === 'Medium' ? 'Orta' : 'Düşük') : p;
                  return (
                    <Touchable
                      key={p}
                      onPress={() => { Haptics.selectionAsync(); setCustomTasks(prev => { const n = [...prev]; n[idx] = { ...n[idx], priority: p }; return n; }); }}
                      style={{ paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.sm, backgroundColor: t.priority === p ? pColor + '20' : 'transparent', borderWidth: B.thin, borderColor: t.priority === p ? pColor + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '500', color: t.priority === p ? pColor : theme.onSurfaceVariant }}>{pLabel}</Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>
          ))}
          {customTasks.length < 7 && (
            <Touchable
              onPress={() => setCustomTasks(prev => [...prev, { titleTr: '', titleEn: '', priority: 'Medium' }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: modeAccent }}>{tr ? 'Görev Ekle' : 'Add Task'}</Text>
            </Touchable>
          )}

          {/* Daily goal picker */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, flex: 1 }}>
              {tr ? 'Günlük odak' : 'Daily focus'}
            </Text>
            {[30, 45, 60, 90, 120].map(m => (
              <Touchable
                key={m}
                onPress={() => setCustomGoal(m)}
                style={{ paddingHorizontal: S.xs + 2, paddingVertical: 3, borderRadius: R.sm, backgroundColor: customGoal === m ? modeAccent + '20' : 'transparent', borderWidth: B.thin, borderColor: customGoal === m ? modeAccent + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 10, fontWeight: '500', color: customGoal === m ? modeAccent : theme.onSurfaceVariant }}>{m}dk</Text>
              </Touchable>
            ))}
          </View>
        </ScrollView>

        <Touchable
          onPress={canProceed ? proceed : undefined}
          activeOpacity={canProceed ? 0.85 : 1}
          style={[styles.applyBtn, { backgroundColor: canProceed ? modeAccent : theme.surfaceContainerHigh, opacity: canProceed ? 1 : 0.5, marginTop: S.lg }]}
        >
          <Zap size={15} color={canProceed ? '#fff' : (theme.onSurfaceVariant as string)} strokeWidth={2.5} />
          <Text style={[styles.applyBtnText, { color: canProceed ? '#fff' : theme.onSurfaceVariant }]}>
            {tr ? `Devam Et${totalItems > 0 ? ` (${totalItems} öğe)` : ''}` : `Continue${totalItems > 0 ? ` (${totalItems} items)` : ''}`}
          </Text>
        </Touchable>
      </>
    );
  };

  // ── Plan View (when plan already applied) ──
  const renderPlanView = () => (
    <>
      <View style={styles.sheetHeader}>
        {renderModeEmojiIcon(mode.emoji, 36, modeAccent)}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
            {tr ? mode.labelTr : mode.labelEn}
          </Text>
          <Text style={[styles.sheetSub, { color: modeAccent }]}>
            {mode.daysLeft > 0
              ? (mode.type === 'ramazan' && !isRamazanActive
                ? (tr ? `${mode.daysLeft} gün sonra başlıyor` : `Starts in ${mode.daysLeft} days`)
                : (tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`))
              : (tr ? 'Süre doldu' : 'Time\'s up')}
          </Text>
        </View>
      </View>

      {/* Progress summary row */}
      <View style={[styles.progressRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <View style={styles.progressStat}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.progressNum, { color: modeAccent }]}>{avgHabitWeekPct}%</Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'haftalık alışkanlık' : 'weekly habits'}
          </Text>
        </View>
        <View style={[styles.progressDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
        <View style={styles.progressStat}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.progressNum, { color: modeAccent }]}>{completedPlanTasks}/{totalPlanTasks}</Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'görev tamamlandı' : 'tasks done'}
          </Text>
        </View>
        <View style={[styles.progressDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
        <View style={styles.progressStat}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.progressNum, { color: modeAccent }]}>
            {(() => {
              const best = planHabitStats.length > 0 ? Math.max(...planHabitStats.map(h => h.streak)) : 0;
              return best > 0 ? `${best}🔥` : '0';
            })()}
          </Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'en uzun seri' : 'best streak'}
          </Text>
        </View>
      </View>

      <ScrollView style={{ maxHeight: screenHeight * 0.45 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {renderAlgorithmInfo()}

        {/* Adjust Timeline / Date / Intensity Editor */}
        {activeSlot && activeSlot !== 'birakma' && (
          isEditingTimeline ? (
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderColor: modeAccent + '30',
                borderWidth: 1.5,
                borderRadius: R.md,
                padding: S.md,
                marginBottom: S.md,
                gap: S.sm
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: theme.onSurface }}>
                {tr ? 'Zaman Çizelgesini Düzenle' : 'Edit Timeline'}
              </Text>

              {/* Target Date Input (if not ramadan or quit mode) */}
              {activeSlot !== 'birakma' && activeSlot !== 'ramazan' && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.onSurfaceVariant }}>
                    {tr ? 'Hedef Tarih (YYYY-AA-GG)' : 'Target Date (YYYY-MM-DD)'}
                  </Text>
                  <TextInput
                    value={editedDate}
                    onChangeText={setEditedDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.onSurfaceVariant + '80'}
                    style={{
                      backgroundColor: isDark ? '#2C2C2E' : '#F0F0F2',
                      color: theme.onSurface,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                      fontWeight: '600'
                    }}
                  />
                </View>
              )}

              {/* Daily Minutes Input (if has minutes) */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.onSurfaceVariant }}>
                  {tr ? 'Günlük Çalışma Süresi' : 'Daily Study Duration'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Touchable
                    onPress={() => setEditedMinutes((prev: number) => Math.max(15, prev - 15))}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#2C2C2E' : '#E0E0E4', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: theme.onSurface, fontSize: 18, fontWeight: 'bold' }}>-</Text>
                  </Touchable>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onSurface, minWidth: 60, textAlign: 'center' }}>
                    {editedMinutes} {tr ? 'dk' : 'min'}
                  </Text>
                  <Touchable
                    onPress={() => setEditedMinutes((prev: number) => Math.min(480, prev + 15))}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#2C2C2E' : '#E0E0E4', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: theme.onSurface, fontSize: 18, fontWeight: 'bold' }}>+</Text>
                  </Touchable>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs }}>
                <Touchable
                  onPress={handleSaveTimeline}
                  style={{ flex: 1, backgroundColor: modeAccent, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                    {tr ? 'Kaydet' : 'Save'}
                  </Text>
                </Touchable>
                <Touchable
                  onPress={() => setIsEditingTimeline(false)}
                  style={{ flex: 1, backgroundColor: isDark ? '#2C2C2E' : '#E0E0E4', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '800' }}>
                    {tr ? 'İptal' : 'Cancel'}
                  </Text>
                </Touchable>
              </View>
            </MotiView>
          ) : (
            <Touchable
              onPress={() => setIsEditingTimeline(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: modeAccent + '12',
                borderColor: modeAccent + '28',
                borderWidth: 1,
                borderRadius: R.md,
                paddingVertical: 10,
                marginBottom: S.md,
                gap: 6
              }}
            >
              <RefreshCw size={14} color={modeAccent} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: modeAccent }}>
                {tr ? 'Zaman Çizelgesini Ayarla' : 'Adjust Timeline'}
              </Text>
            </Touchable>
          )
        )}

        {/* İçgörü & Değerlendirme (AI Insight & Evaluation) Card */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderWidth: B.thin,
          borderRadius: R.md,
          padding: S.md,
          marginBottom: S.md,
          gap: S.xs
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: 2 }}>
            <TrendingUp size={14} color={modeAccent} />
            <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: 11, letterSpacing: 0.5 }}>
              {tr ? 'İÇGÖRÜ & DEĞERLENDİRME' : 'INSIGHT & EVALUATION'}
            </Text>
          </View>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, lineHeight: 17, opacity: 0.9 }}>
            {insightText}
          </Text>
        </View>

        {/* Kendini Değerlendir Rating Widget */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderWidth: B.thin,
          borderRadius: R.md,
          padding: S.md,
          marginBottom: S.md,
          gap: S.sm,
          alignItems: 'center'
        }}>
          <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
            {tr ? 'Bugün performansını nasıl değerlendiriyorsun?' : 'How do you rate your performance today?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.xs }}>
            {[
              { score: 1, emoji: '😫', labelTr: 'Çok Kötü', labelEn: 'Terrible' },
              { score: 2, emoji: '😕', labelTr: 'Kötü', labelEn: 'Bad' },
              { score: 3, emoji: '😐', labelTr: 'Orta', labelEn: 'Okay' },
              { score: 4, emoji: '🙂', labelTr: 'İyi', labelEn: 'Good' },
              { score: 5, emoji: '😎', labelTr: 'Harika', labelEn: 'Excellent' }
            ].map(item => {
              const selected = rating === item.score;
              return (
                <Touchable
                  key={item.score}
                  onPress={() => saveRating(item.score)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: R.full,
                    backgroundColor: selected ? modeAccent + '22' : 'transparent',
                    borderWidth: selected ? B.medium : B.thin,
                    borderColor: selected ? modeAccent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 20, opacity: selected ? 1 : 0.65 }}>{item.emoji}</Text>
                </Touchable>
              );
            })}
          </View>
          {rating ? (
            <Text style={{ color: modeAccent, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              {(() => {
                const item = [
                  { score: 1, emoji: '😫', labelTr: 'Çok Kötü', labelEn: 'Terrible' },
                  { score: 2, emoji: '😕', labelTr: 'Kötü', labelEn: 'Bad' },
                  { score: 3, emoji: '😐', labelTr: 'Orta', labelEn: 'Okay' },
                  { score: 4, emoji: '🙂', labelTr: 'İyi', labelEn: 'Good' },
                  { score: 5, emoji: '😎', labelTr: 'Harika', labelEn: 'Excellent' }
                ].find(i => i.score === rating);
                return tr ? `Değerlendirmen: ${item?.labelTr}` : `Your rating: ${item?.labelEn}`;
              })()}
            </Text>
          ) : null}
        </View>

        {/* Habits */}
        {planHabitStats.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
              {tr ? 'ALIŞKANLIKLARINIZ' : 'YOUR HABITS'}
            </Text>
            {planHabitStats.map(h => (
              <View key={h.id} style={[styles.planViewRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={[styles.habitIconSm, { backgroundColor: (h.color ?? modeAccent) + '22' }]}>
                  {renderModeEmojiIcon(h.emoji ?? '📌', 16, h.color ?? modeAccent)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planViewName, { color: theme.onSurface }]} numberOfLines={1}>{h.name}</Text>
                  <View style={styles.habitMeta}>
                    {/* 7-day dots */}
                    <View style={styles.weekDots}>
                      {last7Keys.slice().reverse().map((k, i) => {
                        const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
                        const done = dates.includes(k);
                        return (
                          <View key={i} style={[styles.dot, { backgroundColor: done ? (h.color ?? modeAccent) : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') }]} />
                        );
                      })}
                    </View>
                    <Text style={[styles.streakText, { color: h.streak > 0 ? '#FF6B35' : theme.onSurfaceVariant }]}>
                      {h.streak > 0 ? `🔥 ${h.streak}` : (tr ? 'seri yok' : 'no streak')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.doneBadge, { backgroundColor: h.doneToday ? (h.color ?? modeAccent) + '22' : 'transparent', borderColor: h.doneToday ? (h.color ?? modeAccent) + '60' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') }]}>
                  {h.doneToday
                    ? <Check size={13} color={h.color ?? modeAccent} strokeWidth={3} />
                    : <Circle size={13} color={theme.onSurfaceVariant} strokeWidth={1.5} />}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Tasks */}
        {planTaskStats.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: planHabitStats.length > 0 ? S.md : 0 }]}>
              {tr ? 'GÖREVLERİNİZ' : 'YOUR TASKS'}
            </Text>
            {planTaskStats.map(t => (
              <View key={t.id} style={[styles.planViewRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', opacity: t.done ? 0.55 : 1 }]}>
                {t.done
                  ? <CheckCircle2 size={18} color={theme.tertiary} strokeWidth={2} />
                  : <Circle size={18} color={theme.onSurfaceVariant} strokeWidth={1.5} />}
                <Text style={[styles.planViewName, { color: theme.onSurface, flex: 1, textDecorationLine: t.done ? 'line-through' : 'none' }]} numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={[styles.priorityChip, { backgroundColor:
                  t.priority === 'High' ? '#EF444420' : t.priority === 'Medium' ? '#F59E0B20' : '#10B98120'
                }]}>
                  <Text style={[styles.priorityChipText, { color:
                    t.priority === 'High' ? '#EF4444' : t.priority === 'Medium' ? '#F59E0B' : '#10B981'
                  }]}>{t.priority}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {planHabits.length === 0 && planTasks.length === 0 && (
          <View style={styles.emptyPlan}>
            <Text style={[styles.emptyPlanText, { color: theme.onSurfaceVariant }]}>
              {tr
                ? 'Plan öğeleri bulunamadı. Silinmiş olabilirler.'
                : 'Plan items not found. They may have been deleted.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.planViewActions}>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          {onClearPlan && (
            <Touchable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClearPlan(); setSheetVisible(false); }}
              activeOpacity={0.8}
              style={[styles.clearBtn, { flex: 1, borderColor: theme.error + '40' }]}
            >
              <Trash2 size={13} color={theme.error} strokeWidth={2} />
              <Text style={[styles.clearBtnText, { color: theme.error }]}>
                {tr ? 'Planı Kaldır' : 'Remove Plan'}
              </Text>
            </Touchable>
          )}
          <Touchable
            onPress={() => setSheetVisible(false)}
            activeOpacity={0.8}
            style={[styles.clearBtn, { flex: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }]}
          >
            <Text style={[styles.clearBtnText, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Kapat' : 'Close'}
            </Text>
          </Touchable>
        </View>
      </View>
    </>
  );

  return (
    <>
      {/* Banner — hidden when opened programmatically */}
      {mode.daysLeft > 0 && !showSheetImmediately && (
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={[
            styles.banner,
            { backgroundColor: isDark ? modeAccent + '22' : modeAccent + '12', borderColor: modeAccent + '40' },
          ]}
        >
          <View style={styles.bannerLeft}>
            {renderModeEmojiIcon(mode.emoji, 22, modeAccent)}
            <View>
              <Text style={[styles.bannerTitle, { color: isDark ? '#fff' : '#111' }]}>
                {tr ? mode.labelTr : mode.labelEn}
              </Text>
              {planApplied ? (
                <Text style={[styles.bannerSub, { color: modeAccent }]}>
                  {tr
                    ? `${completedPlanTasks}/${totalPlanTasks} görev · ${avgHabitWeekPct}% alışkanlık`
                    : `${completedPlanTasks}/${totalPlanTasks} tasks · ${avgHabitWeekPct}% habits`}
                </Text>
              ) : (
                <Text style={[styles.bannerSub, { color: modeAccent }]}>
                  {mode.type === 'ramazan' && !isRamazanActive
                    ? (tr ? `${mode.daysLeft} gün sonra başlıyor` : `Starts in ${mode.daysLeft} days`)
                    : (tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.bannerRight}>
            <Touchable
              onPress={openSheet}
              style={[styles.planBtn, { backgroundColor: planApplied ? modeAccent : modeAccent }]}
              activeOpacity={0.8}
            >
              {planApplied && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', opacity: 0.85, marginRight: 2 }} />}
              <Text style={styles.planBtnText}>
                {planApplied ? (tr ? 'Planı Gör' : 'View Plan') : (tr ? 'Planı Seç' : 'Pick Plan')}
              </Text>
              <ChevronRight size={13} color="#fff" />
            </Touchable>
            <Touchable onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'} />
            </Touchable>
          </View>
        </MotiView>
      )}

      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={() => setSheetVisible(false)} onShow={() => slideIn()}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <Animated.View
            style={[
              animatedStyle,
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '30', maxHeight: screenHeight - insets.top - 16, paddingBottom: Math.max(insets.bottom, S.lg) + S.md },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragHandle}>
              <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>

            {/* Plan already applied (gerçek öğelerle) → show smart plan view */}
            {effectiveApplied && renderPlanView()}

            {/* Plan not applied → template selection or review to add */}
            {!effectiveApplied && step === 'template' && hasTemplates && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {tr ? 'Çalışma Planı Seç' : 'Choose a Study Plan'}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {tr ? 'Sana uygun seviyeyi seç, gerisini biz ayarlarız.' : 'Pick the level that fits you — we set the rest up.'}
                    </Text>
                  </View>
                </View>
                {/* Exam-specific tip pill */}
                {(tr ? mode.tipTr : mode.tipEn) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: modeAccent + '12', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm + 1, marginBottom: S.sm, borderWidth: B.thin, borderColor: modeAccent + '28' }}>
                    {renderModeEmojiIcon('💡', 13, modeAccent)}
                    <Text style={{ flex: 1, fontSize: F.caption, fontWeight: '500', color: modeAccent, lineHeight: 17, opacity: 0.95 }}>
                      {tr ? mode.tipTr : mode.tipEn}
                    </Text>
                  </View>
                ) : null}
                {renderAlgorithmInfo()}
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={[styles.expertNote, { color: theme.onSurfaceVariant }]}>
                    {tr ? '✦ Eğitim psikolojisi araştırmalarına dayalı metodlar' : '✦ Methods based on educational psychology research'}
                  </Text>
                  {mode.templates!.map((tpl) => {
                    const isRecommended = defaultTemplateId === tpl.id;
                    return (
                    <Touchable
                      key={tpl.id}
                      onPress={() => selectTemplate(tpl)}
                      style={[styles.templateCard, {
                        backgroundColor: isRecommended
                          ? (isDark ? modeAccent + '18' : modeAccent + '10')
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                        borderColor: isRecommended ? modeAccent + '70' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'),
                        borderWidth: isRecommended ? 1.5 : 1,
                      }]}
                      activeOpacity={0.75}
                    >
                      {/* Recommended ribbon */}
                      {isRecommended && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: S.sm, backgroundColor: modeAccent + '20', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4, alignSelf: 'flex-start' }}>
                          <Star size={11} color={modeAccent} fill={modeAccent} strokeWidth={0} />
                          <Text style={{ fontSize: 10, fontWeight: '600', color: modeAccent, letterSpacing: 0.5 }}>
                            {tr ? `${mode.labelTr.split(' ')[0]} İÇİN ÖNERİLEN` : `RECOMMENDED FOR ${mode.labelEn.split(' ')[0].toUpperCase()}`}
                          </Text>
                        </View>
                      )}
                      <View style={styles.templateTop}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            {renderModeEmojiIcon(tpl.emoji, 18, modeAccent)}
                            <Text style={[styles.templateTitle, { color: theme.onSurface, flex: 1 }]}>{tr ? tpl.titleTr : tpl.titleEn}</Text>
                          </View>
                          <Text style={[styles.templateDesc, { color: theme.onSurfaceVariant, opacity: 0.9 }]}>{tr ? tpl.descTr : tpl.descEn}</Text>
                        </View>
                        <ChevronRight size={16} color={isRecommended ? modeAccent : theme.onSurfaceVariant} opacity={isRecommended ? 0.8 : 0.4} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                        {tpl.habits.slice(0, 4).map((h) => (
                          <View key={h.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: h.color + '18', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}>
                            {renderModeEmojiIcon(h.emoji, 10, h.color)}
                            <Text style={{ fontSize: 10, fontWeight: '600', color: h.color, letterSpacing: 0.2 }}>{tr ? h.nameTr : h.name}</Text>
                          </View>
                        ))}
                        {tpl.tasks.length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: modeAccent + '12', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10 }}>✓</Text>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: modeAccent, letterSpacing: 0.2 }}>{tpl.tasks.length} {tr ? 'görev' : 'tasks'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.templateMeta}>
                        <View style={[styles.metaChip, { backgroundColor: modeAccent + '18' }]}>
                          <Text style={[styles.metaChipText, { color: modeAccent }]}>{tpl.dailyGoalMinutes} {tr ? 'dk/gün' : 'min/day'}</Text>
                        </View>
                        <Text style={[styles.templateTarget, { color: theme.onSurfaceVariant }]}>{tr ? tpl.targetTr : tpl.targetEn}</Text>
                      </View>
                    </Touchable>
                    );
                  })}
                  {/* Custom plan card */}
                  <Touchable
                    onPress={() => { Haptics.selectionAsync(); setStep('custom'); }}
                    style={[styles.templateCard, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      paddingVertical: S.lg,
                    }]}
                    activeOpacity={0.75}
                  >
                    <View style={{ marginBottom: S.xs }}>{renderModeEmojiIcon('✏️', 24, modeAccent)}</View>
                    <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurface }}>
                      {tr ? 'Kendi Planını Oluştur' : 'Build Your Own Plan'}
                    </Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, marginTop: 2, textAlign: 'center' }}>
                      {tr ? 'Alışkanlık ve görevleri kendin belirle' : 'Set your own habits and tasks'}
                    </Text>
                  </Touchable>
                </ScrollView>
              </>
            )}

            {!effectiveApplied && step === 'custom' && renderCustomStep()}

            {!effectiveApplied && step === 'review' && (
              <>
                <View style={styles.sheetHeader}>
                  {hasTemplates && (
                    <Touchable
                      onPress={() => { Haptics.selectionAsync(); setStep('template'); setSelectedTemplate(null); }}
                      style={{ marginRight: S.sm, padding: 4 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ArrowLeft size={20} color={theme.onSurfaceVariant} />
                    </Touchable>
                  )}
                  {renderModeEmojiIcon(selectedTemplate?.emoji ?? mode.emoji, 36, modeAccent)}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {selectedTemplate ? (tr ? selectedTemplate.titleTr : selectedTemplate.titleEn) : (tr ? mode.labelTr : mode.labelEn)}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {selectedTemplate ? `${selectedTemplate.dailyGoalMinutes} ${tr ? 'dk/gün hedef' : 'min/day goal'}` : (tr ? mode.subtitleTr : mode.subtitleEn)}
                    </Text>
                  </View>
                </View>
                {renderAlgorithmInfo()}
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>{tr ? 'EKLENECEK ALIŞKANLIKLAR' : 'HABITS TO ADD'}</Text>
                  {activeHabits.map((h) => {
                    const exists = existingHabitNames.has(h.name.toLowerCase());
                    const skipped = !exists && deselectedHabits.has(h.name);
                    return (
                      <Touchable
                        key={h.name}
                        onPress={() => {
                          if (exists) return;
                          Haptics.selectionAsync();
                          setDeselectedHabits(prev => {
                            const next = new Set(prev);
                            if (next.has(h.name)) next.delete(h.name);
                            else next.add(h.name);
                            return next;
                          });
                        }}
                        style={[styles.itemRow, { opacity: exists || skipped ? 0.4 : 1 }]}
                        activeOpacity={exists ? 1 : 0.7}
                      >
                        <View style={[styles.itemDot, { backgroundColor: (skipped ? '#94A3B8' : h.color) + '30', borderColor: (skipped ? '#94A3B8' : h.color) + '60' }]}>
                          {renderModeEmojiIcon(h.emoji, 15, skipped ? '#94A3B8' : h.color)}
                        </View>
                        <Text style={[styles.itemText, { color: theme.onSurface, flex: 1, textDecorationLine: skipped ? 'line-through' : 'none' }]}>{tr ? h.nameTr : h.name}</Text>
                        {exists
                          ? <Check size={15} color={theme.tertiary} strokeWidth={2.5} />
                          : skipped
                          ? <X size={15} color={theme.onSurfaceVariant} strokeWidth={2} />
                          : <Check size={15} color={h.color} strokeWidth={2.5} />}
                      </Touchable>
                    );
                  })}
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: S.md }]}>{tr ? 'EKLENECEK GÖREVLER' : 'TASKS TO ADD'}</Text>
                  {activeTasks.map((task) => {
                    const title = tr ? task.titleTr : task.titleEn;
                    const exists = existingTaskTitles.has(task.titleTr.toLowerCase()) || existingTaskTitles.has(task.titleEn.toLowerCase());
                    const pColor = task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : theme.onSurfaceVariant;
                    return (
                      <View key={title} style={[styles.itemRow, { opacity: exists ? 0.45 : 1 }]}>
                        <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                        <Text style={[styles.itemText, { color: theme.onSurface, flex: 1 }]}>{title}</Text>
                        {exists && <Check size={15} color={theme.tertiary} strokeWidth={2.5} />}
                      </View>
                    );
                  })}
                  {selectedTemplate && (
                    <View style={[styles.goalNote, { backgroundColor: modeAccent + '12', borderColor: modeAccent + '30' }]}>
                      <Text style={[styles.goalNoteText, { color: modeAccent }]}>
                        {tr ? `Günlük odak hedefin ${selectedTemplate.dailyGoalMinutes} dakikaya ayarlanacak` : `Daily focus goal will be set to ${selectedTemplate.dailyGoalMinutes} minutes`}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                <Touchable
                  onPress={applied ? () => setSheetVisible(false) : applyAll}
                  activeOpacity={0.85}
                  disabled={applying || allDone}
                  style={[styles.applyBtn, { backgroundColor: applied ? theme.tertiary : allDone ? theme.surfaceContainerHigh : modeAccent, opacity: applying ? 0.7 : 1 }]}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : applied ? (
                    <><Check size={16} color="#fff" strokeWidth={2.5} /><Text style={styles.applyBtnText}>{tr ? 'Uygulandı! — Kapat' : 'Applied! — Close'}</Text></>
                  ) : allDone ? (
                    <Text style={[styles.applyBtnText, { color: theme.onSurfaceVariant }]}>{tr ? 'Tümü zaten mevcut' : 'All already added'}</Text>
                  ) : (
                    <><Zap size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.applyBtnText}>{tr ? `Uygula  (${newHabits.length + newTasks.length} öğe)` : `Apply  (${newHabits.length + newTasks.length} items)`}</Text></>
                  )}
                </Touchable>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: R.lg, borderWidth: B.thin,
    paddingVertical: S.sm + 2, paddingHorizontal: S.md, marginBottom: S.md,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bannerEmoji: { fontSize: 22 },
  bannerTitle: { fontSize: F.body, fontWeight: '600' },
  bannerSub: { fontSize: F.caption, fontWeight: '500', marginTop: 1 },
  bannerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 1, borderRadius: R.full },
  planBtnText: { color: '#fff', fontSize: F.caption, fontWeight: '500' },
  dismissBtn: { padding: 2 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: B.thin, paddingHorizontal: S.lg },
  dragHandle: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  sheetEmoji: { fontSize: 36 },
  sheetTitle: { fontSize: F.title, fontWeight: '500' },
  sheetSub: { fontSize: F.caption, fontWeight: '500', marginTop: 2 },
  // Progress summary
  progressRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.md,
    borderWidth: B.thin, marginBottom: S.lg, paddingVertical: S.md,
  },
  progressStat: { flex: 1, alignItems: 'center', gap: 2 },
  progressNum: { fontSize: F.title, fontWeight: '600' },
  progressLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  progressDivider: { width: 1, height: 32 },
  // Plan view rows
  planViewRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderRadius: R.md, borderWidth: B.thin, padding: S.sm + 2, marginBottom: S.xs + 1,
  },
  planViewName: { fontSize: F.body, fontWeight: '500' },
  habitIconSm: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  habitMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 3 },
  weekDots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  streakText: { fontSize: 11, fontWeight: '600' },
  doneBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  priorityChip: { borderRadius: R.sm, paddingHorizontal: S.xs + 1, paddingVertical: 2 },
  priorityChipText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
  emptyPlan: { alignItems: 'center', paddingVertical: S.xl },
  emptyPlanText: { fontSize: F.body, textAlign: 'center', opacity: 0.6 },
  // Plan view actions
  planViewActions: { gap: S.sm, marginTop: S.lg },
  updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.md },
  updateBtnText: { color: '#fff', fontSize: F.body, fontWeight: '500' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin },
  clearBtnText: { fontSize: F.caption, fontWeight: '600' },
  // Templates
  templateCard: { borderRadius: R.md, borderWidth: B.thin, padding: S.md, marginBottom: S.sm, gap: S.sm },
  templateTop: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  templateEmoji: { fontSize: 26, lineHeight: 32 },
  templateTitle: { fontSize: F.body, fontWeight: '500', marginBottom: 2 },
  templateDesc: { fontSize: F.caption, fontWeight: '500', lineHeight: 17, opacity: 0.75 },
  templateMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  metaChip: { borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 },
  metaChipText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  templateTarget: { fontSize: 10, fontWeight: '500', opacity: 0.55, flex: 1 },
  // Review
  sectionLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2, marginBottom: S.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs + 1 },
  itemDot: { width: 34, height: 34, borderRadius: 10, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  priorityDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  itemText: { fontSize: F.body, fontWeight: '500' },
  goalNote: { borderRadius: R.md, borderWidth: B.thin, padding: S.md, marginTop: S.md },
  goalNoteText: { fontSize: F.caption, fontWeight: '600', lineHeight: 17 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.lg, borderRadius: R.full, paddingVertical: S.md, paddingHorizontal: S.lg },
  applyBtnText: { color: '#fff', fontSize: F.body, fontWeight: '500' },
  expertNote: { fontSize: 10, fontWeight: '500', opacity: 0.4, letterSpacing: 0.3, marginBottom: S.md, marginTop: S.xs },
});

