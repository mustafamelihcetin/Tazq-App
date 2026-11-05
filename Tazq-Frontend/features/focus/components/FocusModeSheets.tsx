import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { DeviceOnlyNote } from '@/shared/components/DeviceOnlyNote';
import { Timer, Shield, Sun, Maximize2, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { DragToClose } from '@/shared/components/DragToClose';
import { AppIcon } from '@/shared/components/AppIcon';
import { S, F, R, B, ICON, SCRIM, sheetMaxHeight, MIN_TOUCH } from '@/shared/constants/tokens';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { Nebula } from '@/features/focus/components/FocusBackdrop';
import { FOCUS_SCENES, SCENE_SOUND, sceneLights, type FocusSceneId } from '@/features/focus/utils/focusScenes';

const SCENE_CARD_H = 124;
import { useFocusSheetTheme } from '@/features/focus/hooks/useFocusSheetTheme';

/**
 * ODAK MODLARI + POMODORO BİLGİSİ — odak ekranının iki alt sayfası.
 *
 * Ekran 2600 satırdı; bu iki pencere sayaç ve shader kodunun arasına gömülüydü.
 * Metinler taşınırken satır içi `tr ? ... : ...` dallanmasından tek sözlüğe çevrildi
 * (bkz. i18nRatchet: iki dalı elle senkron tutmak pratikte ayrışıyor).
 */

type Lang = 'tr' | 'en';

export interface FocusPreset {
  key: string;
  labelTr: string;
  labelEn: string;
  workMins: number;
  shortBreak: number;
  longBreak: number;
  descTr: string;
  descEn: string;
}

const COPY = {
  tr: {
    modesTitle: 'Odak Modları',
    modesSub: 'Seansını nasıl geçireceğini seç',
    scene: 'SAHNE',
    peekHint: 'Tam görmek için basılı tut',
    sceneSound: (n: string) => `${n} sesiyle dene`,
    modes: 'MODLAR',
    strict: 'Katı Odak',
    pomodoroDesc: 'Çalış / mola döngüleri',
    autoZen: 'Otomatik Zen',
    autoZenDesc: 'Seans başlayınca tam ekrana geçer',
    on: 'AÇIK',
    off: 'KAPALI',
    pomodoroTitle: 'Pomodoro Tekniği',
    pomodoroBody: (p: FocusPreset) => `"${p.labelTr}" modunda ${p.workMins} dk çalışıp ${p.shortBreak} dk dinleniyorsun. 4. turda ${p.longBreak} dk uzun mola.`,
    work: (m: number) => `${m}dk çalış`,
    breaks: (s: number, l: number) => `${s}/${l}dk mola`,
    gotIt: 'Anladım',
    presetName: (p: FocusPreset) => p.labelTr,
    presetDesc: (p: FocusPreset) => p.descTr,
  },
  en: {
    modesTitle: 'Focus Modes',
    modesSub: 'Choose how your session runs',
    scene: 'SCENE',
    peekHint: 'Press and hold to see it full',
    sceneSound: (n: string) => `Try with ${n.toLowerCase()} sound`,
    modes: 'MODES',
    strict: 'Strict Focus',
    pomodoroDesc: 'Work / break cycles',
    autoZen: 'Auto Zen',
    autoZenDesc: 'Goes full-screen once a session starts',
    on: 'ON',
    off: 'OFF',
    pomodoroTitle: 'Pomodoro Technique',
    pomodoroBody: (p: FocusPreset) => `In "${p.labelEn}" mode you work for ${p.workMins} min and rest ${p.shortBreak} min. After round 4, a ${p.longBreak}-min long break.`,
    work: (m: number) => `${m}m work`,
    breaks: (s: number, l: number) => `${s}/${l}m break`,
    gotIt: 'Got it',
    presetName: (p: FocusPreset) => p.labelEn,
    presetDesc: (p: FocusPreset) => p.descEn,
  },
};

/*
  ZEMİN UYGULAMA TEMASINI İZLER, YAZI DA ONU İZLEMELİ.

  Odak ekranı her iki temada da KOYU (kendi meditatif kimliği). Ama alt sayfaların
  zemini `GlassSurface` ve o, uygulamanın temasından geliyor: açık temada zemin AÇIK
  oluyordu, yazılar ise odak ekranının koyu paletinden (yani açık renkti) → açık
  üstüne açık, okunmuyordu. Renkler bu yüzden buradan, kendi zemininden alınır.
*/
export interface FocusModesSheetProps {
  visible: boolean;
  onClose: () => void;
  language: Lang;
  /** Ekranın metin sözlüğünden gelen, moda özel açıklamalar. */
  labels: { keepAwake: string; keepAwakeDesc: string; strictDesc: string };
  pomodoroOn: boolean;
  strictOn: boolean;
  keepAwakeOn: boolean;
  autoZenOn: boolean;
  onPomodoro: () => void;
  onStrict: () => void;
  onKeepAwake: () => void;
  onAutoZen: () => void;
  /** Odak sahnesi — hareket + palet + vurgu (bkz. focusScenes.ts). */
  scene: FocusSceneId;
  onScene: (id: FocusSceneId) => void;
  /** Seçili ses: sahnenin önerisi zaten çalıyorsa önerilmez. */
  sound: string;
  onSceneSound: (id: string) => void;
}

export const FocusModesSheet: React.FC<FocusModesSheetProps> = ({
  visible, onClose, language, labels,
  pomodoroOn, strictOn, keepAwakeOn, autoZenOn,
  onPomodoro, onStrict, onKeepAwake, onAutoZen, scene, onScene, sound, onSceneSound,
}) => {
  const [peek, setPeek] = useState(false);
  const { theme, isDark } = useFocusSheetTheme();
  const c = COPY[language];
  const [rowW, setRowW] = useState(0);
  const lowPower = useLowPowerGraphics();
  const GAP = S.sm;
  /*
    YATAYDA / TABLETTE TAŞMA (2026-11-01, kullanıcı: "tablette yan yatırınca odak modları aşağı kayıyor, kapanmıyor").
    Sahne kartları genişlikle büyüyordu: yatay iPad'de pencere ekrandan uzun oluyor, kapatmak için dokunulacak boş
    alan sıfıra iniyordu. Artık kart en çok 104 pt, pencere en çok ekranın izin verdiği boy (taşarsa kayar) ve
    geniş ekranda 560 pt genişlikte ortada.
  */
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardW = rowW > 0 ? Math.floor((rowW - GAP) / 2) : 0;
  const rows = [
    // Nefes burada YOK (2026-11-01): bir mod değil, ayrı seans; odak ekranında başlatın solunda kendi düğmesi var.
    { key: 'pomo', Ic: Timer, on: pomodoroOn, title: 'Pomodoro', desc: c.pomodoroDesc, chevron: false, onPress: onPomodoro },
    // "Çıkışı kilitler" YANLIŞTI: hiçbir şey kilitlenmiyordu. Kural artık açık yazıyor.
    { key: 'strict', Ic: Shield, on: strictOn, title: c.strict, desc: labels.strictDesc, chevron: false, onPress: onStrict },
    // Ekran kendiliğinden kararıp kilitleniyordu; katı modda bu bile "ayrıldın" sayılıyordu.
    { key: 'awake', Ic: Sun, on: keepAwakeOn, title: labels.keepAwake, desc: labels.keepAwakeDesc, chevron: false, onPress: onKeepAwake },
    { key: 'zen', Ic: Maximize2, on: autoZenOn, title: c.autoZen, desc: c.autoZenDesc, chevron: false, onPress: onAutoZen },
  ];

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Karartma TÜM ekranı kaplar (pencerenin arkası dahil): sürüklerken pencerenin boşalttığı yer karartmasız kalıyordu. */}
      {/* Basılı tutunca sayfa çekilir, sahne tam görünür; parmak kalkınca döner. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: SCRIM, opacity: peek ? 0 : 1 }}>
        <Touchable accessibilityRole="button" accessibilityLabel={c.modesTitle} style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <DragToClose onClose={onClose} handleColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'} style={{ maxHeight: Math.min(sheetMaxHeight(winH, insets.top), winH * 0.85), width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: 'hidden' }}>
          <GlassSurface corners="top" />
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.xs, paddingBottom: S.xxl }}>
          <Text style={{ fontSize: F.title3, fontWeight: '700', color: theme.onSurface, textAlign: 'center' }}>{c.modesTitle}</Text>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'center', marginBottom: S.md }}>{c.modesSub}</Text>

          {/*
            SAHNE — canlı önizleme: seçili sahne HAREKET eder, diğerleri durağan karesini
            gösterir (dört shader aynı anda dönmesin). Seçim halkası sahnenin kendi vurgusunda.
          */}
          <Text style={{ fontSize: F.caption, fontWeight: '600', letterSpacing: 1.2, color: theme.onSurfaceMuted, marginBottom: S.sm, marginLeft: S.xs }}>{c.scene}</Text>
          <View accessibilityRole="radiogroup" onLayout={(e) => setRowW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: S.sm }}>
            {cardW > 0 && FOCUS_SCENES.map((sc) => {
              const selected = sc.id === scene;
              const [l1, l2, l3] = sceneLights(sc, theme);
              const ring = sc.accent ?? theme.primary;
              const name = language === 'tr' ? sc.tr : sc.en;
              const desc = language === 'tr' ? sc.descTr : sc.descEn;
              return (
                <Touchable
                  key={sc.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, checked: selected }}
                  accessibilityLabel={`${name}. ${desc}`}
                  accessibilityHint={c.peekHint}
                  onPress={() => { if (!selected) onScene(sc.id); }}
                  onLongPress={() => { if (!selected) onScene(sc.id); setPeek(true); }}
                  onPressOut={() => setPeek(false)}
                  style={{ width: cardW, height: SCENE_CARD_H, borderRadius: R.lg, borderWidth: 2, borderColor: selected ? ring : 'transparent', padding: S.xxs }}
                >
                  <View style={{ flex: 1, borderRadius: R.md, overflow: 'hidden', justifyContent: 'flex-end' }}>
                    <View style={StyleSheet.absoluteFill}>
                      <Nebula size={0} width={cardW - 8} height={SCENE_CARD_H - 8} c1={l1} c2={l2} c3={l3} scene={sc.id} base={sc.base} paused={!selected || !visible} lowFps={lowPower} />
                    </View>
                    <View style={{ padding: S.sm, backgroundColor: 'rgba(0,0,0,0.28)' }}>
                      <Text numberOfLines={1} style={{ fontSize: F.footnote, fontWeight: '700', color: '#FFFFFF' }}>{name}</Text>
                      <Text numberOfLines={2} style={{ fontSize: F.caption2, color: 'rgba(255,255,255,0.85)' }}>{desc}</Text>
                    </View>
                  </View>
                </Touchable>
              );
            })}
          </View>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, marginLeft: S.xs, marginBottom: S.sm }}>{c.peekHint}</Text>
          {sound !== SCENE_SOUND[scene].id && (
            <Touchable accessibilityRole="button" onPress={() => onSceneSound(SCENE_SOUND[scene].id)} style={{ alignSelf: 'flex-start', minHeight: MIN_TOUCH - S.xs, justifyContent: 'center', paddingHorizontal: S.md, borderRadius: R.full, marginBottom: S.lg, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
              <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurface }}>{c.sceneSound(language === 'tr' ? SCENE_SOUND[scene].tr : SCENE_SOUND[scene].en)}</Text>
            </Touchable>
          )}
          <Text style={{ fontSize: F.caption, fontWeight: '600', letterSpacing: 1.2, color: theme.onSurfaceMuted, marginBottom: S.xs, marginLeft: S.xs }}>{c.modes}</Text>
          {rows.map((row) => (
            <Touchable
              key={row.key}
              onPress={row.onPress}
              accessibilityRole={row.chevron ? 'button' : 'switch'}
              accessibilityState={row.chevron ? undefined : { checked: row.on }}
              accessibilityLabel={row.title}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.smd, paddingHorizontal: S.sm, borderRadius: R.lg, marginBottom: S.xs, backgroundColor: row.on ? theme.primary + (isDark ? '14' : '0D') : 'transparent' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', backgroundColor: row.on ? theme.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }}>
                <row.Ic size={ICON.md} color={row.on ? '#FFFFFF' : theme.onSurfaceVariant} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>{row.title}</Text>
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, marginTop: S.xxs }} numberOfLines={1}>{row.desc}</Text>
              </View>
              {row.chevron ? (
                <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
              ) : (
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: row.on ? theme.primary : theme.onSurfaceMuted }}>
                  {row.on ? c.on : c.off}
                </Text>
              )}
            </Touchable>
          ))}
          {/* Odak ayarları hesaba eşitlenmez — küçük, dürüst not. */}
          <DeviceOnlyNote language={language} theme={theme} />
          </ScrollView>
        </DragToClose>
      </View>
    </Modal>
  );
};

