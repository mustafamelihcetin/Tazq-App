import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import type { AppTheme } from '@/shared/constants/Colors';
import { BentoCard } from '@/shared/components/BentoCard';
import { S } from '@/shared/constants/tokens';

export interface TazqCoreProps {
  theme: AppTheme;
}

/**
 * TazqCore (Dijital Yoldaş / Çekirdek)
 * Kullanıcının aktif moduna göre renk değiştiren ve momentumuna (engineHeat) 
 * göre nefes alan, soyut ve sofistike bir yoldaş.
 */
export const TazqCore = React.memo<TazqCoreProps>(({ theme }) => {
  const prefs = usePrefsStore(s => s.seasonal);
  const heat = useMomentumStore(s => s.engineHeat);
  const decayHeat = useMomentumStore(s => s.decayEngineHeat);

  // Periyodik olarak ısıyı (heat) düşür ki animasyon hızı zamanla normale dönsün
  useEffect(() => {
    const interval = setInterval(() => {
      decayHeat();
    }, 1000);
    return () => clearInterval(interval);
  }, [decayHeat]);

  // Hangi mod aktifse ona göre renk belirle (Öncelik sırasına göre)
  let coreColor = theme.primary; // Varsayılan: Mavi
  if (prefs.sporMode) coreColor = theme.error; // Enerjik Kırmızı/Turuncu
  else if (prefs.tasarrufMode) coreColor = theme.tertiary; // Yeşil
  else if (prefs.examMode || prefs.tezMode) coreColor = theme.secondary || '#7C3AED'; // Odak Moru/İndigo

  // Isıya göre animasyon parametrelerini belirle
  // 0 ısı = sakin nefes (1500ms), 100 ısı = hızlı nabız (600ms)
  const duration = Math.max(600, 2000 - (heat * 14));
  const scaleMax = 1 + (heat / 500); // 1.0 to 1.2
  
  // Opaklık ısındıkça artar, soludukça düşer (fakat hiç kaybolmaz)
  const baseOpacity = 0.5 + (heat / 200); 

  return (
    <View style={styles.container}>
      <View style={styles.coreWrapper}>
        {/* Dış Hale (Glow) */}
        <MotiView
          from={{ scale: 0.9, opacity: baseOpacity - 0.2 }}
          animate={{ scale: scaleMax + 0.1, opacity: baseOpacity }}
          transition={{
            type: 'timing',
            duration: duration,
            loop: true,
          }}
          style={[
            styles.halo,
            { backgroundColor: coreColor }
          ]}
        />
        
        {/* İç Çekirdek (Core) */}
        <MotiView
          from={{ scale: 0.95 }}
          animate={{ scale: scaleMax }}
          transition={{
            type: 'timing',
            duration: duration,
            loop: true,
          }}
          style={[
            styles.core,
            { 
              backgroundColor: coreColor,
              shadowColor: coreColor,
            }
          ]}
        />
      </View>
    </View>
  );
});

TazqCore.displayName = 'TazqCore';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.md,
  },
  coreWrapper: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.4,
  },
  core: {
    width: 32,
    height: 32,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  }
});
