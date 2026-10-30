import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check, Play, CircleUserRound, ChevronDown, Palette } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { AccentPalettes, ACCENT_FEATURED, type AccentPalette } from '@/shared/constants/Colors';
import { S, R, F, W, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { RowDivider, ToggleRow, IconChip, settingsAccents } from '@/shared/components/SettingsRows';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import { AuthService } from '@/shared/services/api';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { UserAvatar } from '@/features/user/components/UserAvatar';
import { hasRing, ringStoreValue, RING_NONE } from '@/features/user/utils/avatarRings';

/*
  RENK — TEK YER (2026-10-31). Vurgu rengi ve profil çerçevesi aynı soruydu ("senin rengin ne?")
  ama iki ayrı ekranda, iki ayrı paletle soruluyordu. Artık burada, bir kez:
    · CANLI ÖNİZLEME — kişinin kendi avatarı (çerçevesiyle) + uygulamada en sık görülen üç öğe
      (cümle hapı, birincil düğme, tamamlandı) seçilen renkle anında çizilir.
    · AÇILIR LİSTE ("UI'ı boğmadan daha çok seçenek"): kapalıyken 6 seçkin ton tek sıra; "Tüm renkler"
      18 tonu 6'lık üç sıra açar (renk çemberi + yumuşaklar). Seçili ton gizli sıradaysa kapalı sırada
      son hücrede görünür — seçim hiçbir zaman gözden kaybolmaz.
    · "Profil çerçevesi" yalnız VAR/YOK — rengi her zaman vurgudur (bkz. avatarRings.ts).
*/
const COPY = {
  tr: { title: 'Renk', all: 'Tüm renkler', less: 'Daha az', pill: '3 görev', button: 'Odaklan', ring: 'Profil çerçevesi', ringSub: 'Avatarın seçtiğin renkle çerçevelenir' },
  en: { title: 'Color', all: 'All colors', less: 'Fewer', pill: '3 tasks', button: 'Focus', ring: 'Profile frame', ringSub: 'Your avatar is framed in your color' },
};

export function AccentPicker({ lang }: { lang: 'tr' | 'en' }) {
  const { theme, isDark } = useAppTheme();
  const accent = useThemeStore(s => s.accent);
  const setAccent = useThemeStore(s => s.setAccent);
  const ringStored = usePrefsStore(s => s.avatarBorderColor);
  const setRingStored = usePrefsStore(s => s.setAvatarBorderColor);
  const user = useAuthStore(s => s.user);
  const guestAvatar = useSessionStore(s => s.guestProfile?.avatar);
  const ringOn = hasRing(ringStored);
  const c = COPY[lang];
  const current = AccentPalettes.find(a => a.id === accent) ?? AccentPalettes[0];
  const [open, setOpen] = useState(false);
  const featured = (ACCENT_FEATURED.includes(accent) ? ACCENT_FEATURED : [...ACCENT_FEATURED.slice(0, COLS - 1), accent])
    .map(id => AccentPalettes.find(a => a.id === id)!);
  const rows: AccentPalette[][] = open
    ? Array.from({ length: AccentPalettes.length / COLS }, (_, r) => AccentPalettes.slice(r * COLS, r * COLS + COLS))
    : [featured];

  const swatch = (a: AccentPalette) => {
    const col = (isDark ? a.dark : a.light).primary;
    const selected = a.id === accent;
    return (
      <Touchable key={a.id} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} accessibilityLabel={a.label[lang]}
        onPress={() => { if (!selected) { haptic.select(); setAccent(a.id); } }}
        style={[styles.ring, { borderColor: selected ? col : 'transparent' }]}>
        <View style={[styles.dot, { backgroundColor: col }]}>
          {selected && <Check size={ICON.xs} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </Touchable>
    );
  };

  const toggleRing = (on: boolean) => {
    haptic.select();
    const value = on ? ringStoreValue(accent) : RING_NONE;
    setRingStored(value);
    // Hesaplıysa sunucuya da: diğer cihazlar ve yeniden girişte kaybolmasın (yalnız bu alan gider).
    if (user) AuthService.updateProfile({ avatarBorderColor: value }).catch(e => swallow('accentPicker.ring', e));
  };

  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.head}>
          {/* Diğer ayar satırlarıyla aynı hiza ve dil: solda kategori çipi. */}
          <IconChip bg={settingsAccents(theme).system} theme={theme}><Palette size={ICON.md} color="#FFFFFF" /></IconChip>
          <Text style={[styles.title, { flex: 1, color: theme.onSurface }]}>
            {c.title} <Text style={[styles.value, { color: theme.primary }]}>· {current.label[lang]}</Text>
          </Text>
          {/* Saf gezinme: açıp kapamak titreşmez. */}
          <Touchable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
            hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }} style={styles.more}>
            <Text style={[styles.value, { color: theme.onSurfaceMuted }]}>{open ? c.less : `${c.all} · ${AccentPalettes.length}`}</Text>
            <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 200 }}>
              <ChevronDown size={ICON.xs} color={theme.onSurfaceMuted} />
            </MotiView>
          </Touchable>
        </View>

        {/* CANLI ÖNİZLEME — seçim anında yumuşakça yeni renge geçer. */}
        <MotiView key={accent} from={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 260 }}
          style={[styles.preview, { backgroundColor: theme.surfaceField }]}>
          <View style={[styles.avatar, { borderWidth: ringOn ? 2 : 1, borderColor: ringOn ? theme.primary : theme.outlineVariant }]}>
            <UserAvatar avatar={user?.avatar ?? guestAvatar} size={AVATAR - 2 * (ringOn ? 4 : 1)} iconSize={ICON.sm} theme={theme} style={{ borderRadius: R.full }} />
          </View>
          <View style={[styles.pill, { backgroundColor: theme.primary + (isDark ? '26' : '17') }]}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.pill}</Text>
          </View>
          <View style={[styles.button, { backgroundColor: theme.primary }]}>
            <Play size={ICON.xs} color={theme.onPrimary} fill={theme.onPrimary} />
            <Text style={{ fontSize: F.footnote, fontWeight: W.bold, color: theme.onPrimary }}>{c.button}</Text>
          </View>
          <View style={[styles.check, { backgroundColor: theme.primary }]}>
            <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
          </View>
        </MotiView>

        {/* SABİT 6'lık sıralar (esnek sarma bir satıra 7 sığdırıyordu: 7 + 5, simetrisiz). */}
        <View accessibilityRole="radiogroup" style={{ gap: S.sm }}>
          {rows.map((row, r) => (
            <MotiView key={`${open}${r}`} from={{ opacity: 0, translateY: -S.xs }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 180, delay: r * 40 }} style={styles.row}>
              {row.map(swatch)}
            </MotiView>
          ))}
        </View>
      </View>
      <RowDivider theme={theme} />
      <ToggleRow
        icon={<CircleUserRound size={ICON.md} color="#FFFFFF" />}
        bg={settingsAccents(theme).system}
        title={c.ring}
        subtitle={c.ringSub}
        value={ringOn}
        onValueChange={toggleRing}
        theme={theme} isDark={isDark}
      />
    </>
  );
}

const DOT = 30;
const COLS = 6;
const AVATAR = 36;
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.md, paddingVertical: S.smd, gap: S.smd },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  title: { fontSize: F.body, fontWeight: W.medium },
  value: { fontSize: F.footnote, fontWeight: W.semibold },
  preview: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.smd, borderRadius: R.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pill: { borderRadius: R.sm, paddingHorizontal: S.xs, paddingVertical: S.xxs },
  button: { flexDirection: 'row', alignItems: 'center', gap: S.xxs, borderRadius: R.full, paddingHorizontal: S.smd, paddingVertical: S.xs },
  check: { width: S.lg, height: S.lg, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  more: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  ring: { width: DOT + 10, height: DOT + 10, borderRadius: R.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
