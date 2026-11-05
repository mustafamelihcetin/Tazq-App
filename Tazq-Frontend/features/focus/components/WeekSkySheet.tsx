import React, { useEffect, useMemo } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { WeekSky } from '@/features/focus/components/WeekSky';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { weekRange } from '@/features/report/weeklyReport';
import { F, W, S, R, MIN_TOUCH, SCRIM } from '@/shared/constants/tokens';
import { fmtDateKey } from '@/features/habits';

/*
  GÖKYÜZÜ ODAĞIN YANINDA (2026-11-05, kullanıcı: "kullanıcı olsan nerede görmek isterdin, tüm sayfalar dahil"). Anlamı "odaklandım, yıldızım düştü": sebebin yaşandığı yerde durur.
  Odak ekranı kaydırılmaz ve seansı kalabalıklaştırmamalı, bu yüzden sayfaya gömülmez: sağ üstten ve seans bitişinden açılır, kapanır, sessizdir. Geçmiş haftalar Geri Bakış'ta.
*/
const COPY = { tr: { close: 'Kapat' }, en: { close: 'Close' } };

export function WeekSkySheet({ visible, language, onClose }: { visible: boolean; language: 'tr' | 'en'; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const sessions = useFocusHistoryStore(s => s.sessions);
  const legacy = useFocusHistoryStore(s => s.usingLegacyFallback);
  const dayKeys = useMemo(() => weekRange(new Date()).days, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (visible) void useFocusHistoryStore.getState().refresh(); }, [visible]);

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.scrim}>
        <Touchable style={{ flex: 1 }} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={COPY[language].close} />
        <View style={st.sheet}>
          <GlassSurface corners="top" />
          {visible && (
            <WeekSky sessions={sessions} dayKeys={dayKeys} language={language} timed={!legacy} todayKey={fmtDateKey()} bleed bottomInset={insets.bottom}>
              <Touchable accessibilityRole="button" onPress={onClose} style={st.close}>
                <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: '#FFFFFF' }}>{COPY[language].close}</Text>
              </Touchable>
            </WeekSky>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM },
  sheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: 'hidden' },
  close: { alignSelf: 'center', minHeight: MIN_TOUCH, paddingHorizontal: S.xl, alignItems: 'center', justifyContent: 'center', borderRadius: R.full },
});
