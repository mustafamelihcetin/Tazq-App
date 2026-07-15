// Global mocks for native modules that are not available in Jest (Node.js) environment

// Silence noisy logs in test output
global.console.warn = jest.fn();

// Make @react-native-voice/voice's native module appear linked in the test environment
// This must run before any test file imports utils/voice.ts (which checks NativeModules.Voice)
try {
  const { NativeModules } = require('react-native');
  if (NativeModules && !NativeModules.Voice) {
    NativeModules.Voice = {};
  }
} catch (_) {}

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    appOwnership: 'standalone',
    expoConfig: { name: 'Tazq', version: '1.0.0', slug: 'tazq' },
  },
}));

// Mock @sentry/react-native.
// Gerçek SDK import edildiğinde bir setInterval temizlik zamanlayıcısı başlatır
// (AsyncExpiringMap) ve unref edilmediği için Jest worker'ı test bitse de kapanmaz
// ("worker process has failed to exit gracefully"). Testler zaten Sentry'ye ağ
// çağrısı yapmamalı; SDK'yı hiç yüklememek hem sızıntıyı hem de yavaşlığı kaldırır.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setLevel: jest.fn(), setExtra: jest.fn() })),
  wrap: (component) => component,
  ReactNativeTracing: jest.fn(),
}));

// Mock react-native-reanimated + moti.
//
// Paketin kendi 'react-native-reanimated/mock' dosyası bu sürümde gerçek modülü
// (ve dolayısıyla react-native-worklets'i) yüklüyor; native taraf olmadığı için
// Jest'te "Native part of Worklets doesn't seem to be initialized" ile patlıyordu.
// Bu, moti/reanimated kullanan HER bileşenin test edilmesini engelliyordu — yani
// ekranların tamamını. Elle yazılan mock'lar hiçbir gerçek modülü yüklemez.
jest.mock('react-native-reanimated', () => require('./reanimatedMock'));
jest.mock('moti', () => require('./motiMock'));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: jest.fn(() => ({ enabled: jest.fn().mockReturnThis(), activeOffsetX: jest.fn().mockReturnThis(), failOffsetY: jest.fn().mockReturnThis(), onBegin: jest.fn().mockReturnThis(), onUpdate: jest.fn().mockReturnThis(), onEnd: jest.fn().mockReturnThis(), onFinalize: jest.fn().mockReturnThis() })) },
  GestureDetector: ({ children }) => children,
  GestureHandlerRootView: ({ children }) => children,
}));
