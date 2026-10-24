import React from "react";
import { C, fontFamily } from "../theme";

export const SCREEN_W = 390;
export const SCREEN_H = 844;

// Uygulama ekranının çizildiği yüzey. `frame` false iken (App Store önizlemesi) çerçevesiz tam ekran.
export const Phone: React.FC<{ children: React.ReactNode; scale?: number; frame?: boolean; glow?: string }> = ({
  children,
  scale = 1,
  frame = true,
  glow = C.violet,
}) => {
  const screen = (
    <div
      style={{
        width: SCREEN_W,
        height: SCREEN_H,
        background: "#0B0B10",
        borderRadius: frame ? 48 : 0,
        overflow: "hidden",
        position: "relative",
        fontFamily,
        color: C.text,
      }}
    >
      {children}
      {frame && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 34,
            borderRadius: 20,
            background: "#000",
          }}
        />
      )}
    </div>
  );
  // transform yerleşimi değiştirmez: kapsayıcı ölçeklenmiş boyutu açıkça taşımalı, yoksa kırpılır.
  if (!frame)
    return (
      <div style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{screen}</div>
      </div>
    );
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        padding: 12,
        borderRadius: 60,
        background: "linear-gradient(145deg,#2a2a33,#0d0d12)",
        boxShadow: `0 0 0 2px #3a3a44, 0 60px 160px -20px ${glow}66, 0 30px 80px rgba(0,0,0,0.6)`,
      }}
    >
      {screen}
    </div>
  );
};
