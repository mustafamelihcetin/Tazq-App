import React from 'react';
import { View } from 'react-native';
import { Flag, LayoutGrid } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { ICON, S } from '@/shared/constants/tokens';
import { RowDivider, SettingItem, SettingsCard, settingsAccents } from '@/shared/components/SettingsRows';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { hasActiveMode } from '@/features/modes/utils/planAuthority';
import { confirmGoalsPause, confirmUiMode } from '@/features/modes/utils/uiModeSwitch';

const COPY = {
  tr: {
    goals: 'Hedeflerin',
    running: 'Görevleri listene geliyor',
    paused: 'Duruyor, görevleri listede değil',
    full: 'Tam moda dön',
    fullSub: 'Alışkanlık, hedef, hafta ve ödemeler orada',
  },
  en: {
    goals: 'Your goals',
    running: 'Their tasks are coming to your list',
    paused: 'Paused, their tasks are off your list',
    full: 'Back to full mode',
    fullSub: 'Habits, goals, week and payments are there',
  },
};

/*
  SADE MODDA "DAHA FAZLASI" BURADA (2026-11-06, kullanıcı: "hedefleri görmek ister mi, isterse nerede nasıl ister"). Sade kullanıcı sayfaya bakmak istemez.
  Hedefi yoksa o sözcüğü hiç görmez. Hedefi varsa tek karar kalır: görevleri gelsin mi. Fazlasını isteyen için tek çıkış: tam mod.
*/
export function LiteModeCard({ language }: { language: 'tr' | 'en' }) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const A = settingsAccents(theme);
  const hasGoals = usePrefsStore(s => hasActiveMode(s.seasonal));
  const paused = usePrefsStore(s => s.liteGoalsPaused);
  return (
    <View style={{ marginTop: S.lg }}>
      <SettingsCard theme={theme} isDark={isDark}>
        {hasGoals && (<>
          <SettingItem
            icon={<Flag size={ICON.md} color="#FFFFFF" />}
            bg={A.system}
            label={c.goals}
            sub={paused ? c.paused : c.running}
            onPress={() => confirmGoalsPause(language)}
            theme={theme}
          />
          <RowDivider theme={theme} />
        </>)}
        <SettingItem
          icon={<LayoutGrid size={ICON.md} color="#FFFFFF" />}
          bg={A.system}
          label={c.full}
          sub={c.fullSub}
          onPress={() => confirmUiMode('pro', language)}
          theme={theme}
        />
      </SettingsCard>
    </View>
  );
}
