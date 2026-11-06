import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { CheckSquare, Repeat, X, Sparkles, Plus, Info, Mic } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import VoiceService from '@/shared/utils/voice';
import { AppIcon } from '@/shared/components/AppIcon';
import { Separator } from '@/shared/components/Separator';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { langOf, localeOf } from '@/shared/utils/lang';
import { haptic } from '@/shared/utils/haptics';
import { ICON, S, R, F, B, MIN_TOUCH, MAX_W } from '@/shared/constants/tokens';
import { capture, CAPTURE_LIMITS, type CaptureResult, type ModeSignal } from '@/features/tasks/nlp/capture';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { HABIT_LIMIT, roomLeft } from '@/features/habits/utils/habitLimit';
import type { HabitSchedule } from '@/features/habits/utils/habitSchedule';
import { toDrafts, toggleKind, applyCapture, type CaptureDraft } from '@/features/onboarding/utils/captureFlow';

/*
  "AKLINDAKİLERİ YAZ" (C2–C4, 2026-10-31; kalite geçişi 2026-11-01) — yeni hesabın ilk dakikası.

  Hoş geldinden sonra, turdan önce bir kez açılır (bkz. captureFlow.shouldOfferCapture). İki adım:
   1. YAZ — tek alan; dokununca alanı dolduran üç örnek; yazdıkça canlı çipler (ne anlaşıldığı
      anında görünür). "Atla" her zaman bir dokunuş.
   2. ŞUNLARI ANLADIM — her madde bir satır: başlık düzeltilir, çıkarılır, görev ↔ alışkanlık
      değişir (en olası yanlış anlama). Mod sinyali varsa tek satır öneri; zorlamaz.
  Ekleme tek yoldan (captureFlow.applyCapture): misafir ve çevrimdışında da çalışır.

  KALİTE GEÇİŞİ (kullanıcı: "ilk hâlinin üzerine kalite giydir"; gece göğü denemesi tarzımıza
  uymadı): yapı ve metin aynı, uygulamanın KENDİ dili giydirildi — alan kart yüzeyinde (odakta ana
  renk), örnekler çip dilinde, önizleme Ayarlar'daki gibi tek gruplu kart, mod önerisi uygulama
  simgesi + dolu düğme. Tek hareket anı: anlaşılan çip bir kez belirir (hareket azaltılmışsa yok).
*/

