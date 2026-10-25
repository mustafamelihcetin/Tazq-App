import { useMemo } from 'react';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { sceneOf, sceneSheetTheme } from '@/features/focus/utils/focusScenes';

/** Odak ekranından açılan pencerelerin teması — uygulama zemini + seçili sahnenin vurgusu. */
export function useFocusSheetTheme() {
  const app = useAppTheme();
  const sceneId = usePrefsStore((s) => s.focusScene);
  return useMemo(
    () => ({ ...app, theme: sceneSheetTheme(sceneOf(sceneId), app.theme, app.isDark) }),
    [app, sceneId],
  );
}
