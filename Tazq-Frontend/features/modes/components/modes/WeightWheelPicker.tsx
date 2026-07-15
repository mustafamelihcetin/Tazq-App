/**
 * WeightWheelPicker — kilo seçimi için kaydırmalı tekerlek (modlar.tsx'ten çıkarıldı).
 * Android'de nested scroll ile düzgün döner; momentum/drag bitince değeri commit eder.
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { R, B } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

interface WeightWheelPickerProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  theme: AppTheme;
  isDark: boolean;
  sporColor: string;
}

export function WeightWheelPicker({ value, onChange, min = 30, max = 220, theme, isDark, sporColor }: WeightWheelPickerProps) {
  const itemHeight = 40;
  const visibleItems = 3;
  const containerHeight = itemHeight * visibleItems;

  const values = useMemo(() => {
    const arr: number[] = [];
    for (let i = min; i <= max; i++) arr.push(i);
    return arr;
  }, [min, max]);

  const initialIndex = values.indexOf(value);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    if (initialIndex !== -1 && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: initialIndex * itemHeight, animated: isMounted.current });
        isMounted.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, initialIndex]);

  const handleMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
    if (index >= 0 && index < values.length) {
      const val = values[index];
      if (val !== value) { Haptics.selectionAsync(); onChange(val); }
    }
  };

  return (
    <View style={{ height: containerHeight, width: 100, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', alignSelf: 'center' }}>
      <View style={{ position: 'absolute', top: itemHeight, left: 0, right: 0, height: itemHeight, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: sporColor + '40', backgroundColor: sporColor + '08' }} pointerEvents="none" />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        onScrollEndDrag={handleMomentumScrollEnd}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{ paddingVertical: itemHeight }}
      >
        {values.map((item) => {
          const active = item === value;
          return (
            <View key={item} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: active ? 20 : 15, fontWeight: active ? '900' : '600', color: active ? sporColor : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)') }}>
                {item} <Text style={{ fontSize: active ? 12 : 9, fontWeight: '500' }}>kg</Text>
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
