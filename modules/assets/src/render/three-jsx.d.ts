// react-three-fiber v9: register <mesh>, <group>, ... as JSX intrinsic elements.
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
