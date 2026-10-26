import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame: frame - 10, fps, config: { damping: 11, stiffness: 200 } });
  const text = spring({ frame: frame - 30, fps, config: { damping: 15 } });
  const sub = spring({ frame: frame - 45, fps, config: { damping: 15 } });
  const r = interpolate(pop, [0, 1], [0, 90]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(ellipse at 70% 80%, #134e4a 0%, #0b1220 60%)",
      }}
    >
      {/* Check animé */}
      <svg width={180} height={180} viewBox="0 0 100 100" style={{ transform: `scale(${0.5 + pop * 0.5})` }}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="#14b8a6" strokeWidth="6" opacity={pop} />
        <path
          d="M30 52 L45 66 L72 38"
          fill="none"
          stroke="#5eead4"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100"
          strokeDashoffset={100 - r}
        />
      </svg>
      <div style={{ fontSize: 72, fontWeight: 800, color: "#f8fafc", opacity: text, transform: `translateY(${(1 - text) * 40}px)`, marginTop: 30 }}>
        Vente encaissée
      </div>
      <div style={{ fontSize: 38, color: "#94a3b8", opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`, marginTop: 14 }}>
        Le ticket s'imprime — le stock est déduit automatiquement
      </div>
    </AbsoluteFill>
  );
};
