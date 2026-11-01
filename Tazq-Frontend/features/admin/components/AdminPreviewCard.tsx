import React from 'react';
import { View } from 'react-native';
import { Bell, Inbox, Radio } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, ICON } from '@/shared/constants/tokens';
import { SettingsCard, SettingItem, RowDivider, settingsAccents } from '@/shared/components/SettingsRows';
import { useToastStore } from '@/shared/store/useToastStore';
import { useInboxStore } from '@/shared/store/useInboxStore';
import { sendDemoNotifications } from '@/shared/utils/notifications';
import { startDemoLiveActivity } from '@/features/focus/liveActivity';

/*
  ÖNİZLEME — YALNIZ SÜPER ADMIN (2026-11-01, kullanıcı: "örnek görmek istediğim şeyler oluyor, admine özel ver").
  Gerçek durumu beklemeden görmek için: her türden örnek bildirim (basılı tutup eylemleri dene; örnek bildirimlerin
  eylemleri gerçek veriye DOKUNMAZ), örnek kalemlerle dolu gelen kutusu, 2 dakikalık örnek Canlı Etkinlik.
  SplashAdminCard'ın içinden çizilir (o kart yalnız canStaff(role, 'super') iken görünür).
*/
const COPY = {
  tr: {
    notif: 'Bildirimleri dene', notifSub: 'Her türden örnek, 5 sn arayla · basılı tutup eylemleri dene',
    notifToast: (n: number) => `${n} örnek bildirim sıraya alındı. Uygulamayı arka plana al.`, notifFail: 'Bildirim izni yok ya da bu ortam desteklemiyor.',
    inbox: 'Gelen kutusu örneği', inboxOn: 'Açık · Bugün’deki kutu örnek kalemlerle dolu', inboxOff: 'Kutuyu her türden örnek kalemle doldurur',
    live: 'Canlı Etkinlik dene', liveSub: '2 dk örnek sayaç · Dinamik Ada / kilit ekranı (iPhone, yeni derleme)',
    liveOk: 'Örnek başladı. Uygulamadan çık ve Ada’ya bak.', liveNo: 'Bu derlemede Canlı Etkinlik yok (yeni iOS derlemesi gerekir).',
  },
  en: {
    notif: 'Try notifications', notifSub: 'One of each, 5 s apart · long-press to try the actions',
    notifToast: (n: number) => `${n} sample notifications queued. Send the app to the background.`, notifFail: 'No notification permission or not supported here.',
    inbox: 'Sample inbox', inboxOn: 'On · the Today inbox is filled with samples', inboxOff: 'Fills the inbox with one sample of each kind',
    live: 'Try Live Activity', liveSub: '2-min sample timer · Dynamic Island / Lock Screen (iPhone, new build)',
    liveOk: 'Sample started. Leave the app and look at the Island.', liveNo: 'No Live Activity in this build (needs a new iOS build).',
  },
};

export function AdminPreviewCard({ lang }: { lang: 'tr' | 'en' }) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const A = settingsAccents(theme);
  const demo = useInboxStore(s => s.demo);
  const toast = useToastStore.getState().show;

  return (
    <View style={{ marginTop: S.md }}>
      <SettingsCard theme={theme} isDark={isDark}>
        <SettingItem
          icon={<Bell size={ICON.md} color="#FFFFFF" />} bg={A.notify} label={c.notif} sub={c.notifSub} theme={theme}
          onPress={() => { void sendDemoNotifications(lang).then(n => toast(n > 0 ? c.notifToast(n) : c.notifFail, n > 0 ? 'success' : 'error')); }}
        />
        <RowDivider theme={theme} />
        <SettingItem
          icon={<Inbox size={ICON.md} color="#FFFFFF" />} bg={A.system} label={c.inbox} sub={demo ? c.inboxOn : c.inboxOff} theme={theme}
          onPress={() => useInboxStore.getState().setDemo(!demo)}
        />
        <RowDivider theme={theme} />
        <SettingItem
          icon={<Radio size={ICON.md} color="#FFFFFF" />} bg={A.health} label={c.live} sub={c.liveSub} theme={theme}
          onPress={() => toast(startDemoLiveActivity(lang) ? c.liveOk : c.liveNo, 'info')}
        />
      </SettingsCard>
    </View>
  );
}
