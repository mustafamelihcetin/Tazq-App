import React from 'react';
import { View, Text, Modal } from 'react-native';
import { MotiView } from 'moti';
import { Timer, Wind, Shield, Sun, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { AppIcon } from '@/shared/components/AppIcon';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

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
    breath: 'Nefes',
    breathDesc: 'Ritmik nefes rehberi',
    strict: 'Katı Odak',
    pomodoroDesc: 'Çalış / mola döngüleri',
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
    breath: 'Breathing',
    breathDesc: 'Guided breathing rhythm',
    strict: 'Strict Focus',
    pomodoroDesc: 'Work / break cycles',
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
  breathOn: boolean;
  pomodoroOn: boolean;
  strictOn: boolean;
  keepAwakeOn: boolean;
  onBreath: () => void;
  onPomodoro: () => void;
  onStrict: () => void;
  onKeepAwake: () => void;
}

export const FocusModesSheet: React.FC<FocusModesSheetProps> = ({
  visible, onClose, language, labels,
  breathOn, pomodoroOn, strictOn, keepAwakeOn,
  onBreath, onPomodoro, onStrict, onKeepAwake,
}) => {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const rows = [
    { key: 'breath', Ic: Wind, on: breathOn, title: c.breath, desc: c.breathDesc, chevron: true, onPress: onBreath },
    { key: 'pomo', Ic: Timer, on: pomodoroOn, title: 'Pomodoro', desc: c.pomodoroDesc, chevron: false, onPress: onPomodoro },
    // "Çıkışı kilitler" YANLIŞTI: hiçbir şey kilitlenmiyordu. Kural artık açık yazıyor.
    { key: 'strict', Ic: Shield, on: strictOn, title: c.strict, desc: labels.strictDesc, chevron: false, onPress: onStrict },
    // Ekran kendiliğinden kararıp kilitleniyordu; katı modda bu bile "ayrıldın" sayılıyordu.
    { key: 'awake', Ic: Sun, on: keepAwakeOn, title: labels.keepAwake, desc: labels.keepAwakeDesc, chevron: false, onPress: onKeepAwake },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Touchable accessibilityRole="button" accessibilityLabel={c.modesTitle} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
        <View style={{ borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xxl, overflow: 'hidden' }}>
          <GlassSurface corners="top" />
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: R.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
          </View>
          <Text style={{ fontSize: F.title3, fontWeight: '700', color: theme.onSurface, textAlign: 'center', marginTop: S.md }}>{c.modesTitle}</Text>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'center', marginBottom: S.md }}>{c.modesSub}</Text>
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
        </View>
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
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={c.gotIt}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: S.slg }}
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
