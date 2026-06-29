import { Composition } from "remotion";
import { Launch } from "./Launch";
import { FPS, DURATION_S, WIDTH, HEIGHT } from "./timeline.mjs";

export const RemotionRoot = () => {
  return (
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={Math.round(FPS * DURATION_S)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
