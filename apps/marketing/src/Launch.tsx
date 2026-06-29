import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { ThreeCanvas } from "@remotion/three";
import { ContactShadows } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Studio } from "./ThreePhone";
import { PhoneModel } from "./PhoneModel";
import { SCREENS, SCENES, FLIP_AT, CUTS, CUT_HALF, OUTRO_START } from "./timeline.mjs";

/* ---------- palette (light) ---------- */
const INK = "#111113"; // near-black headings
const MUTED = "#6a6760"; // warm grey for the lead-in / secondary text
const PAPER = "#F7F5F2"; // backdrop tone — also the cross-dissolve colour

/* ---------- math ---------- */
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const norm = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const eoCubic = (u: number) => 1 - Math.pow(1 - u, 3);
const rad = (deg: number) => (deg * Math.PI) / 180;

type Pose = {
  x: number;
  y: number;
  z: number;
  s: number;
  ry: number; // yaw
  rx: number; // tilt
  rz: number; // roll
  screenIdx: number;
  brightness: number;
};

const OFFSCREEN: Pose = {
  x: 999,
  y: 0,
  z: 0,
  s: 0.5,
  ry: 0,
  rx: 0,
  rz: 0,
  screenIdx: 0,
  brightness: 0,
};

// Each scene holds a FIXED, composed product pose. The phone never turns or reverses
// direction — the only motion is a slow, monotonic dolly-in (scale creeps up) plus a
// barely-there upward drift, so the shot feels alive but locked, like an app ad. Cuts
// between shots are handled by the cross-dissolve overlay, so brightness stays at 1.
function scenePose(t: number): Pose {
  for (const sc of SCENES as any[]) {
    if (t < sc.start || t >= sc.end) continue;
    const p = sc.pose as {
      yaw: number;
      tilt: number;
      roll: number;
      x: number;
      y: number;
      s: number;
    };
    const u = norm(t, sc.start, sc.end); // 0..1 across the shot
    return {
      x: p.x,
      y: p.y + u * 0.1, // slow, single-direction drift up
      z: 0,
      s: p.s * lerp(0.99, 1.035, u), // slow push-in
      ry: p.yaw,
      rx: p.tilt,
      rz: p.roll,
      screenIdx: sc.screen,
      brightness: 1,
    };
  }
  return OFFSCREEN;
}

/* ---------- background (DOM, light) ---------- */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const Background: React.FC = () => (
  <AbsoluteFill>
    {/* warm paper base with a gentle top light for depth */}
    <AbsoluteFill
      style={{
        background: "radial-gradient(125% 95% at 50% 14%, #FFFFFF 0%, #F7F5F2 46%, #ECE8E1 100%)",
      }}
    />
    {/* faint dot grid (dark dots), masked to the centre — texture, no floating blobs */}
    <AbsoluteFill
      style={{
        opacity: 0.5,
        backgroundImage: "radial-gradient(rgba(20,18,16,0.05) 1px, transparent 1.5px)",
        backgroundSize: "54px 54px",
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, #000 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 46%, #000 30%, transparent 80%)",
      }}
    />
    {/* soft floor wash to ground the phone's contact shadow */}
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, transparent 58%, rgba(20,18,16,0.05) 100%)",
      }}
    />
    {/* very subtle grain */}
    <AbsoluteFill style={{ opacity: 0.04, mixBlendMode: "multiply", backgroundImage: GRAIN }} />
  </AbsoluteFill>
);

