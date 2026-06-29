import React, { useEffect, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  Audio,
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
import { DeviceModel } from "./DeviceModel";
import { SCENES, FLIP_AT, CUTS, CUT_HALF, OUTRO_START } from "./timeline.mjs";

const INK = "#111113";
const MUTED = "#6a6760";
const PAPER = "#F7F5F2";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const norm = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const eoCubic = (u: number) => 1 - Math.pow(1 - u, 3);
const rad = (d: number) => (d * Math.PI) / 180;

type Scene = (typeof SCENES)[number];
const sceneAt = (t: number): Scene | null =>
  (SCENES as Scene[]).find((s) => t >= s.start && t < s.end) ?? null;

/* ---------- background ---------- */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
const Background: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill
      style={{
        background: "radial-gradient(125% 95% at 50% 14%, #FFFFFF 0%, #F7F5F2 46%, #ECE8E1 100%)",
      }}
    />
    <AbsoluteFill
      style={{
        opacity: 0.5,
        backgroundImage: "radial-gradient(rgba(20,18,16,0.05) 1px, transparent 1.5px)",
        backgroundSize: "54px 54px",
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, #000 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, #000 30%, transparent 80%)",
      }}
    />
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, transparent 58%, rgba(20,18,16,0.05) 100%)",
      }}
    />
    <AbsoluteFill style={{ opacity: 0.04, mixBlendMode: "multiply", backgroundImage: GRAIN }} />
  </AbsoluteFill>
);

/* iPhone screen fed by a live clip + GLB body */
const IphoneStage: React.FC<{ scene: THREE.Object3D | null; video: string }> = ({
  scene,
  video,
}) => {
  const tex = useOffthreadVideoTexture({ src: staticFile(video) });
  return <PhoneModel scene={scene} texture={tex ?? null} brightness={1} />;
};

const Scene3D: React.FC<{ iphone: THREE.Object3D | null }> = ({ iphone }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const sc = sceneAt(t);
  const u = sc ? norm(t, sc.start, sc.end) : 0;
  const p = sc?.pose;
  const s = p ? p.s * lerp(0.99, 1.035, u) : 0.5;
  const x = p?.x ?? 999;
  const y = (p?.y ?? 0) + u * 0.1;
  const shadowY = y - 2.0 * s - 0.12;
  // Little 360 on the handed-off devices: hold ~1s, then one smooth eased turn
  // to flash the full body, landing back at the pose yaw.
  const local = sc ? t - sc.start : 0;
  const isDevice =
    sc &&
    (sc.device.kind === "pixel" || sc.device.kind === "iphone" || sc.device.kind === "tablet");
  const spin = isDevice ? 360 * eoCubic(norm(local, 1.0, 2.6)) : 0;
  const yaw = (p?.yaw ?? 0) + spin;

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 30, position: [0, 0, 9.5], near: 0.1, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Studio />
        <ContactShadows
          position={[x, shadowY, 0]}
          opacity={0.5}
          scale={9}
          blur={3}
          far={4.5}
          resolution={512}
          color="#1a1714"
        />
        {sc && (
          <group rotation={[rad(p.tilt), rad(yaw), rad(p.roll)]} position={[x, y, 0]} scale={s}>
            {sc.device.kind === "iphone" ? (
              <IphoneStage scene={iphone} video={sc.device.video} />
            ) : (
              <DeviceModel kind={sc.device.kind as any} video={sc.device.video} />
            )}
          </group>
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/* flip word */
const FlipWord: React.FC<{ words: string[]; local: number; size: number; align: string }> = ({
  words,
  local,
  size,
  align,
}) => {
  let idx = 0;
  for (let i = 0; i < FLIP_AT.length; i++) if (local >= FLIP_AT[i]) idx = i + 1;
  idx = Math.min(idx, words.length - 1);
  const slotStart = idx === 0 ? 0 : FLIP_AT[idx - 1];
  const tr = eoCubic(norm(local - slotStart, 0, 0.32));
  const cell: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: "DM Serif",
    fontSize: size,
    lineHeight: 1.0,
    color: INK,
    letterSpacing: "-0.015em",
    textAlign: align as any,
    willChange: "transform, opacity, filter",
  };
  return (
    <div style={{ position: "relative", height: size * 1.12, width: "100%", overflow: "hidden" }}>
      {idx > 0 && tr < 1 && (
        <span
          style={{
            ...cell,
            top: `${-tr * 0.62}em`,
            opacity: 1 - tr,
            filter: tr > 0.02 ? `blur(${tr * 10}px)` : "none",
          }}
        >
          {words[idx - 1]}
        </span>
      )}
      <span
        style={{
          ...cell,
          top: `${(1 - tr) * 0.62}em`,
          opacity: tr,
          filter: tr < 0.98 ? `blur(${(1 - tr) * 10}px)` : "none",
        }}
      >
        {words[idx]}
      </span>
    </div>
  );
};

const SceneText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out: React.ReactNode[] = [];
  (SCENES as Scene[]).forEach((sc, ci) => {
    const sF = Math.round(sc.start * fps);
    const eF = Math.round(sc.end * fps);
    if (frame < sF || frame >= eF) return;
    const local = (frame - sF) / fps;
    const dur = sc.end - sc.start;
    const intro = eoCubic(norm(local, 0, 0.55));
    const outro = norm(local, dur - 0.4, dur);
    const groupOp = clamp(intro, 0, 1) * (1 - outro);
    const tx = sc.text as any;
    let transform = "";
    if (tx.anim === "slideR") transform = `translateX(${(1 - intro) * 90}px)`;
    else if (tx.anim === "slideL") transform = `translateX(${(1 - intro) * -90}px)`;
    else if (tx.anim === "fade") transform = `scale(${lerp(0.92, 1, intro)})`;
    else transform = `translateY(${(1 - intro) * 48}px)`;
    const side = tx.side;
    const place = tx.place ?? "below";
    const align = side === "right" ? "right" : side === "left" ? "left" : "center";
    const base: React.CSSProperties = {
      position: "absolute",
      display: "flex",
      flexDirection: "column",
      willChange: "transform, opacity",
    };
    let container: React.CSSProperties;
    if (side === "left")
      container = {
        ...base,
        left: 150,
        top: 0,
        bottom: 0,
        width: 760,
        alignItems: "flex-start",
        justifyContent: "center",
      };
    else if (side === "right")
      container = {
        ...base,
        right: 150,
        top: 0,
        bottom: 0,
        width: 760,
        alignItems: "flex-end",
        justifyContent: "center",
      };
    else if (place === "over")
      container = { ...base, inset: 0, alignItems: "center", justifyContent: "center" };
    else
      container = {
        ...base,
        left: 0,
        right: 0,
        bottom: 84,
        height: 180,
        alignItems: "center",
        justifyContent: "center",
      };
    out.push(
      <div key={ci} style={{ ...container, opacity: groupOp, transform }}>
        <div
          style={{
            fontFamily: "DM Mono Medium",
            fontSize: 31,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
            opacity: intro,
            marginBottom: 12,
          }}
        >
          {tx.pre}
        </div>
        <FlipWord
          words={tx.flip}
          local={local}
          size={side === "center" ? 124 : 132}
          align={align}
        />
      </div>,
    );
  });
  return <>{out}</>;
};

const Dissolve: React.FC<{ t: number }> = ({ t }) => {
  let op = 0;
  for (const b of CUTS as number[]) {
    const d = Math.abs(t - b);
    if (d < CUT_HALF) op = Math.max(op, 1 - d / CUT_HALF);
  }
  if (t < (CUTS as number[])[0]) op = 1;
  if (op <= 0.001) return null;
  return <AbsoluteFill style={{ background: PAPER, opacity: op }} />;
};

const MiniMark: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 76,
        top: 60,
        fontFamily: "DM Mono Medium",
        fontSize: 30,
        letterSpacing: "0.04em",
        color: INK,
        opacity,
      }}
    >
      uoplan.party
    </div>
  );
};

