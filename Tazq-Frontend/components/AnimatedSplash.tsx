import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { TazqLogo } from './TazqLogo';

export const AnimatedSplash = ({ onFinish, onReady }: { onFinish: () => void, onReady: () => void }) => {
  useEffect(() => {
    // Notify that we are ready to take over the screen
    onReady();

    const timer = setTimeout(() => {
      onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish, onReady]);

  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, scale: 0.9, translateY: 10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{
          type: 'timing',
          duration: 1000,
        }}
      >
        <TazqLogo size={48} showIcon={true} color="#FFFFFF" />
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});