/* ---------- 3D scene (Three.js) ---------- */
const Scene3D: React.FC<{
  textures: (THREE.Texture | null)[];
  model: THREE.Object3D | null;
  onReady?: () => void;
}> = ({ textures, model, onReady }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const pose = scenePose(t);
  // Ground the phone with a soft contact shadow that sits just BELOW the device for
  // the current pose (the model is MODEL_FIT_HEIGHT≈4 tall at scale 1, so half-height
  // is ~2·s). A single fixed plane used to slice through the phone whenever it sat low
  // in frame; tracking it under the device keeps the shadow attached, never crossing it.
  const shadowY = pose.y - 2.0 * pose.s - 0.12;

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
          position={[pose.x, shadowY, 0]}
          opacity={0.5}
          scale={9}
          blur={3}
          far={4.5}
          resolution={512}
          color="#1a1714"
        />
        <group
          rotation={[rad(pose.rx), rad(pose.ry), rad(pose.rz)]}
          position={[pose.x, pose.y, pose.z]}
          scale={pose.s}
        >
          <PhoneModel
            scene={model}
            texture={textures[pose.screenIdx]}
            brightness={pose.brightness}
            onReady={onReady}
          />
        </group>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/* ---------- flip word (odometer-style roll through alternatives) ---------- */
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
  const tr = eoCubic(norm(local - slotStart, 0, 0.32)); // 0->1 roll progress

  const cell: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: "DM Serif",
    fontSize: size,
    lineHeight: 1.0,
    color: INK,
    letterSpacing: "-0.015em",
    textAlign: align as React.CSSProperties["textAlign"],
    willChange: "transform, opacity, filter",
  };

  return (
    <div style={{ position: "relative", height: size * 1.12, width: "100%", overflow: "hidden" }}>
      {idx > 0 && tr < 1 && (
        <span
          style={{
            ...cell,
            top: `${-tr * 0.62}em`, // outgoing rolls up & out
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
          top: `${(1 - tr) * 0.62}em`, // incoming rolls up from below
          opacity: tr,
          filter: tr < 0.98 ? `blur(${(1 - tr) * 10}px)` : "none",
        }}
      >
        {words[idx]}
      </span>
    </div>
  );
};

/* ---------- scene captions (placed beside / over the phone, per shot) ---------- */
const SceneText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out: React.ReactNode[] = [];

  (SCENES as any[]).forEach((sc, ci) => {
    const sF = Math.round(sc.start * fps);
    const eF = Math.round(sc.end * fps);
    if (frame < sF || frame >= eF) return;
    const local = (frame - sF) / fps;
    const dur = sc.end - sc.start;
    const intro = eoCubic(norm(local, 0, 0.55));
    const outro = norm(local, dur - 0.4, dur);
    const groupOp = clamp(intro, 0, 1) * (1 - outro);

    // A small, distinct, single-direction caption entrance per scene (no settle-back).
    let transform = "";
    if (sc.text.anim === "slideR") {
      transform = `translateX(${(1 - intro) * 90}px)`;
    } else if (sc.text.anim === "slideL") {
      transform = `translateX(${(1 - intro) * -90}px)`;
    } else if (sc.text.anim === "fade") {
      transform = `scale(${lerp(0.92, 1, intro)})`;
    } else {
      transform = `translateY(${(1 - intro) * 48}px)`;
    }

    const side = sc.text.side as string;
    const place = (sc.text.place as string) ?? "below";
    const align = side === "right" ? "right" : side === "left" ? "left" : "center";
    const base: React.CSSProperties = {
      position: "absolute",
      display: "flex",
      flexDirection: "column",
      willChange: "transform, opacity",
    };
    let container: React.CSSProperties;
    if (side === "left") {
      container = {
        ...base,
        left: 150,
        top: 0,
        bottom: 0,
        width: 820,
        alignItems: "flex-start",
        justifyContent: "center",
        textAlign: "left",
      };
    } else if (side === "right") {
      container = {
        ...base,
        right: 150,
        top: 0,
        bottom: 0,
        width: 820,
        alignItems: "flex-end",
        justifyContent: "center",
        textAlign: "right",
      };
    } else if (place === "over") {
      container = {
        ...base,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      };
    } else {
      container = {
        ...base,
        left: 0,
        right: 0,
        bottom: 84,
        height: 180,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      };
    }

    const flipSize = side === "center" ? 124 : 132;

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
          {sc.text.pre}
        </div>
        <FlipWord words={sc.text.flip} local={local} size={flipSize} align={align} />
      </div>,
    );
  });

  return <>{out}</>;
};

