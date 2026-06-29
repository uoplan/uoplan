import React, { useEffect, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas, useOffthreadVideoTexture } from "@remotion/three";
import { ContactShadows } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Studio } from "./ThreePhone";
import { PhoneModel } from "./PhoneModel";

const PAPER = "#F7F5F2";

const useIphone = (): THREE.Object3D | null => {
  const [m, setM] = useState<THREE.Object3D | null>(null);
  const [handle] = useState(() => delayRender("spin-model"));
  useEffect(() => {
    new GLTFLoader().load(
      staticFile("models/iphone.glb"),
      (g) => {
        setM(g.scene);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle),
    );
  }, [handle]);
  return m;
};

const Stage: React.FC<{ iphone: THREE.Object3D | null }> = ({ iphone }) => {
  const tex = useOffthreadVideoTexture({ src: staticFile("videos/schedule-ios.mp4") });
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const yaw = (frame / durationInFrames) * Math.PI * 2; // one full turn
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 30, position: [0, 0, 9.5], near: 0.1, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.18;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Studio />
        <ContactShadows position={[0, -2.3, 0]} opacity={0.45} scale={9} blur={3} far={4.5} />
        <group rotation={[0.06, yaw, 0]} scale={1.4}>
          <PhoneModel scene={iphone} texture={tex ?? null} brightness={1} />
        </group>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const SpinTest: React.FC = () => {
  const iphone = useIphone();
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Stage iphone={iphone} />
    </AbsoluteFill>
  );
};
