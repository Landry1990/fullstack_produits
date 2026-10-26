import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const Line: React.FC<{ delay: number; children: React.ReactNode; fontSize: number; color?: string }> = ({
  delay,
  children,
  fontSize,
  color = "#f8fafc",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        color,
        opacity: s,
        transform: `translateY(${(1 - s) * 60}px)`,
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </div>
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const barW = interpolate(frame, [10, 60], [0, 420], { extrapolateRight: "clamp" });
  const fade = interpolate(frame, [70, 89], [1, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fade,
        background: "radial-gradient(ellipse at 30% 20%, #134e4a 0%, #0b1220 60%)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <Line delay={0} fontSize={40} color="#5eead4">
          FORMATION
        </Line>
        <Line delay={10} fontSize={110}>
          Réaliser une vente
        </Line>
        <Line delay={20} fontSize={48} color="#94a3b8">
          Module Caisse — Zenith Pharma
        </Line>
        <div style={{ width: barW, height: 6, marginTop: 24, borderRadius: 3, background: "#14b8a6" }} />
      </div>
    </AbsoluteFill>
  );
};
