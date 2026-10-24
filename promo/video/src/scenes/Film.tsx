import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Aurora, fadeInOut } from "../ui/Aurora";
import { Phone } from "../ui/Phone";
import { FocusScreen, PlanScreen, SetupScreen, TodayScreen, WeekScreen } from "../ui/Screens";
import { C, FPS, fontFamily } from "../theme";
import { Lang, NARRATION, T } from "../copy";
import timing from "../timing.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Visual = "open" | "seasons" | "date" | "setup" | "plan" | "today" | "focus" | "week" | "trust" | "end";
const VISUAL_BY_LINE: Visual[] = ["open", "seasons", "date", "setup", "plan", "today", "focus", "week", "trust", "end"];
// Ekran animasyonlarının sığması için alt sınır (kare).
const MIN_FRAMES: Partial<Record<Visual, number>> = { setup: 105, today: 120, focus: 110, week: 100, end: 120 };
const PAD = 18; // satır sonrası nefes

export type Scene = { visual: Visual; line: number; from: number; dur: number };

export const buildFilm = (lang: Lang) => {
  const durs = (timing as Record<string, Record<string, number>>)[lang] ?? {};
  const scenes: Scene[] = [];
  let at = 20; // açılışta karanlıkta kısa bekleyiş
  NARRATION[lang].forEach((n, i) => {
    const v = VISUAL_BY_LINE[i];
    const audio = Math.ceil((durs[n.id] ?? 3) * FPS);
    const dur = Math.max(audio + PAD, MIN_FRAMES[v] ?? 0);
    scenes.push({ visual: v, line: i, from: at, dur });
    at += dur;
  });
  return { scenes, total: at + 45 };
};

// Play tanıtımı: filmin kısa, sessiz anlatımsız kesimi — sabit süreler.
export const buildPlay = () => {
  const plan: [Visual, number][] = [
    ["seasons", 105],
    ["date", 75],
    ["setup", 110],
    ["today", 125],
    ["focus", 100],
    ["week", 95],
    ["end", 120],
  ];
  let at = 10;
  const scenes = plan.map(([visual, dur]) => {
    const s = { visual, line: VISUAL_BY_LINE.indexOf(visual), from: at, dur };
    at += dur;
    return s;
  });
  return { scenes, total: at + 20 };
};

const Big: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 76,
  style,
}) => (
  <div style={{ fontFamily, fontSize: size, fontWeight: 800, color: C.text, letterSpacing: -1.5, lineHeight: 1.1, ...style }}>
    {children}
  </div>
);

