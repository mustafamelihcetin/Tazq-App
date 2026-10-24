import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

// Uygulamanın kendi fontu (Tazq-Frontend/app/_layout.tsx) — film markayla aynı sesi konuşsun.
export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

// Koyu tema paleti (Tazq-Frontend/shared/constants/Colors.ts → darkPalette).
export const C = {
  bg: "#07070B",
  surface: "#14141B",
  surfaceHi: "#1C1C25",
  line: "rgba(255,255,255,0.08)",
  text: "#FAFAFA",
  textDim: "#A1A1AA",
  textMuted: "#71717A",
  primary: "#0A84FF",
  violet: "#A78BFA",
  violetDeep: "#4C1D95",
  emerald: "#34D399",
  amber: "#F5B544",
  pink: "#F472B6",
};

export const FPS = 30;