const COPY = {
  tr: {
    title: 'Aklında ne var?',
    body: 'Bugün, bu hafta, kafanı kurcalayan ne varsa yaz. Görev mi alışkanlık mı biz ayırırız; eklemeden önce görürsün.',
    placeholder: 'ör. yarın 15:00 dişçi, her sabah yürüyüş…',
    // ÖĞRETİR, şablon değildir: her gün geçerli kalıplar (sabit tarih yok) — bkz. CaptureSheet.test "örnekler her gün geçerli".
    examples: ['yarın 15:00 dişçi, her sabah 20 dk yürüyüş', 'sınavım 3 hafta sonra, her gün 2 saat matematik', 'faturayı öde, annemi ara, haftada 3 gün spor'],
    exampleA11y: (s: string) => `Örnek: ${s}`,
    skip: 'Atla', next: (n: number) => (n > 0 ? `Devam (${n})` : 'Devam'),
    reviewTitle: 'Şunları anladım',
    reviewBody: 'Yanlış anladığım bir şey varsa düzelt; görev ve alışkanlık arasında tek dokunuşla geçebilirsin.',
    task: 'Görev', habit: 'Alışkanlık',
    toggleA11y: (title: string, kind: string) => `${title}: ${kind}. Türünü değiştir`,
    remove: (title: string) => `${title} maddesini çıkar`,
    back: 'Geri', add: (n: number) => `Planıma ekle (${n})`,
    daily: 'her gün', weekly: (n: number) => `haftada ${n}`,
    days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    modeHint: {
      exam: 'Sınava hazırlanıyor gibisin', tez: 'Tez yazıyor gibisin', mulakat: 'Bir mülakat yaklaşıyor gibi',
      spor: 'Bir kilo hedefin var gibi', tasarruf: 'Birikim yapmak istiyor gibisin', birakma: 'Bir alışkanlığı bırakmak istiyor gibisin',
      ramazan: 'Ramazan’a hazırlanıyor gibisin',
    } as Record<ModeSignal['mode'], string>,
    modeName: { exam: 'Sınav', tez: 'Tez', mulakat: 'Mülakat', spor: 'Spor', tasarruf: 'Tasarruf', birakma: 'Bırakma', ramazan: 'Ramazan' } as Record<ModeSignal['mode'], string>,
    modeAsk: (name: string, date?: string) => `${name} modunu ${date ? `${date} tarihiyle ` : ''}açalım mı?`,
    modeOn: 'Açılacak', modeOff: 'Aç',
    voice: 'Sesle yaz', voiceStop: 'Dinlemeyi durdur',
    micTitle: 'Mikrofon izni gerekli', micBody: 'Sesle yazmak için ayarlardan mikrofon iznini aç.',
    voiceNaTitle: 'Sesle yazma kullanılamıyor', voiceNaBody: 'Bu cihazda ses tanıma desteklenmiyor; yazarak devam edebilirsin.',
    counter: (n: number, max: number) => `${n}/${max}`,
    dropped: (max: number, n: number) => `İlk ${max} madde alındı; kalan ${n} maddeyi sonra ekleyebilirsin.`,
    habitOverflow: (limit: number, n: number) => `Alışkanlık sınırı ${limit}: ${n} madde görev olarak eklenecek.`,
    locale: 'tr-TR',
  },
  en: {
    title: 'What’s on your mind?',
    body: 'Write whatever is on your plate today or this week. We sort tasks from habits; you see everything before it is added.',
    placeholder: 'e.g. dentist tomorrow at 3pm, walk every morning…',
    examples: ['dentist tomorrow at 3pm, walk 20 min every morning', 'exam in 3 weeks, study math every day', 'pay the bill, call mom, gym 3 times a week'],
    exampleA11y: (s: string) => `Example: ${s}`,
    skip: 'Skip', next: (n: number) => (n > 0 ? `Continue (${n})` : 'Continue'),
    reviewTitle: 'Here’s what I understood',
    reviewBody: 'Fix anything I got wrong; one tap switches between task and habit.',
    task: 'Task', habit: 'Habit',
    toggleA11y: (title: string, kind: string) => `${title}: ${kind}. Change type`,
    remove: (title: string) => `Remove ${title}`,
    back: 'Back', add: (n: number) => `Add to my plan (${n})`,
    daily: 'daily', weekly: (n: number) => `${n}× a week`,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    modeHint: {
      exam: 'Looks like you’re preparing for an exam', tez: 'Looks like you’re writing a thesis', mulakat: 'Looks like an interview is coming up',
      spor: 'Looks like you have a weight goal', tasarruf: 'Looks like you want to save', birakma: 'Looks like you want to quit a habit',
      ramazan: 'Looks like you’re preparing for Ramadan',
    } as Record<ModeSignal['mode'], string>,
    modeName: { exam: 'Exam', tez: 'Thesis', mulakat: 'Interview', spor: 'Fitness', tasarruf: 'Savings', birakma: 'Quit', ramazan: 'Ramadan' } as Record<ModeSignal['mode'], string>,
    modeAsk: (name: string, date?: string) => `Turn on ${name} mode${date ? ` for ${date}` : ''}?`,
    modeOn: 'Will turn on', modeOff: 'Turn on',
    voice: 'Voice input', voiceStop: 'Stop listening',
    micTitle: 'Microphone permission needed', micBody: 'Turn on microphone access in settings to write by voice.',
    voiceNaTitle: 'Voice input unavailable', voiceNaBody: 'Speech recognition isn’t supported on this device; you can keep typing.',
    counter: (n: number, max: number) => `${n}/${max}`,
    dropped: (max: number, n: number) => `The first ${max} items were taken; add the other ${n} later.`,
    habitOverflow: (limit: number, n: number) => `Habit limit is ${limit}: ${n} ${n === 1 ? 'item' : 'items'} will be added as tasks.`,
    locale: 'en-US',
  },
};

