import { Composition } from "remotion";
import { Video, FPS, DURATION } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FormationVente"
      component={Video}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
