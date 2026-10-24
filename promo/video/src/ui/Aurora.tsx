import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";

// Uygulamadaki odak ekranı aurorasının sinema karşılığı: yavaş nefes alan üç renk kütlesi.
export const Aurora: React.FC<{ intensity?: number; hue?: "violet" | "emerald" | "blue" }> = ({
  intensity = 1,
  hue = "violet",
}) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const a = hue === "emerald" ? C.emerald : hue === "blue" ? C.primary : C.violet;
  const b = hue === "violet" ? C.emerald : C.violet;
  const blob = (x: number, y: number, size: number, color: string, op: number, phase: number) => (
    <div
      style={{
        position: "absolute",
        left: `${x + Math.sin(t * 0.25 + phase) * 6}%`,
        top: `${y + Math.cos(t * 0.2 + phase) * 5}%`,
        width: `${size}%`,
        aspectRatio: "1",
        transform: `translate(-50%,-50%) scale(${1 + Math.sin(t * 0.4 + phase) * 0.08})`,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity: op * intensity,
        filter: "blur(40px)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {blob(30, 40, 80, a, 0.42, 0)}
      {blob(70, 65, 70, b, 0.28, 2)}
      {blob(55, 20, 60, C.violetDeep, 0.6, 4)}
      {/* film greni + vinyet: dijital düzlüğü kırar */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' seed='${f % 8}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        }}
      />
    </AbsoluteFill>
  );
};

export const fadeInOut = (f: number, dur: number, inLen = 15, outLen = 15) =>
  interpolate(f, [0, inLen, dur - outLen, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
