import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const PRODUCTS = [
  { at: 40, name: "DOLIPRANE 1000MG CP B/8", qty: 2, price: 1500 },
  { at: 110, name: "ASPEGIC 500MG SACHET B/20", qty: 1, price: 2450 },
  { at: 180, name: "BIOFAR MAGNESIUM B6 B/20", qty: 3, price: 5009 },
];

const CALLS = [
  { from: 0, to: 100, step: "Étape 1", text: "Scannez le code-barres ou recherchez le produit" },
  { from: 100, to: 175, step: "Étape 2", text: "La ligne s'ajoute — ajustez la quantité si besoin" },
  { from: 175, to: 240, step: "Étape 3", text: "Le total TTC se calcule automatiquement" },
  { from: 240, to: 270, step: "Ensuite", text: "Cliquez sur Encaisser pour choisir le paiement" },
];

const fmt = (n: number) => n.toLocaleString("fr-FR");

const Row: React.FC<{ p: (typeof PRODUCTS)[0]; i: number }> = ({ p, i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - p.at;
  const s = spring({ frame: local, fps, config: { damping: 15 } });
  const flash = interpolate(local, [0, 10, 25], [0.9, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (local < 0) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "18px 28px",
        fontSize: 26,
        color: "#e2e8f0",
        opacity: s,
        transform: `translateX(${(1 - s) * -40}px)`,
        background: `rgba(20,184,166,${flash})`,
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span>
        <span style={{ color: "#64748b", marginRight: 12 }}>{i + 1}</span>
        {p.name}
      </span>
      <span style={{ color: "#94a3b8" }}>×{p.qty}</span>
      <span style={{ fontWeight: 700 }}>{fmt(p.qty * p.price)} F</span>
    </div>
  );
};

const Callout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cur = CALLS.find((c) => frame >= c.from && frame < c.to) ?? CALLS[0];
  const s = spring({ frame: frame - cur.from, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 70,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        background: "#111c30",
        border: "1px solid #14b8a6",
        borderRadius: 16,
        padding: "20px 32px",
        maxWidth: 780,
      }}
    >
      <div style={{ color: "#5eead4", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>{cur.step}</div>
      <div style={{ color: "#f8fafc", fontWeight: 600, fontSize: 34 }}>{cur.text}</div>
    </div>
  );
};

export const Steps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inS = spring({ frame, fps, config: { damping: 18 } });
  const fade = interpolate(frame, [255, 269], [1, 0]);

  const total = PRODUCTS.reduce(
    (acc, p) => acc + (frame >= p.at ? p.qty * p.price : 0),
    0
  );
  // compteur animé : interpolation depuis la valeur précédente
  const shown = Math.round(
    PRODUCTS.reduce((acc, p) => {
      const t = interpolate(frame, [p.at, p.at + 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return acc + p.qty * p.price * t;
    }, 0)
  );

  return (
    <AbsoluteFill style={{ opacity: inS * fade, padding: 60, background: "#0b1220" }}>
      <div style={{ color: "#5eead4", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
        CAISSE — TICKET N° 4821
      </div>
      <div style={{ color: "#f8fafc", fontSize: 52, fontWeight: 800, marginBottom: 40 }}>
        Ajouter des produits au panier
      </div>

      <div
        style={{
          display: "flex",
          gap: 40,
          transform: `scale(${0.96 + inS * 0.04})`,
          transformOrigin: "top left",
        }}
      >
        {/* Fenêtre panier */}
        <div
          style={{
            width: 1180,
            borderRadius: 20,
            background: "#0f172a",
            border: "1px solid #1e293b",
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "16px 28px", background: "#111c30", color: "#94a3b8", fontSize: 22, display: "flex", justifyContent: "space-between" }}>
            <span>Produit</span>
            <span>Qté&nbsp;&nbsp;&nbsp;&nbsp;Montant</span>
          </div>
          {PRODUCTS.map((p, i) => (
            <Row key={p.name} p={p} i={i} />
          ))}
          <div style={{ height: 90 }} />
        </div>

        {/* Total */}
        <div
          style={{
            width: 420,
            borderRadius: 20,
            background: "#111c30",
            border: "1px solid #14b8a6",
            padding: 36,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            height: "fit-content",
          }}
        >
          <div style={{ color: "#94a3b8", fontSize: 24 }}>Total TTC</div>
          <div style={{ color: "#5eead4", fontSize: 64, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {fmt(shown)} F
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "18px 0",
              textAlign: "center",
              borderRadius: 12,
              background: frame >= 240 ? "#14b8a6" : "#1e293b",
              color: frame >= 240 ? "#042f2e" : "#64748b",
              fontSize: 28,
              fontWeight: 800,
              transition: "background 0.3s",
            }}
          >
            Encaisser
          </div>
        </div>
      </div>

      <Callout />
    </AbsoluteFill>
  );
};