export interface PomodoroInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  language: Lang;
  presets: readonly FocusPreset[];
  activePreset: FocusPreset;
  selectedPreset: string;
  onSelectPreset: (key: string, workMins: number) => void;
}

export const PomodoroInfoSheet: React.FC<PomodoroInfoSheetProps> = ({
  visible, onClose, language, presets, activePreset, selectedPreset, onSelectPreset,
}) => {
  const { theme, isDark } = useFocusSheetTheme();
  const c = COPY[language];
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={c.gotIt}
        style={{ flex: 1, backgroundColor: SCRIM, justifyContent: 'center', alignItems: 'center', padding: S.slg }}
        activeOpacity={1}
        onPress={onClose}
      >
        <MotiView
          from={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{ borderRadius: R.sheet, padding: S.slg, width: '100%', gap: S.md }}
        >
          <GlassSurface radius={R.sheet} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
            <AppIcon Icon={Timer} color={theme.primary} size={40} radius={R.md} iconSize={ICON.md} />
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5, flex: 1 }}>
              {c.pomodoroTitle}
            </Text>
          </View>
          <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurfaceVariant, lineHeight: 22 }}>
            {c.pomodoroBody(activePreset)}
          </Text>
          <View style={{ gap: S.sm }}>
            {presets.map((preset) => {
              const isActive = preset.key === selectedPreset;
              return (
                <Touchable
                  key={preset.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={c.presetName(preset)}
                  onPress={() => onSelectPreset(preset.key, preset.workMins)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isActive ? theme.primary + '18' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.smd, borderWidth: B.thin, borderColor: isActive ? theme.primary + '40' : 'transparent' }}
                >
                  <View style={{ gap: S.xxs }}>
                    <Text style={{ fontSize: F.footnote, fontWeight: '700', color: isActive ? theme.primary : theme.onSurface }}>
                      {c.presetName(preset)}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.presetDesc(preset)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: S.xxs }}>
                    <Text style={{ fontSize: F.caption2, fontWeight: '700', color: isActive ? theme.primary : theme.onSurfaceVariant }}>
                      {c.work(preset.workMins)}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>
                      {c.breaks(preset.shortBreak, preset.longBreak)}
                    </Text>
                  </View>
                </Touchable>
              );
            })}
          </View>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={c.gotIt}
            onPress={onClose}
            style={{ backgroundColor: theme.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' }}
          >
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onPrimary }}>{c.gotIt}</Text>
          </Touchable>
        </MotiView>
      </Touchable>
    </Modal>
  );
};
