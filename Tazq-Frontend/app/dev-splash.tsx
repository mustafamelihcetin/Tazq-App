import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { AnimatedSplash } from '@/shared/components/AnimatedSplash';

/*
  AÇILIŞ ÖNİZLEMESİ (yalnız geliştirme). Açılış ekranını soğuk başlatma beklemeden, GERÇEK
  hızında döngüde oynatır — tasarımı cihazda tekrar tekrar görmek ve ekran görüntüsüyle
  ölçmek için. (Animasyonu yavaşlatmak, aynı geliştirme sunucusuna bağlı her cihazda
  açılışı yavaşlatıyordu.) Release'de ilk satırda ana sayfaya yönlendirir.
  Açmak için: tazq-app-dev://dev-splash
*/
export default function DevSplash() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Loop />;
}

function Loop() {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setRun(r => r + 1), 4000);
    return () => clearTimeout(id);
  }, [run]);
  return (
    <View style={{ flex: 1 }}>
      <AnimatedSplash key={run} ready onReady={() => {}} onFinish={() => {}} />
    </View>
  );
}
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
