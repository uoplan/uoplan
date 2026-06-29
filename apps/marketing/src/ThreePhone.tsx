import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox, Environment, Lightformer } from "@react-three/drei";

/* ---------- phone dimensions (iPhone-ish proportions, units) ---------- */
const W = 1.42;
const H = 2.92;
const D = 0.18;
const FRAME_R = 0.2;
const SCREEN_ASPECT = 1206 / 2622; // w/h of the captured screenshots
const SCREEN_H = 2.72;
const SCREEN_W = SCREEN_H * SCREEN_ASPECT; // ~1.25
const GLASS_W = W - 0.05;
const GLASS_H = H - 0.05;

/* rounded-rect plane geometry with normalized [0,1] UVs */
function roundedPlane(w: number, h: number, r: number, seg = 18): THREE.BufferGeometry {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, seg);
  const pos = g.attributes.position;
  const uv: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    uv.push((pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

const TITANIUM = "#45454c";

/* ---------- the phone ---------- */
export const Phone: React.FC<{ texture: THREE.Texture | null; brightness: number }> = ({
  texture,
  brightness,
}) => {
  const glassGeo = useMemo(() => roundedPlane(GLASS_W, GLASS_H, FRAME_R - 0.02), []);
  const screenGeo = useMemo(() => roundedPlane(SCREEN_W, SCREEN_H, 0.16), []);
  const backGeo = useMemo(() => roundedPlane(GLASS_W, GLASS_H, FRAME_R - 0.02), []);
  const camPlateGeo = useMemo(() => roundedPlane(0.62, 0.62, 0.16), []);

  const frontZ = D / 2;
  const backZ = -D / 2;

  return (
    <group>
      {/* titanium frame / body */}
      <RoundedBox
        args={[W, H, D]}
        radius={FRAME_R}
        smoothness={6}
        steps={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={TITANIUM} metalness={1} roughness={0.34} />
      </RoundedBox>

      {/* black front glass (bezel) */}
      <mesh geometry={glassGeo} position={[0, 0, frontZ + 0.002]}>
        <meshPhysicalMaterial
          color="#050507"
          metalness={0.2}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </mesh>

      {/* the app screen — unlit so display colours stay true */}
      <mesh geometry={screenGeo} position={[0, 0, frontZ + 0.006]}>
        <meshBasicMaterial
          map={texture ?? undefined}
          color={new THREE.Color().setScalar(brightness)}
          toneMapped={false}
        />
      </mesh>

      {/* glass glare overlay (reflects the lightformers) */}
      <mesh geometry={screenGeo} position={[0, 0, frontZ + 0.012]}>
        <meshPhysicalMaterial
          transparent
          opacity={0.05}
          color="#ffffff"
          metalness={0}
          roughness={0.06}
          transmission={0}
          clearcoat={1}
          clearcoatRoughness={0.04}
          depthWrite={false}
        />
      </mesh>

      {/* back glass */}
      <mesh geometry={backGeo} position={[0, 0, backZ - 0.002]} rotation={[0, Math.PI, 0]}>
        <meshPhysicalMaterial
          color="#1b1b21"
          metalness={0.4}
          roughness={0.28}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* camera plate (top-left on the back) */}
      <group position={[-W / 2 + 0.5, H / 2 - 0.5, backZ - 0.03]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={camPlateGeo}>
          <meshPhysicalMaterial color="#2c2c34" metalness={0.5} roughness={0.32} clearcoat={0.5} />
        </mesh>
        {[
          [-0.13, 0.13],
          [0.13, 0.13],
          [0, -0.13],
        ].map(([lx, ly], i) => (
          <group key={i} position={[lx, ly, 0.03]}>
            <mesh>
              <cylinderGeometry args={[0.12, 0.12, 0.08, 32]} />
              <meshStandardMaterial color="#3a3a42" metalness={0.9} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.04, 32]} />
              <meshPhysicalMaterial
                color="#05060a"
                metalness={0.3}
                roughness={0.05}
                clearcoat={1}
                emissive={new THREE.Color(0x0a1830)}
                emissiveIntensity={0.4}
              />
            </mesh>
          </group>
        ))}
        {/* flash */}
        <mesh position={[0.17, -0.13, 0.02]}>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 24]} />
          <meshStandardMaterial color="#b8b29a" metalness={0.2} roughness={0.7} />
        </mesh>
      </group>

      {/* side buttons (right: power; left: volume + action) */}
      <RoundedBox
        args={[0.05, 0.5, 0.09]}
        radius={0.02}
        smoothness={3}
        position={[W / 2 + 0.005, 0.2, 0]}
      >
        <meshStandardMaterial color={TITANIUM} metalness={1} roughness={0.34} />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.32, 0.09]}
        radius={0.02}
        smoothness={3}
        position={[-W / 2 - 0.005, 0.55, 0]}
      >
        <meshStandardMaterial color={TITANIUM} metalness={1} roughness={0.34} />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.32, 0.09]}
        radius={0.02}
        smoothness={3}
        position={[-W / 2 - 0.005, 0.12, 0]}
      >
        <meshStandardMaterial color={TITANIUM} metalness={1} roughness={0.34} />
      </RoundedBox>
      <RoundedBox
        args={[0.05, 0.18, 0.09]}
        radius={0.02}
        smoothness={3}
        position={[-W / 2 - 0.005, 0.92, 0]}
      >
        <meshStandardMaterial color="#c08a4a" metalness={0.9} roughness={0.4} />
      </RoundedBox>
    </group>
  );
};

/* ---------- studio lighting + reflections (no network assets) ---------- */
export const Studio: React.FC = () => (
  <>
    <ambientLight intensity={0.3} />
    {/* Key: bright neutral white, upper front-right — carves the silver specular */}
    <directionalLight position={[5, 7, 6]} intensity={2.7} color="#ffffff" />
    {/* Cool rim from back-left for edge separation (subtle, not a colour cast) */}
    <directionalLight position={[-6, 3, -4]} intensity={1.0} color="#dfe4ea" />
    {/* Soft neutral fill from below-front to lift the lower shadows a touch */}
    <directionalLight position={[0, -3, 5]} intensity={0.5} color="#ffffff" />
    <Environment resolution={256}>
      <group rotation={[0, 0, 0]}>
        {/* Neutral studio softboxes on a dark field → soft metallic reflections.
            Kept large + moderate (not blown out) so the titanium reads silver
            without hard hotspots on the rails. */}
        <Lightformer
          form="rect"
          intensity={3.0}
          position={[4, 4, 5]}
          scale={[9, 12, 1]}
          color="#ffffff"
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[-5, 2, 3]}
          scale={[6, 11, 1]}
          color="#f2f1ee"
        />
        <Lightformer
          form="rect"
          intensity={1.8}
          position={[0, 5, -4]}
          scale={[12, 4, 1]}
          color="#ffffff"
        />
        {/* a soft neutral kicker to keep the lower edge alive */}
        <Lightformer
          form="ring"
          intensity={0.7}
          position={[3, -2, 4]}
          scale={1.6}
          color="#ffffff"
        />
      </group>
    </Environment>
  </>
);
