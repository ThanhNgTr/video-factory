// Drawn icons (SVG) as textures for the 3D cards (ADR 0018). <IconsReady> decodes every icon a video uses before the
// 3D canvas mounts (held with delayRender), so the first frame already has them and a card reads its texture
// synchronously. Data URIs only: nothing is fetched.
import { createElement, Fragment, type ReactNode, useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import * as THREE from "three";

type IconData = { id: string; svg: string };
const cache = new Map<string, THREE.Texture>(); // one per render tab, shared by every frame it renders
const PX = 512;

function decode(icon: IconData): Promise<void> {
  if (cache.has(icon.id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = PX;
      c.height = PX;
      c.getContext("2d")?.drawImage(img, 0, 0, PX, PX);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      cache.set(icon.id, t);
      resolve();
    };
    img.onerror = () => reject(new Error(`icon ${icon.id} could not be decoded`));
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(icon.svg)}`;
  });
}

// the texture of an icon decoded by <IconsReady>, or nothing
export const iconTexture = (icon?: IconData): THREE.Texture | undefined => (icon ? cache.get(icon.id) : undefined);

export function IconsReady({ icons, children }: { icons: IconData[]; children: ReactNode }) {
  const [ready, setReady] = useState(() => icons.every((i) => cache.has(i.id)));
  const [handle] = useState(() => (ready ? null : delayRender("decoding icons")));
  useEffect(() => {
    if (ready) return;
    // a broken drawing stops the render loudly instead of hanging it until the timeout
    Promise.all(icons.map(decode)).then(() => setReady(true), cancelRender);
  }, [icons, ready]);
  useEffect(() => {
    if (ready && handle !== null) continueRender(handle);
  }, [ready, handle]);
  return ready ? createElement(Fragment, null, children) : null;
}
