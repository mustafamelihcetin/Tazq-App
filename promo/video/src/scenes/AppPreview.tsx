import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Phone, SCREEN_H, SCREEN_W } from "../ui/Phone";
import { FocusScreen, PlanScreen, SetupScreen, TodayScreen } from "../ui/Screens";
import { C, fontFamily } from "../theme";
import { Lang, T } from "../copy";
import { Aurora } from "../ui/Aurora";

// App Store önizlemesi: 886×1920, en fazla 30 sn. Apple uygulamanın kendisini görmek ister:
// cihaz çerçevesi yok, üstte kısa başlık, altında uygulama arayüzü.
export const PREVIEW_SEG = 150; // 5 sn
export const PREVIEW_TOTAL = PREVIEW_SEG * 5;

const Seg: React.FC<{ caption: string; children?: React.ReactNode }> = ({ caption, children }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 }, durationInFrames: 20 });
  const out = interpolate(f, [PREVIEW_SEG - 12, PREVIEW_SEG], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // iPhone (886×1920) genişliğe, iPad (1200×1600) yüksekliğe dayanır — ikisinde de taşma yok.
  const scale = Math.min((width * 0.86) / SCREEN_W, (height - 420) / SCREEN_H);
  const left = (width - SCREEN_W * scale) / 2;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 60,
          right: 60,
          textAlign: "center",
          fontFamily,
          fontSize: 76,
          fontWeight: 800,
          color: C.text,
          letterSpacing: -1.5,
          lineHeight: 1.08,
          opacity: s,
          transform: `translateY(${(1 - s) * 30}px)`,
        }}
      >
        {caption}
      </div>
      {children && (
        <div
          style={{
            position: "absolute",
            top: 380,
            left,
            borderRadius: 44,
            overflow: "hidden",
            boxShadow: `0 40px 140px -20px ${C.violet}77`,
            opacity: s,
            transform: `translateY(${(1 - s) * 60}px)`,
          }}
        >
          <Phone frame={false} scale={scale}>
            {children}
          </Phone>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const AppPreview: React.FC<{ lang: Lang }> = ({ lang }) => {
  const c = T[lang].captions;
  const screens = [
    <SetupScreen key="s" lang={lang} />,
    <PlanScreen key="p" lang={lang} />,
    <TodayScreen key="t" lang={lang} />,
    <FocusScreen key="f" lang={lang} />,
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Aurora intensity={0.8} />
      {screens.map((sc, i) => (
        <Sequence key={i} from={i * PREVIEW_SEG} durationInFrames={PREVIEW_SEG}>
          <Seg caption={c[i]}>{sc}</Seg>
        </Sequence>
      ))}
      <Sequence from={4 * PREVIEW_SEG} durationInFrames={PREVIEW_SEG}>
        <Seg caption={c[4]}>
          <TodayScreen lang={lang} />
        </Seg>
      </Sequence>
      <Audio
        src={staticFile("audio/music.wav")}
        volume={(fr) => interpolate(fr, [0, 20, PREVIEW_TOTAL - 40, PREVIEW_TOTAL], [0, 0.7, 0.7, 0])}
      />
    </AbsoluteFill>
  );
};
