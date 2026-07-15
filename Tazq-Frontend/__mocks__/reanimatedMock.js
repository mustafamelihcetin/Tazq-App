// react-native-reanimated mock'u.
//
// Paketin kendi `react-native-reanimated/mock` dosyası bu sürümde gerçek modülü
// (dolayısıyla react-native-worklets'i) yüklüyor ve Jest'te native taraf olmadığı
// için patlıyor. Bu elle yazılmış mock hiçbir gerçek modülü yüklemez.
//
// Amaç: animasyonu simüle etmek değil, animasyon API'sini çağıran bileşenlerin
// render edilip DAVRANIŞLARININ test edilebilmesi.
const React = require('react');
const { View, Text, ScrollView, Image, FlatList } = require('react-native');

const makeAnimated = (Component) => {
  const C = React.forwardRef((props, ref) => React.createElement(Component, { ref, ...props }, props.children));
  C.displayName = `Animated.${Component.displayName || Component.name || 'View'}`;
  return C;
};

// useSharedValue: .value okunup yazilabilen basit bir kap.
const useSharedValue = (init) => {
  const ref = React.useRef({ value: init });
  return ref.current;
};

// Animasyon fonksiyonlari hedef degeri aninda dondurur (zaman yok).
const identity = (toValue) => toValue;
const withCallback = (toValue, _cfg, cb) => {
  if (typeof cb === 'function') cb(true);
  return toValue;
};

const Animated = {
  View: makeAnimated(View),
  Text: makeAnimated(Text),
  ScrollView: makeAnimated(ScrollView),
  Image: makeAnimated(Image),
  FlatList: makeAnimated(FlatList),
  createAnimatedComponent: (C) => makeAnimated(C),
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,

  useSharedValue,
  useAnimatedStyle: (fn) => {
    try { return typeof fn === 'function' ? fn() : {}; } catch { return {}; }
  },
  useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : undefined }),
  useAnimatedScrollHandler: () => () => {},
  useAnimatedRef: () => React.createRef(),
  useAnimatedReaction: () => {},
  useAnimatedGestureHandler: () => () => {},

  withTiming: withCallback,
  withSpring: withCallback,
  withDelay: (_d, v) => v,
  withSequence: (...v) => v[v.length - 1],
  withRepeat: identity,
  withDecay: identity,
  cancelAnimation: () => {},

  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (v) => v,
  interpolateColor: () => '#000000',
  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: new Proxy({}, { get: () => () => (t) => t }),

  FadeIn: { duration: () => ({}), delay: () => ({}) },
  FadeOut: { duration: () => ({}), delay: () => ({}) },
  Layout: { springify: () => ({}), duration: () => ({}) },
  LinearTransition: { springify: () => ({}), duration: () => ({}) },
};
