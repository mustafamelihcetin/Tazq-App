import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStore } from '../store/useNetworkStore';
import { useLanguageStore } from '../store/useLanguageStore';

export const OfflineBanner = () => {
  const { isOnline } = useNetworkStore();
  const { language } = useLanguageStore();

  return (
    <AnimatePresence>
      {!isOnline && (
        <MotiView
          from={{ translateY: -52, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: -52, opacity: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.banner}
        >
          <WifiOff size={14} color="#fff" />
          <Text style={styles.text}>
            {language === 'tr' ? 'İnternet bağlantısı yok' : 'No internet connection'}
          </Text>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ff3b30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
