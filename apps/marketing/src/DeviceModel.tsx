import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useOffthreadVideoTexture } from "@remotion/three";
import { staticFile } from "remotion";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PhoneModel } from "./PhoneModel";

export type DeviceKind = "laptop" | "tablet" | "pixel" | "iphone";

/* Per-model config: url, which mesh is the screen, meshes to hide (glass/glare),
   upright rotation, fit height, and texture transform. Tuned via still renders. */
type Cfg = {
  url: string;
  isScreen: (matName: string, meshName: string) => boolean;
  hide: (matName: string, meshName: string) => boolean;
  rot: [number, number, number];
  fitH: number;
  mirrorX: boolean;
  flipY: boolean;
};
const CFG: Record<Exclude<DeviceKind, "iphone">, Cfg> = {
  laptop: {
    url: "models/macbook.glb",
    isScreen: (_m, mesh) => mesh === "ScreenImage",
    hide: () => false,
    rot: [0, 0, 0],
    fitH: 4.2,
    mirrorX: false,
    flipY: true,
  },
  tablet: {
    url: "models/ipad.glb",
    isScreen: (m) => m === "screen",
    hide: (m) => m === "glass",
    rot: [0, 0, 0],
    fitH: 4.4,
    mirrorX: true,
    flipY: false,
  },
  pixel: {
    url: "models/pixel.glb",
    isScreen: (m) => /m_DisplayW/.test(m),
    hide: (m) => m === "m_Glass",
    rot: [0, Math.PI, 0],
    fitH: 4.4,
    mirrorX: false,
    flipY: false,
  },
};

const loaderCache = new Map<string, THREE.Object3D>();
function useGlb(url: string): THREE.Object3D | null {
  const [obj, setObj] = useState<THREE.Object3D | null>(() => loaderCache.get(url) ?? null);
  useEffect(() => {
    if (loaderCache.has(url)) return;
    new GLTFLoader().load(staticFile(url), (g) => {
      loaderCache.set(url, g.scene);
      setObj(g.scene);
    });
  }, [url]);
  return obj;
}

const GlbDevice: React.FC<{ kind: Exclude<DeviceKind, "iphone">; video: string }> = ({
  kind,
  video,
}) => {
  const cfg = CFG[kind];
  const scene = useGlb(cfg.url);
  const tex = useOffthreadVideoTexture({ src: staticFile(video) });
  const gl = useThree((s) => s.gl);
  const rootScene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const screenMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    [],
  );

  const prepared = useMemo(() => {
    if (!scene) return null;
    const s = scene.clone(true);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const mn = (Array.isArray(mat) ? mat[0]?.name : mat?.name) ?? "";
      if (cfg.isScreen(mn, mesh.name)) mesh.material = screenMat;
      else if (cfg.hide(mn, mesh.name)) mesh.visible = false;
      else
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
          if (m) {
            m.side = THREE.FrontSide;
            m.depthWrite = true;
          }
        });
    });
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    return { object: s, center: c, fit: cfg.fitH / size.y };
  }, [scene, screenMat, cfg]);

  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.flipY = cfg.flipY;
    tex.center.set(0.5, 0.5);
    tex.wrapS = cfg.mirrorX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (cfg.mirrorX) {
      tex.repeat.x = -1;
      tex.offset.x = 1;
    }
    if (screenMat.map !== tex) {
      screenMat.map = tex;
      screenMat.needsUpdate = true;
    }
  }
  useEffect(() => {
    if (prepared && tex) gl.render(rootScene, camera);
  }, [prepared, tex, gl, rootScene, camera]);

  if (!prepared) return null;
  const { object, center, fit } = prepared;
  return (
    <group scale={fit}>
      <group rotation={cfg.rot}>
        <group position={[-center.x, -center.y, -center.z]}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  );
};

export const DeviceModel: React.FC<{
  kind: DeviceKind;
  video?: string;
  iphoneScene?: THREE.Object3D | null;
  iphoneTexture?: THREE.Texture | null;
}> = ({ kind, video, iphoneScene = null, iphoneTexture = null }) => {
  if (kind === "iphone")
    return <PhoneModel scene={iphoneScene} texture={iphoneTexture} brightness={1} />;
  return <GlbDevice kind={kind} video={video!} />;
};
