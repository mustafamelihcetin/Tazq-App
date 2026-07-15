// moti mock'u.
//
// Neden gerekli: moti -> react-native-reanimated -> react-native-worklets zinciri
// import anında native tarafın hazır olmasını bekler ve Jest'te "Native part of
// Worklets doesn't seem to be initialized" ile patlar. Bu yüzden moti kullanan
// hiçbir bileşen test edilemiyordu (ekranların tamamı moti kullanıyor).
//
// Mock animasyonu atlar ve bileşenleri düz View/Text olarak render eder; testler
// animasyonu değil DAVRANIŞI doğrular.
const React = require('react');
const { View, Text } = require('react-native');

// from/animate/transition/exit gibi animasyon prop'larini ayikla; digerleri
// (style, accessibility*, testID, onPress...) alta gecsin.
function stripMotiProps(props) {
  const { from, animate, transition, exit, exitTransition, delay, state, animateInitialState, ...rest } = props || {};
  return rest;
}

const MotiView = React.forwardRef((props, ref) =>
  React.createElement(View, { ref, ...stripMotiProps(props) }, props.children)
);
MotiView.displayName = 'MotiView';

const MotiText = React.forwardRef((props, ref) =>
  React.createElement(Text, { ref, ...stripMotiProps(props) }, props.children)
);
MotiText.displayName = 'MotiText';

// AnimatePresence cocuklarini oldugu gibi gosterir (cikis animasyonu yok).
const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);

const useAnimationState = () => ({ current: null, transitionTo: jest.fn() });
const useDynamicAnimation = () => ({ current: null, animateTo: jest.fn() });

module.exports = {
  MotiView,
  MotiText,
  MotiImage: MotiView,
  MotiScrollView: MotiView,
  AnimatePresence,
  useAnimationState,
  useDynamicAnimation,
  motify: () => MotiView,
  View: MotiView,
  Text: MotiText,
};