const ColdOpen: React.FC<{ t: number }> = ({ t }) => {
  if (t > 2.5) return null;
  const a = eoCubic(norm(t, 0.2, 1.0)) * (1 - norm(t, 1.9, 2.4));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: "DM Serif",
          fontSize: 130,
          color: INK,
          textAlign: "center",
          opacity: a,
          transform: `translateY(${(1 - a) * 22}px)`,
        }}
      >
        your degree, planned.
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ t: number }> = ({ t }) => {
  const start = OUTRO_START;
  if (t < start - 0.1) return null;
  const a = (d: number) => eoCubic(norm(t, start + d, start + d + 0.7));
  const ulW = eoCubic(norm(t, start + 0.9, start + 1.7));
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}
    >
      <div
        style={{
          fontFamily: "DM Serif",
          fontSize: 132,
          color: INK,
          textAlign: "center",
          opacity: a(0),
          transform: `translateY(${(1 - a(0)) * 26}px)`,
        }}
      >
        every device, planned.
      </div>
      <div style={{ marginTop: 40, opacity: a(0.35) }}>
        <div
          style={{
            fontFamily: "DM Mono Medium",
            fontSize: 60,
            color: INK,
            letterSpacing: "0.04em",
            textAlign: "center",
            transform: `translateY(${(1 - a(0.35)) * 18}px)`,
          }}
        >
          uoplan.party
        </div>
        <div
          style={{
            height: 3,
            width: 360,
            margin: "20px auto 0",
            background: INK,
            transform: `scaleX(${ulW})`,
            transformOrigin: "center",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 46,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "DM Mono",
          fontSize: 19,
          letterSpacing: "0.04em",
          color: MUTED,
          opacity: a(1.6),
        }}
      >
        iPhone 17 Pro by Ranguel · CC BY 4.0
      </div>
    </AbsoluteFill>
  );
};

const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const defs: [string, string][] = [
      ["DM Serif", "fonts/DMSerifDisplay-Regular.ttf"],
      ["DM Mono", "fonts/DMMono-Regular.ttf"],
      ["DM Mono Medium", "fonts/DMMono-Medium.ttf"],
    ];
    Promise.all(
      defs.map(([n, p]) =>
        new FontFace(n, `url(${staticFile(p)})`).load().then((ff) => document.fonts.add(ff)),
      ),
    )
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

const useIphoneModel = (): THREE.Object3D | null => {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [handle] = useState(() => delayRender("model-file"));
  useEffect(() => {
    new GLTFLoader().load(
      staticFile("models/iphone.glb"),
      (g) => {
        setModel(g.scene);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle),
    );
  }, [handle]);
  return model;
};

export const Launch: React.FC = () => {
  useFonts();
  const iphone = useIphoneModel();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const miniOp = clamp(norm(t, 2.4, 3.1) - norm(t, OUTRO_START - 0.7, OUTRO_START - 0.1), 0, 1);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Audio src={staticFile("master.wav")} />
      <Background />
      <Scene3D iphone={iphone} />
      <SceneText />
      <Dissolve t={t} />
      <ColdOpen t={t} />
      <MiniMark opacity={miniOp} />
      <Outro t={t} />
    </AbsoluteFill>
  );
};
