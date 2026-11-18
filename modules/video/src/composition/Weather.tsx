// Rain or snow falling through a volume: one instanced mesh, every drop's place a pure function of the frame. Used by
// dioramas (ADR 0021) and by sets with `Shot.fx` (ADR 0022).
import { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";

export type WeatherArea = { w: number; back: number; front: number; y0: number; h: number }; // metres, x centred on 0

export function Weather({
  kind,
  lf,
  seed,
  area,
}: {
  kind: "rain" | "snow";
  lf: number;
  seed: string;
  area: WeatherArea;
}) {
  const depth = area.front - area.back;
  // about two drops per square metre of ground; capped so a wide outdoor set stays one cheap draw call
  const n = Math.min(1200, Math.max(120, Math.round(area.w * depth * (kind === "rain" ? 2.2 : 1.8))));
  const mesh = useMemo(() => {
    const geo = kind === "rain" ? new THREE.BoxGeometry(0.02, 0.45, 0.02) : new THREE.SphereGeometry(0.035, 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: kind === "rain" ? "#dfe8f2" : "#ffffff", // ds-allow-hardcode: scene paint, not UI theme
      transparent: true,
      opacity: 0.8,
    });
    return new THREE.InstancedMesh(geo, mat, n);
  }, [kind, n]);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = (random(`${seed}wx${i}`) - 0.5) * area.w;
    const z = area.front - random(`${seed}wz${i}`) * depth;
    const fall = kind === "rain" ? 0.42 : 0.035;
    const y = (((random(`${seed}wy${i}`) * area.h - lf * fall) % area.h) + area.h) % area.h;
    const drift = kind === "snow" ? Math.sin(lf / 20 + i) * 0.3 : 0;
    m.makeTranslation(x + drift, area.y0 + y, z);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
}
