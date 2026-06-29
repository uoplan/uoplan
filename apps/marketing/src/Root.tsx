import { Composition } from "remotion";
import { Launch } from "./Launch";
import { SpinTest } from "./SpinTest";
import { FPS, DURATION_S, WIDTH, HEIGHT } from "./timeline.mjs";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Launch"
        component={Launch}
        durationInFrames={Math.round(FPS * DURATION_S)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SpinTest"
        component={SpinTest}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
