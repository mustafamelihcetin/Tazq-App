import "react-native";

declare module "react-native" {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
}

declare module "react-native-safe-area-context" {
    interface NativeSafeAreaViewProps {
        className?: string;
    }
}

declare module "expo-blur" {
    interface BlurViewProps {
        className?: string;
    }
}
