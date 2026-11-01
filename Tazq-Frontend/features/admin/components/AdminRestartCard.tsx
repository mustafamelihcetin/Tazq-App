import React from 'react';
import { View } from 'react-native';
import { reloadAppAsync } from 'expo';
import { RotateCcw } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, ICON } from '@/shared/constants/tokens';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsCard, SettingItem, settingsAccents } from '@/shared/components/SettingsRows';
import { swallow } from '@/shared/utils/swallow';

/*
  YENİDEN BAŞLAT — YALNIZ SÜPER ADMIN (2026-11-01, kullanıcı: "admin yetkililer için özel yeniden
  başlatma seçeneği, userlar görmesin"). SplashAdminCard'ın içinden çizilir; o kart yalnız
  canStaff(role, 'super') iken görünür (app/settings.tsx).

  expo'nun reloadAppAsync'i JS paketini baştan yükler: açılış ekranı, depoların diskten okunması,
  oturum yenileme — soğuk açılışın JS tarafı yeniden çalışır. Dev'de de release'te de çalışır;
  expo-updates gerektirmez (Updates.reloadAsync dev'de reddeder, yeni paket de yüklemez).
  Titreşim yok: uygulama anında yeniden başlar, geri bildirim yeniden başlamanın kendisi.
*/

const COPY = {
  tr: { header: 'YÖNETİCİ · YALNIZ ADMİN', restart: 'Uygulamayı yeniden başlat', restartSub: 'Açılış ekranından itibaren baştan yükler' },
  en: { header: 'ADMIN ONLY', restart: 'Restart the app', restartSub: 'Reloads from the splash screen' },
};

export function AdminRestartCard({ lang }: { lang: 'tr' | 'en' }) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const A = settingsAccents(theme);

  return (
    <View style={{ marginTop: S.lg }}>
      <SectionHeader title={c.header} theme={theme} tr={lang === 'tr'} />
      <SettingsCard theme={theme} isDark={isDark}>
        <SettingItem icon={<RotateCcw size={ICON.md} color="#FFFFFF" />} bg={A.legal} label={c.restart} sub={c.restartSub}
          onPress={() => { reloadAppAsync('admin restart').catch(e => swallow('admin.restart', e)); }} theme={theme} />
      </SettingsCard>
    </View>
  );
}