/* ---------- cross-dissolve (quick cut through the paper backdrop) ---------- */
const Dissolve: React.FC<{ t: number }> = ({ t }) => {
  let op = 0;
  for (const b of CUTS as number[]) {
    const d = Math.abs(t - b);
    if (d < CUT_HALF) op = Math.max(op, 1 - d / CUT_HALF);
  }
  if (t < (CUTS as number[])[0]) op = 1; // hold paper before the opening reveal
  if (op <= 0.001) return null;
  return <AbsoluteFill style={{ background: PAPER, opacity: op }} />;
};

/* ---------- mini wordmark ---------- */
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

/* ---------- outro ---------- */
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
          lineHeight: 1.02,
          color: INK,
          textAlign: "center",
          opacity: a(0),
          transform: `translateY(${(1 - a(0)) * 26}px)`,
        }}
      >
        your degree, planned.
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
      {/* model attribution — small, low, late */}
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

/* ---------- fonts ---------- */
const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const defs: [string, string][] = [
      ["DM Serif", "fonts/DMSerifDisplay-Regular.ttf"],
      ["DM Mono", "fonts/DMMono-Regular.ttf"],
      ["DM Mono Medium", "fonts/DMMono-Medium.ttf"],
    ];
    Promise.all(
      defs.map(([name, path]) => {
        const f = new FontFace(name, `url(${staticFile(path)})`);
        return f.load().then((ff) => document.fonts.add(ff));
      }),
    )
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

/* ---------- screen textures ---------- */
const useScreenTextures = (): (THREE.Texture | null)[] => {
  const [tex, setTex] = useState<(THREE.Texture | null)[]>([null, null, null, null]);
  const [handle] = useState(() => delayRender("textures"));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    Promise.all(
      SCREENS.map(
        (name: string) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(
              staticFile(`assets/${name}.png`),
              (tx) => {
                tx.colorSpace = THREE.SRGBColorSpace;
                tx.anisotropy = 8;
                tx.needsUpdate = true;
                resolve(tx);
              },
              undefined,
              reject,
            );
          }),
      ),
    )
      .then((list) => {
        setTex(list);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
  return tex;
};

/* ---------- iPhone GLB ---------- */
const useIphoneModel = (): THREE.Object3D | null => {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [handle] = useState(() => delayRender("model-file"));
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      staticFile("models/iphone.glb"),
      (gltf) => {
        setModel(gltf.scene);
        continueRender(handle);
      },
      undefined,
      () => continueRender(handle),
    );
  }, [handle]);
  return model;
};

/* ---------- composition ---------- */
export const Launch: React.FC = () => {
  useFonts();
  const textures = useScreenTextures();
  const model = useIphoneModel();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Resolved by PhoneModel's effect once the model primitive is committed to
  // the canvas — fixes the still-render commit-lag (screenshot before mount).
  const [onscreen] = useState(() => delayRender("phone-onscreen"));
  const continued = useRef(false);
  const onReady = useCallback(() => {
    if (continued.current) return;
    continued.current = true;
    continueRender(onscreen);
  }, [onscreen]);

  // The top-left wordmark fades in with the first shot and holds steadily through the
  // body (it sits above the cross-dissolve so cuts don't make it blink), fading out
  // only as the outro — which shows "uoplan.party" big — takes over.
  const miniOp = clamp(norm(t, 1.0, 1.7) - norm(t, OUTRO_START - 0.7, OUTRO_START - 0.1), 0, 1);

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Audio src={staticFile("master.wav")} />
      <Background />
      <Scene3D textures={textures} model={model} onReady={onReady} />
      <SceneText />
      <Dissolve t={t} />
      <MiniMark opacity={miniOp} />
      <Outro t={t} />
    </AbsoluteFill>
  );
};
