import React, { useEffect, useRef } from 'react';
import { View, ViewProps } from 'react-native';
import { useTourStore } from '@/shared/store/useTourStore';

// Simple legacy wrapper support to avoid breaking layout root imports
export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const useTour = () => {
  const measureAll = useTourStore.getState().measureAll;
  return { measureAll };
};

interface TourTargetProps extends ViewProps {
  id: string;
  children: React.ReactNode;
}

export const TourTarget: React.FC<TourTargetProps> = ({ id, children, style, ...props }) => {
  const viewRef = useRef<View>(null);

  useEffect(() => {
    useTourStore.getState().registerTarget(id, viewRef);
    return () => {
      useTourStore.getState().unregisterTarget(id);
    };
  }, [id]);

  return (
    <View
      ref={viewRef}
      collapsable={false}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};