const Reveal: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 200 }, durationInFrames: 25 });
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * 30}px)`, filter: `blur(${(1 - s) * 8}px)`, ...style }}>
      {children}
    </div>
  );
};

const PhoneScene: React.FC<{ caption: string; children: React.ReactNode; glow?: string }> = ({ caption, children, glow }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 200 }, durationInFrames: 30 });
  const drift = interpolate(f, [0, 200], [0, -18]);
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 220px", gap: 120 }}>
      <div style={{ flex: 1 }}>
        <Reveal delay={6}>
          <Big size={64}>{caption}</Big>
        </Reveal>
      </div>
      <div
        style={{
          height: 940,
          width: 448,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: s,
          transform: `translateY(${(1 - s) * 80 + drift}px) rotateY(${(1 - s) * -12}deg)`,
        }}
      >
        <Phone scale={1.07} glow={glow}>
          {children}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const Calendar: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const t = T[lang];
  const glow = interpolate(f, [20, 45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily }}>
      <Reveal>
        <div style={{ color: C.textDim, fontSize: 34, fontWeight: 700, textAlign: "center", marginBottom: 30, letterSpacing: 4 }}>
          {t.month.toUpperCase()} 2027
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 96px)", gap: 14 }}>
          {Array.from({ length: 28 }, (_, i) => {
            const d = i + 1;
            const hit = d === 20;
            return (
              <div
                key={d}
                style={{
                  height: 80,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: hit ? 800 : 600,
                  color: hit ? "#10131A" : `rgba(250,250,250,${0.35 - glow * 0.15})`,
                  background: hit ? `rgba(167,139,250,${0.15 + glow * 0.85})` : "rgba(255,255,255,0.03)",
                  boxShadow: hit ? `0 0 ${80 * glow}px ${C.violet}` : "none",
                  transform: hit ? `scale(${1 + glow * 0.25})` : "none",
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
      </Reveal>
    </AbsoluteFill>
  );
};

const Seasons: React.FC<{ lang: Lang; dur: number }> = ({ lang, dur }) => {
  const words = T[lang].seasons;
  const step = Math.max(14, Math.floor((dur - 20) / words.length));
  const colors = [C.violet, C.primary, C.pink, C.emerald];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 10 }}>
      {words.map((w, i) => (
        <Reveal key={w} delay={i * step}>
          <Big size={96} style={{ color: colors[i] }}>
            {w}
          </Big>
        </Reveal>
      ))}
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily }}>
      <Img
        src={staticFile("icon.png")}
        style={{ width: 170, height: 170, borderRadius: 40, transform: `scale(${s})`, boxShadow: `0 0 120px ${C.violet}88` }}
      />
      <Reveal delay={10} style={{ marginTop: 40 }}>
        <Big size={110} style={{ letterSpacing: 18, textAlign: "center" }}>
          TAZQ
        </Big>
      </Reveal>
      <Reveal delay={22}>
        <div style={{ fontSize: 42, color: C.textDim, fontWeight: 600, marginTop: 14 }}>{T[lang].slogan}</div>
      </Reveal>
      <Reveal delay={40}>
        <div style={{ fontSize: 26, color: C.textMuted, fontWeight: 600, marginTop: 40, letterSpacing: 1 }}>{T[lang].stores}</div>
      </Reveal>
    </AbsoluteFill>
  );
};

const Visual: React.FC<{ s: Scene; lang: Lang; caption: string }> = ({ s, lang, caption }) => {
  const t = T[lang];
  switch (s.visual) {
    case "open":
      return (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Reveal delay={8}>
            <Big size={72} style={{ fontWeight: 600, textAlign: "center", maxWidth: 1300 }}>
              {caption}
            </Big>
          </Reveal>
        </AbsoluteFill>
      );
    case "seasons":
      return <Seasons lang={lang} dur={s.dur} />;
    case "date":
      return <Calendar lang={lang} />;
    case "setup":
      return (
        <PhoneScene caption={caption}>
          <SetupScreen lang={lang} />
        </PhoneScene>
      );
    case "plan":
      return (
        <PhoneScene caption={caption} glow={C.emerald}>
          <PlanScreen lang={lang} />
        </PhoneScene>
      );
    case "today":
      return (
        <PhoneScene caption={caption} glow={C.primary}>
          <TodayScreen lang={lang} />
        </PhoneScene>
      );
    case "focus":
      return (
        <PhoneScene caption={caption}>
          <FocusScreen lang={lang} />
        </PhoneScene>
      );
    case "week":
      return (
        <PhoneScene caption={caption} glow={C.emerald}>
          <WeekScreen lang={lang} />
        </PhoneScene>
      );
    case "trust":
      return (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 70 }}>
          {t.trust.map((w, i) => (
            <Reveal key={w} delay={i * 16}>
              <Big size={64} style={{ color: [C.text, C.text, C.emerald][i] }}>
                {w}
              </Big>
            </Reveal>
          ))}
        </AbsoluteFill>
      );
    case "end":
      return <EndCard lang={lang} />;
  }
};

// Telefon sahnelerindeki sol başlık: filmde anlatımın kısaltılmış hali, Play'de mağaza başlıkları.
const CAPTION: Record<Lang, Partial<Record<Visual, string>>> = {
  tr: {
    open: "Herkesin hayatında bir dönem vardır.",
    setup: "Tarihini söyle.",
    plan: "Gerisini TAZQ kursun.",
    today: "Her sabah, sadece bugün.",
    focus: "Dünyayı sustur.",
    week: "Ne kadar yol aldığını gör.",
  },
  en: {
    open: "Everyone has a season in their life.",
    setup: "Tell it the date.",
    plan: "TAZQ builds the rest.",
    today: "Each morning, just today.",
    focus: "Mute the world.",
    week: "See how far you've come.",
  },
};

export const Film: React.FC<{ lang: Lang; variant: "film" | "play" }> = ({ lang, variant }) => {
  const { scenes, total } = variant === "film" ? buildFilm(lang) : buildPlay();
  const f = useCurrentFrame();
  const master = interpolate(f, [0, 30, total - 40, total], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Aurora />
      <AbsoluteFill style={{ opacity: master }}>
        {scenes.map((s) => (
          <Sequence key={s.visual} from={s.from} durationInFrames={s.dur}>
            <SceneFade dur={s.dur}>
              <Visual s={s} lang={lang} caption={CAPTION[lang][s.visual] ?? ""} />
            </SceneFade>
          </Sequence>
        ))}
      </AbsoluteFill>
      {variant === "film" &&
        scenes.map((s) => (
          <Sequence key={`a${s.line}`} from={s.from + 4}>
            <Audio src={staticFile(`audio/${lang}/${NARRATION[lang][s.line].id}.wav`)} />
          </Sequence>
        ))}
      <Audio
        src={staticFile("audio/music.wav")}
        volume={(fr) =>
          interpolate(fr, [0, 30, total - 60, total], [0, variant === "film" ? 0.38 : 0.7, variant === "film" ? 0.38 : 0.7, 0], clamp)
        }
      />
    </AbsoluteFill>
  );
};

const SceneFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: fadeInOut(f, dur, 14, 14) }}>{children}</AbsoluteFill>;
};
