import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { C } from "../theme";
import { Lang, T } from "../copy";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const useRise = (delay: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 200 } });
  return { opacity: s, transform: `translateY(${(1 - s) * 24}px)` };
};

const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.textMuted }) => (
  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2.5, color }}>{children}</div>
);

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.line}`,
      borderRadius: 22,
      padding: 18,
      ...style,
    }}
  >
    {children}
  </div>
);

/* ── 1. Mod kurulumu: tarih yazılır, buton basılır ─────────────────────── */
export const SetupScreen: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = T[lang];
  const f = useCurrentFrame();
  const typed = Math.floor(interpolate(f, [25, 60], [0, t.setupDateVal.length], clamp));
  const press = interpolate(f, [80, 86, 92], [1, 0.94, 1], clamp);
  const days = Math.round(interpolate(f, [60, 90], [0, 247], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const row = (label: string, val: React.ReactNode, active: boolean, d: number) => (
    <div style={useRise(d)}>
      <Card style={{ borderColor: active ? C.violet : C.line, padding: 16 }}>
        <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{val}</div>
      </Card>
    </div>
  );
  return (
    <div style={{ padding: "70px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <Label color={C.violet}>TAZQ</Label>
      <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 8 }}>{t.setupTitle}</div>
      {row(t.setupGoal, t.setupGoalVal, false, 4)}
      {row(
        t.setupDate,
        <span>
          {t.setupDateVal.slice(0, typed)}
          <span style={{ opacity: f % 30 < 15 && f < 70 ? 1 : 0, color: C.violet }}>|</span>
        </span>,
        f > 20 && f < 75,
        10,
      )}
      {row(t.setupMethod, t.setupMethodVal, false, 16)}
      <div style={{ ...useRise(60), textAlign: "center", marginTop: 26 }}>
        <div style={{ fontSize: 88, fontWeight: 800, color: C.violet, lineHeight: 1 }}>{days}</div>
        <div style={{ fontSize: 16, color: C.textDim, fontWeight: 600 }}>{t.daysLeft}</div>
      </div>
      <div
        style={{
          ...useRise(22),
          marginTop: "auto",
          position: "absolute",
          bottom: 50,
          left: 22,
          right: 22,
          transform: `scale(${press})`,
          background: C.violet,
          color: "#10131A",
          borderRadius: 18,
          padding: 18,
          textAlign: "center",
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        {t.setupCta}
      </div>
    </div>
  );
};

/* ── 2. Gün gün plan: günler sırayla açılır ─────────────────────────── */
export const PlanScreen: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = T[lang];
  const colors = [C.violet, C.emerald, C.primary, C.amber];
  return (
    <div style={{ padding: "70px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={useRise(0)}>
        <Label color={C.emerald}>{t.examDay.toUpperCase()}</Label>
        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{t.planTitle}</div>
      </div>
      {t.planDays.map((d, i) => (
        <div key={d} style={useRise(10 + i * 9)}>
          <Card style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: colors[i] }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors[i], letterSpacing: 1 }}>{d.toUpperCase()}</div>
              {t.planItems[i].map((it) => (
                <div key={it} style={{ fontSize: 17, fontWeight: 600, marginTop: 6 }}>
                  {it}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
};

/* ── 3. Günün planı: görevler tek tek işaretlenir ────────────────────── */
export const TodayScreen: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = T[lang];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ padding: "70px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={useRise(0)}>
        <Label>{t.todayLabel}</Label>
        <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6 }}>{t.todayTitle}</div>
      </div>
      <Card style={{ padding: "6px 18px", ...useRise(6) }}>
        {t.tasks.map((task, i) => {
          const at = 25 + i * 22;
          const done = i < 3 ? spring({ frame: f - at, fps, config: { damping: 14 } }) : 0;
          return (
            <div
              key={task}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 0",
                borderBottom: i < t.tasks.length - 1 ? `1px solid ${C.line}` : "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  border: `2.5px solid ${done > 0.5 ? C.emerald : "#52525B"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.emerald,
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                <span style={{ transform: `scale(${done})` }}>✓</span>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: done > 0.5 ? C.textMuted : C.text,
                  textDecoration: done > 0.5 ? "line-through" : "none",
                }}
              >
                {task}
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ ...useRise(20), marginTop: 8 }}>
        <Label>{t.rituals}</Label>
      </div>
      <div style={{ display: "flex", gap: 12, ...useRise(26) }}>
        {[
          [t.ritualA, 12],
          [t.ritualB, 7],
        ].map(([name, n], i) => {
          const bump = i === 0 ? Math.round(interpolate(f, [95, 105], [0, 1], clamp)) : 0;
          return (
            <Card key={String(name)} style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.amber, marginTop: 8 }}>
                🔥 {Number(n) + bump} {t.days}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

/* ── 4. Odak: aurora küresi + geri sayım ──────────────────────────────── */
export const FocusScreen: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = T[lang];
  const f = useCurrentFrame();
  const secs = 25 * 60 - 42 - Math.floor(f / 30);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const b = Math.sin(f / 30) * 0.06;
  const orb = (x: number, y: number, c: string, ph: number) => (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin(f / 40 + ph) * 14,
        top: y + Math.cos(f / 45 + ph) * 14,
        width: 150,
        height: 150,
        borderRadius: 75,
        background: c,
        opacity: 0.55,
        filter: "blur(6px)",
      }}
    />
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 70 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.textDim, letterSpacing: 1 }}>{t.focusLabel}</div>
      <div
        style={{
          marginTop: 110,
          width: 300,
          height: 300,
          borderRadius: 150,
          border: "6px solid rgba(255,255,255,0.07)",
          position: "relative",
          overflow: "hidden",
          transform: `scale(${1 + b})`,
          background: "#11131F",
        }}
      >
        {orb(40, 40, "#6D5BD0", 0)}
        {orb(110, 110, "#2F7F6F", 2)}
        {orb(80, 70, "#8B7CF6", 4)}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 68,
            fontWeight: 400,
            letterSpacing: -1,
          }}
        >
          {mm}:{ss}
        </div>
      </div>
      <div style={{ display: "flex", gap: 22, marginTop: 70 }}>
        {t.focusModes.map((m, i) => (
          <div key={m} style={{ textAlign: "center", ...useRise(10 + i * 5) }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                background: i === 1 ? "#12332C" : C.surfaceHi,
                border: `1.5px solid ${i === 1 ? C.emerald : "#3F3A63"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                color: i === 1 ? C.emerald : C.violet,
              }}
            >
              {["◷", "♫", "☾"][i]}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 10 }}>{m}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── 5. Haftalık geri bakış: çubuklar büyür ─────────────────────────── */
export const WeekScreen: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = T[lang];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vals = [0.45, 0.7, 0.55, 0.9, 0.65, 0.8, 0.95];
  return (
    <div style={{ padding: "70px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={useRise(0)}>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{t.weekTitle}</div>
      </div>
      <Card style={{ ...useRise(5), height: 250, display: "flex", alignItems: "flex-end", gap: 12, padding: 22 }}>
        {vals.map((v, i) => {
          const g = spring({ frame: f - 10 - i * 4, fps, config: { damping: 18 } });
          return (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 170 * v * g,
                  borderRadius: 8,
                  background: i === 6 ? C.emerald : `linear-gradient(180deg, ${C.violet}, #6D5BD0)`,
                }}
              />
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8, fontWeight: 700 }}>{t.weekdays[i]}</div>
            </div>
          );
        })}
      </Card>
      <div style={{ display: "flex", gap: 10 }}>
        {t.weekStats.map(([n, l], i) => (
          <Card key={l} style={{ flex: 1, padding: 14, ...useRise(30 + i * 6) }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: [C.violet, C.emerald, C.amber][i] }}>{n}</div>
            <div style={{ fontSize: 13, color: C.textDim, fontWeight: 600 }}>{l}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};
