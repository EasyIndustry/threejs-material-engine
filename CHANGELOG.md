# Cambios

## 0.1.0

Primera versión.

- La definición de un material como datos (`defineMaterial`): los canales PBR de un CAD, cada
  uno con un valor y una pila de capas de mapas; capas de material con máscara encima; los
  números del material (`alphaMode`, `resolution`, `bumpStrength`, `ior`…). Atajos (un valor, un
  array de capas, una URL) y errores que dicen dónde.
- `planMaterial`: qué canal queda constante y cuál se hornea, con sus pasos. Las capas de
  material sin máscara y constantes se resuelven sin hornear (mezcla en lineal).
- `hashMaterial`: igual definición escrita distinto, igual hash.
- Modos de fusión: normal, multiply, add, subtract, screen, overlay, darken, lighten,
  difference, en JS y en GLSL.
- Generadores `noise`, `cells`, `checker`, `brushed`, `grain`, `dots`, `tiles`, `gradient`, y
  `registerGenerator` para los de una app: GLSL que llena una superficie, en espacio UV o como
  textura sólida 3D (con su plano, su vértice y sus uniforms calculados en JS).
- `createMaterialEngine(renderer)`: hornea en la GPU (sobremuestreo de los generadores,
  composición en lineal con targets sRGB para los colores, relieve a normal) y arma el
  `MeshPhysicalMaterial`. Caché por hash, `exportBaked` / `loadBaked`, `release`, `stats`,
  `help`.
