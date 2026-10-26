import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { Steps } from "./scenes/Steps";
import { Outro } from "./scenes/Outro";

export const FPS = 30;
export const DURATION = 480; // 16 s

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b1220", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Sequence durationInFrames={90}>
        <Intro />
      </Sequence>
      <Sequence from={90} durationInFrames={270}>
        <Steps />
      </Sequence>
      <Sequence from={360} durationInFrames={120}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
