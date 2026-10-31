import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Play, Sparkles } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, B, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsCard, SettingItem, ToggleRow, RowDivider, settingsAccents } from '@/shared/components/SettingsRows';
import { useSplashPrefs } from '@/shared/store/useSplashPrefs';
import { SPLASH_EDITIONS } from '@/shared/components/AnimatedSplash';
import { haptic } from '@/shared/utils/haptics';

/*
  AÇILIŞ EKRANI — YALNIZ SÜPER ADMIN (2026-10-31, kullanıcı: "sadece adminlere splash'i tetikleme,
  görme, yönetme; userlar asla görmeyecek"). Çağıran (app/settings.tsx) kartı yalnız
  canStaff(role, 'super') iken çizer. Ayarlar bu cihazda geçerli (bkz. useSplashPrefs).
*/

const COPY = {
  tr: {
    header: 'AÇILIŞ EKRANI · YALNIZ ADMİN', play: 'Şimdi oynat', playSub: 'Açılışı uygulamayı kapatmadan izle',
    edition: 'Sürüm', random: 'Rastgele', enabled: 'Açılış animasyonu', enabledSub: 'Kapalıyken bu cihazda atlanır',
  },
  en: {
    header: 'SPLASH · ADMIN ONLY', play: 'Play now', playSub: 'Watch the splash without restarting',
    edition: 'Edition', random: 'Random', enabled: 'Splash animation', enabledSub: 'When off, skipped on this device',
  },
};

export function SplashAdminCard({ lang }: { lang: 'tr' | 'en' }) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const A = settingsAccents(theme);
  const edition = useSplashPrefs(s => s.edition);
  const enabled = useSplashPrefs(s => s.enabled);
  const { setEdition, setEnabled, preview } = useSplashPrefs.getState();
  const options = [{ id: 'random', label: c.random }, ...SPLASH_EDITIONS.map(e => ({ id: e.id, label: e.label[lang] }))];

  return (
    <View style={{ marginTop: S.lg }}>
      <SectionHeader title={c.header} theme={theme} tr={lang === 'tr'} />
      <SettingsCard theme={theme} isDark={isDark}>
        <SettingItem icon={<Play size={ICON.md} color="#FFFFFF" />} bg={A.legal} label={c.play} sub={c.playSub}
          onPress={() => { haptic.select(); preview(); }} theme={theme} />
        <RowDivider theme={theme} />
        <View style={{ paddingHorizontal: S.md, paddingVertical: S.smd, gap: S.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Sparkles size={ICON.sm} color={theme.onSurfaceMuted} />
            <Text style={{ fontSize: F.body, fontWeight: W.medium, color: theme.onSurface }}>{c.edition}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs }} accessibilityRole="radiogroup">
            {options.map(o => {
              const on = o.id === edition;
              return (
                <Touchable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={o.label}
                  onPress={() => { if (!on) { haptic.select(); setEdition(o.id); } }}
                  style={{ paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full, borderWidth: B.thin,
                    borderColor: on ? theme.primary : theme.outlineVariant, backgroundColor: on ? theme.primary + '1A' : 'transparent' }}>
                  <Text style={{ fontSize: F.footnote, fontWeight: on ? W.semibold : W.regular, color: on ? theme.primary : theme.onSurfaceVariant }}>{o.label}</Text>
                </Touchable>
              );
            })}
          </ScrollView>
        </View>
        <RowDivider theme={theme} />
        <ToggleRow icon={<Sparkles size={ICON.md} color="#FFFFFF" />} bg={A.legal} title={c.enabled} subtitle={c.enabledSub}
          value={enabled} onValueChange={(v: boolean) => { haptic.select(); setEnabled(v); }} theme={theme} isDark={isDark} />
      </SettingsCard>
    </View>
  );
}