const scheduleText = (s: HabitSchedule | undefined, c: typeof COPY.tr) =>
  !s || s.kind === 'daily' ? c.daily : s.kind === 'weekly' ? c.weekly(s.times) : s.days.map(d => c.days[d]).join(', ');

/** Sınır notu: sakin bilgi satırı (uyarı rengi yok) — sınır SESSİZ uygulanmaz. */
function Note({ text, theme }: { text: string; theme: ReturnType<typeof useAppTheme>['theme'] }) {
  return (
    <View accessibilityRole="text" style={[styles.note, { backgroundColor: theme.surfaceField }]}>
      <Info size={ICON.xs} color={theme.onSurfaceVariant} />
      <Text style={[styles.noteText, { color: theme.onSurfaceVariant }]}>{text}</Text>
    </View>
  );
}

/**
 * `demo`: geliştirici galerisi için — ekleme ve atlama HİÇBİR ŞEY kaydetmez (görev, alışkanlık, mod,
 * ölçüm). Yalnız ne ekleneceğinin sayısı bildirilir. Gerçek akış her zaman demo'suz.
 */
export function CaptureSheet({ visible, onDone, demo = false }: { visible: boolean; onDone: (added: { tasks: number; habits: number }) => void; demo?: boolean }) {
  const { theme, isDark } = useAppTheme();
  const reduce = useReduceMotion();
  const language = useLanguageStore(st => st.language);
  const lang = langOf(language);
  const c = COPY[lang];
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'write' | 'review'>('write');
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<CaptureResult>(() => capture('', lang));
  const [drafts, setDrafts] = useState<CaptureDraft[]>([]);
  const [acceptMode, setAcceptMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState(0);
  const [listening, setListening] = useState(false);
  const habitRoom = roomLeft(useHabitStore(st => st.habits));

  // Her açılış temiz başlar (galeride tekrar açılabilir).
  useEffect(() => {
    if (!visible) return;
    setStep('write'); setText(''); setDrafts([]); setAcceptMode(false);
  }, [visible]);

  /*
    SESLE YAZ — görev formuyla AYNI servis ve sözleşme (bkz. TaskFormModal.toggleVoice). Söylenen alana
    yazılır (alan sınırında kesilir); ekran kapanınca, önizlemeye geçince ya da kullanıcı yazınca durur.
  */
  const stopVoice = () => { if (listening) { VoiceService.stop().catch(() => {}); setListening(false); } };
  useEffect(() => {
    if (!visible || step !== 'write') stopVoice();
  }, [visible, step]);
  useEffect(() => () => { VoiceService.stop().catch(() => {}); }, []);
  const toggleVoice = async () => {
    if (listening) { await VoiceService.stop(); setListening(false); return; }
    haptic.commit();
    setListening(true);
    await VoiceService.start({
      language: localeOf(language),
      initialText: text,
      onResults: (results: string[]) => { if (results.length > 0) setText(results[0].slice(0, CAPTURE_LIMITS.inputChars)); },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setListening(false);
        if (msg === 'permission-denied') Alert.alert(c.micTitle, c.micBody);
        else if (msg === 'not-available') Alert.alert(c.voiceNaTitle, c.voiceNaBody);
      },
      onEnded: () => setListening(false),
    });
  };

  // Canlı çipler: yazı durunca ayrıştırılır (her tuşta değil) — uzun metinde arayüz donmaz.
  useEffect(() => {
    const t = setTimeout(() => setResult(capture(text, lang)), 250);
    return () => clearTimeout(t);
  }, [text, lang]);

  const mode = result.modes[0];
  const modeDate = useMemo(() => {
    if (!mode?.date) return undefined;
    const d = new Date(`${mode.date}T12:00:00`);
    return d.toLocaleDateString(c.locale, { day: 'numeric', month: 'long' });
  }, [mode?.date, c.locale]);

  const goReview = () => {
    const now = capture(text, lang); // gecikmeyi bekleme: son yazılanla
    setResult(now);
    setDrafts(toDrafts(now));
    setDropped(now.dropped);
    setAcceptMode(false);
    haptic.select();
    setStep('review');
  };

  const finish = async (skipped: boolean) => {
    if (busy) return;
    if (demo) {
      const kept = skipped ? [] : drafts.filter(d => d.title.trim());
      onDone({ tasks: kept.filter(d => d.kind === 'task').length, habits: kept.filter(d => d.kind === 'habit').length });
      return;
    }
    setBusy(true);
    try {
      const added = await applyCapture({ drafts: skipped ? [] : drafts, lang, mode, acceptMode, skipped });
      if (!skipped) haptic.success();
      onDone(added);
    } finally {
      setBusy(false);
    }
  };

  const update = (id: string, patch: Partial<CaptureDraft>) => setDrafts(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const count = drafts.filter(d => d.title.trim()).length;
  // Alışkanlık yeri dolu: sığmayanlar görev olarak eklenir (applyCapture) — önceden söylenir.
  const habitOverflow = Math.max(0, drafts.filter(d => d.kind === 'habit' && d.title.trim()).length - habitRoom);
  const live = result.items.length;
  // Yaz adımında düğme yazı varsa açık: canlı sayım 250 ms geride kalabilir, Devam son yazılanla yeniden ayrıştırır.
  const blocked = busy || (step === 'review' ? count === 0 : text.trim() === '');
  const toneOf = (kind: 'task' | 'habit') => (kind === 'habit' ? theme.tertiary : theme.primary);
  const KindIcon = (kind: 'task' | 'habit') => (kind === 'habit' ? Repeat : CheckSquare);

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} animationType="slide" onRequestClose={() => (step === 'review' ? setStep('write') : finish(true))}>
      <KeyboardAvoidingView behavior="padding" style={[styles.page, { paddingTop: insets.top + S.lg }]}>
        {/* Uygulamanın tek modal zemini (cam yüzey) — tam sayfada köşesiz. */}
        <GlassSurface radius={0} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {step === 'write' ? (
            <>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
              <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{c.body}</Text>
              <View>
              <TextInput
                value={text}
                onChangeText={(v) => { stopVoice(); setText(v); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={c.placeholder}
                placeholderTextColor={theme.onSurfaceMuted}
                selectionColor={theme.primary}
                multiline
                accessibilityLabel={c.title}
                maxLength={CAPTURE_LIMITS.inputChars}
                style={[styles.input, {
                  color: theme.onSurface,
                  backgroundColor: theme.surfaceCard,
                  borderColor: focused || listening ? theme.primary : theme.outlineVariant,
                }]}
              />
              <Touchable onPress={toggleVoice} accessibilityRole="button" accessibilityLabel={listening ? c.voiceStop : c.voice}
                accessibilityState={{ selected: listening }} style={[styles.mic, { backgroundColor: listening ? theme.primaryFill : theme.surfaceField }]}>
                <Mic size={ICON.md} color={listening ? theme.onPrimaryFill : theme.onSurfaceVariant} />
              </Touchable>
              </View>
              {/* Sayaç yalnız sınıra yaklaşınca (%80) — boşken ekranı kalabalıklaştırmaz. */}
              {text.length >= CAPTURE_LIMITS.inputChars * 0.8 && (
                <Text style={[styles.counter, { color: text.length >= CAPTURE_LIMITS.inputChars ? theme.error : theme.onSurfaceMuted }]}>
                  {c.counter(text.length, CAPTURE_LIMITS.inputChars)}
                </Text>
              )}
              {text.trim() === '' ? (
                <View style={styles.chips}>
                  {c.examples.map(ex => (
                    <Touchable key={ex} onPress={() => { haptic.select(); setText(ex); }} accessibilityRole="button" accessibilityLabel={c.exampleA11y(ex)}
                      style={[styles.example, { backgroundColor: theme.surfaceField }]}>
                      <Plus size={ICON.xs} color={theme.primary} strokeWidth={2.4} />
                      <Text style={[styles.exampleText, { color: theme.onSurface }]}>{ex}</Text>
                    </Touchable>
                  ))}
                </View>
              ) : (
                <View style={styles.chips} accessibilityLiveRegion="polite">
                  {result.items.map((it, i) => {
                    const Icon = KindIcon(it.kind);
                    const tone = toneOf(it.kind);
                    return (
                      <MotiView key={`${it.kind}-${it.title}-${i}`} from={reduce ? undefined : { opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 260 }} style={[styles.chip, { backgroundColor: tone + '14' }]}>
                        <Icon size={ICON.xs} color={tone} />
                        <Text numberOfLines={1} style={[styles.chipText, { color: theme.onSurface }]}>{it.title}</Text>
                      </MotiView>
                    );
                  })}
                  {mode && (
                    <MotiView key={`mode-${mode.mode}`} from={reduce ? undefined : { opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 260 }} style={[styles.chip, { backgroundColor: theme.tertiary + '1A' }]}>
                      <Sparkles size={ICON.xs} color={theme.tertiary} />
                      <Text style={[styles.chipText, { color: theme.onSurface }]}>{modeDate ? `${c.modeName[mode.mode]} · ${modeDate}` : c.modeName[mode.mode]}</Text>
                    </MotiView>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.reviewTitle}</Text>
              <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>{c.reviewBody}</Text>
              {drafts.length > 0 && (
                <View style={[styles.group, { backgroundColor: theme.surfaceCard, borderColor: isDark ? theme.outline : theme.outlineVariant }]}>
                  {drafts.map((d, i) => {
                    const kindLabel = d.kind === 'habit' ? c.habit : c.task;
                    const meta = d.kind === 'habit' ? scheduleText(d.schedule, c) : d.evidence.join(' · ');
                    const Icon = KindIcon(d.kind);
                    return (
                      <React.Fragment key={d.id}>
                        {i > 0 && <Separator theme={theme} />}
                        <View style={styles.row}>
                          <Icon size={ICON.sm} color={toneOf(d.kind)} style={{ marginTop: S.xxs }} />
                          <View style={{ flex: 1, gap: S.xxs }}>
                            <TextInput value={d.title} onChangeText={v => update(d.id, { title: v })} accessibilityLabel={kindLabel}
                              maxLength={d.kind === 'habit' ? CAPTURE_LIMITS.habitTitle : CAPTURE_LIMITS.taskTitle}
                              selectionColor={theme.primary} style={[styles.rowTitle, { color: theme.onSurface }]} />
                            <View style={styles.rowMeta}>
                              <Touchable onPress={() => { haptic.select(); setDrafts(ds => ds.map(x => (x.id === d.id ? toggleKind(x, lang) : x))); }}
                                accessibilityRole="button" accessibilityLabel={c.toggleA11y(d.title, kindLabel)}
                                style={[styles.segment, { backgroundColor: theme.surfaceField }]}>
                                {(['task', 'habit'] as const).map(k => (
                                  <View key={k} style={[styles.segmentPart, d.kind === k && { backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant, borderWidth: B.thin }]}>
                                    <Text style={[styles.segmentText, { color: d.kind === k ? toneOf(k) : theme.onSurfaceVariant }]}>{k === 'habit' ? c.habit : c.task}</Text>
                                  </View>
                                ))}
                              </Touchable>
                              {meta ? <Text numberOfLines={1} style={[styles.metaText, { color: theme.onSurfaceMuted }]}>{meta}</Text> : null}
                            </View>
                          </View>
                          <Touchable onPress={() => { haptic.select(); setDrafts(ds => ds.filter(x => x.id !== d.id)); }}
                            accessibilityRole="button" accessibilityLabel={c.remove(d.title)} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
                            <X size={ICON.sm} color={theme.onSurfaceVariant} />
                          </Touchable>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              )}
              {dropped > 0 && <Note text={c.dropped(CAPTURE_LIMITS.items, dropped)} theme={theme} />}
              {habitOverflow > 0 && <Note text={c.habitOverflow(HABIT_LIMIT, habitOverflow)} theme={theme} />}
              {mode && (
                <View style={[styles.group, styles.modeRow, { backgroundColor: theme.surfaceCard, borderColor: acceptMode ? theme.tertiary : (isDark ? theme.outline : theme.outlineVariant) }]}>
                  <AppIcon Icon={Sparkles} color={theme.tertiary} size={34} iconSize={ICON.sm} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeTitle, { color: theme.onSurface }]}>{c.modeHint[mode.mode]}</Text>
                    <Text style={[styles.metaText, { color: theme.onSurfaceVariant }]}>{c.modeAsk(c.modeName[mode.mode], modeDate)}</Text>
                  </View>
                  <Touchable onPress={() => { haptic.select(); setAcceptMode(v => !v); }} accessibilityRole="switch" accessibilityState={{ checked: acceptMode }}
                    accessibilityLabel={`${c.modeHint[mode.mode]}. ${c.modeAsk(c.modeName[mode.mode], modeDate)}`}
                    style={[styles.modeBtn, acceptMode
                      ? { backgroundColor: theme.tertiary + '1A', borderColor: theme.tertiary }
                      : { backgroundColor: theme.primaryFill, borderColor: theme.primary }]}>
                    <Text style={[styles.modeBtnText, { color: acceptMode ? theme.tertiary : theme.onPrimaryFill }]}>{acceptMode ? c.modeOn : c.modeOff}</Text>
                  </Touchable>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + S.md, borderTopColor: theme.separator }]}>
          <Touchable onPress={() => (step === 'review' ? setStep('write') : finish(true))} accessibilityRole="button"
            accessibilityLabel={step === 'review' ? c.back : c.skip} style={styles.ghost}>
            <Text style={[styles.ghostText, { color: theme.onSurfaceVariant }]}>{step === 'review' ? c.back : c.skip}</Text>
          </Touchable>
          <Touchable
            onPress={step === 'review' ? () => finish(false) : goReview}
            disabled={blocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked }}
            accessibilityLabel={step === 'review' ? c.add(count) : c.next(live)}
            style={[styles.primary, { backgroundColor: theme.primaryFill, opacity: blocked ? 0.4 : 1 }]}
          >
            <Text style={[styles.primaryText, { color: theme.onPrimaryFill }]}>{step === 'review' ? c.add(count) : c.next(live)}</Text>
          </Touchable>
        </View>
      </KeyboardAvoidingView>
      <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  body: { paddingHorizontal: S.lg, paddingBottom: S.xl, gap: S.md, width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  title: { fontSize: F.title, fontFamily: 'Jakarta-Bold', letterSpacing: -0.4 },
  sub: { fontSize: F.footnote, lineHeight: 19 },
  input: { fontSize: F.body, fontFamily: 'Jakarta-Medium', lineHeight: 22, borderRadius: R.lg, borderWidth: B.thin, padding: S.md, paddingBottom: MIN_TOUCH + S.sm, minHeight: 150, textAlignVertical: 'top' },
  mic: { position: 'absolute', right: S.sm, bottom: S.sm, width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  counter: { alignSelf: 'flex-end', fontSize: F.caption, fontVariant: ['tabular-nums'], marginTop: -S.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xs, borderRadius: R.md, padding: S.sm },
  noteText: { flex: 1, fontSize: F.caption, lineHeight: 17 },
  example: { flexDirection: 'row', alignItems: 'center', gap: S.xs, borderRadius: R.full, paddingHorizontal: S.smd, minHeight: MIN_TOUCH - S.xs },
  exampleText: { fontSize: F.footnote, fontWeight: '500' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.xxs, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs + 2 },
  chipText: { fontSize: F.footnote, fontWeight: '600', maxWidth: 220 },
  group: { borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.smd, paddingHorizontal: S.md, paddingVertical: S.smd },
  rowTitle: { fontSize: F.body, fontFamily: 'Jakarta-SemiBold', paddingVertical: 0 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  segment: { flexDirection: 'row', borderRadius: R.full, padding: S.xxs / 2, minHeight: 30 },
  segmentPart: { borderRadius: R.full, paddingHorizontal: S.sm, justifyContent: 'center' },
  segmentText: { fontSize: F.caption, fontWeight: '700' },
  metaText: { fontSize: F.caption, flexShrink: 1 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd, padding: S.md },
  modeTitle: { fontSize: F.footnote, fontWeight: '700' },
  modeBtn: { borderWidth: B.thin, borderRadius: R.full, paddingHorizontal: S.md, minHeight: 36, justifyContent: 'center' },
  modeBtnText: { fontSize: F.caption, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, paddingTop: S.md, borderTopWidth: StyleSheet.hairlineWidth },
  ghost: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: S.sm },
  ghostText: { fontSize: F.body, fontWeight: '600' },
  primary: { flex: 1, height: 50, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: F.body, fontWeight: '700' },
});
