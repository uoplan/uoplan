import React, { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ---------- tunables (orientation / fit of the real GLB) ---------- */
// The loaded glTF scene is already upright (GLTFLoader bakes the Sketchfab
// Z-up→Y-up root rotation): height on Y, width on X, screen normal on +Z.
export const MODEL_FIT_HEIGHT = 4.0;
// Screen (OLED) faces +Z in the loaded model; rest pose looks down -Z, so a
// 180° Y flip turns the display toward the camera.
const MODEL_ROT: [number, number, number] = [0, Math.PI, 0];
const TEX_FLIP_Y = false;
// The 180° Y flip makes us view the screen UVs from behind, mirroring the app;
// negating U un-mirrors it so text reads correctly.
const TEX_MIRROR_X = true;
const TEX_ROT = 0; // radians
const TEX_CENTER: [number, number] = [0.5, 0.5];

function orientTexture(tex: THREE.Texture) {
  if ((tex as { __oriented?: boolean }).__oriented) return;
  tex.flipY = TEX_FLIP_Y;
  tex.center.set(TEX_CENTER[0], TEX_CENTER[1]);
  tex.rotation = TEX_ROT;
  tex.wrapS = TEX_MIRROR_X ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (TEX_MIRROR_X) {
    tex.repeat.x = -1;
    tex.offset.x = 1;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  (tex as { __oriented?: boolean }).__oriented = true;
}

export const PhoneModel: React.FC<{
  scene: THREE.Object3D | null;
  texture: THREE.Texture | null;
  brightness: number;
  onReady?: () => void;
}> = ({ scene, texture, brightness, onReady }) => {
  const screenMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        color: new THREE.Color(0, 0, 0),
        // Depth-correct (was depthTest:false + renderOrder 999, which painted the
        // app on top of EVERYTHING — so the raised side rails / volume buttons
        // appeared to bleed "through" the screen when the phone turned). With real
        // depth testing the body occludes (and is occluded by) the display at every
        // angle. A tiny polygon offset keeps it from z-fighting the matte bezel
        // sitting just behind it.
        transparent: false,
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        // BackSide: after the 180° flip, the screen's back face points at the
        // camera on front views (shows the app) and is culled on back/spin
        // views (so the app never bleeds onto the phone's rear shell).
        side: THREE.BackSide,
      }),
    [],
  );

  const prepared = useMemo(() => {
    if (!scene) return null;
    const s = scene.clone(true);
    s.updateMatrixWorld(true);

    // The GLB ships EVERY material as doubleSided=true; several are alphaMode=BLEND.
    // Double-sided back-faces on the solid body shell are what let the far-side volume
    // buttons / charging port / side rails bleed "through" the bezel at 3/4 angles.
    // Hardening every kept material to single-sided, depth-correct, fully-opaque
    // rendering makes the body occlude properly so nothing shows through.
    const harden = (m: THREE.Material) => {
      m.side = THREE.FrontSide;
      m.depthTest = true;
      m.depthWrite = true;
      m.transparent = false;
      (m as THREE.Material & { opacity?: number }).opacity = 1;
      m.needsUpdate = true;
    };

    s.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const name = Array.isArray(mat) ? mat[0]?.name : mat?.name;
      if (name === "OLED") {
        mesh.material = screenMat;
      } else if (name === "OLED_off") {
        mesh.visible = false;
      } else if (name === "Glass") {
        // Front cover glass: roughness 0 + transmission 1 makes it a perfect mirror
        // of the studio softboxes — that hard rectangle reads as fake "glare" on the
        // screen. Hide it; the unlit OLED already draws the app crisply on top.
        mesh.visible = false;
      } else if (
        name === "Plastic_LED" ||
        name === "Camera_Lens" ||
        name === "Camera_sapphire_miror" ||
        name === "Camera_filter" ||
        name === "Camera_mirror_filter" ||
        name === "Display_Frame"
      ) {
        // Dynamic-Island front camera + bezel. The stock materials are shiny
        // (a bright white LED / a mirror-smooth sapphire lens) so a reflective
        // "camera ring" shows through. Force flat matte near-black so the island
        // reads as one solid black pill and the bezel doesn't catch hotspots.
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x050505),
          metalness: 0,
          roughness: 0.94,
        });
      } else if (mat) {
        // Body, rails, buttons, port, antenna, back glass, camera plate: keep their
        // stock look but cull back-faces and enforce depth so they read as a solid.
        (Array.isArray(mat) ? mat : [mat]).forEach(harden);
      }
    });
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const fit = MODEL_FIT_HEIGHT / size.y;
    return { object: s, center, fit };
  }, [scene, screenMat]);

  if (texture) {
    orientTexture(texture);
    if (screenMat.map !== texture) {
      screenMat.map = texture;
      screenMat.needsUpdate = true;
    }
  }
  screenMat.color.setScalar(brightness);

  const gl = useThree((s) => s.gl);
  const rootScene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  // r3f draws once per Remotion frame; the model attaches via an async re-render
  // AFTER that draw, so we force a synchronous redraw (preserveDrawingBuffer keeps
  // it for the screenshot) once the primitive is committed, then release the gate.
  useEffect(() => {
    if (!prepared) return;
    gl.render(rootScene, camera);
    onReady?.();
  }, [prepared, gl, rootScene, camera, onReady, texture, brightness]);

  if (!prepared) return null;
  const { object, center, fit } = prepared;
  return (
    <group scale={fit}>
      <group rotation={MODEL_ROT}>
        {/* Center the raw model at the pivot BEFORE rotating so the device spins
            about its own centroid — not an offset origin. (Centering outside the
            rotation left the pivot displaced by the camera-bump offset, which made
            the phone swing around a weird point.) */}
        <group position={[-center.x, -center.y, -center.z]}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  );
};
