# threejs-material-engine

Materiales por capas para [three.js](https://threejs.org), como en un CAD. Un material es
**datos**: cada canal PBR tiene un valor y, si hace falta, una pila de **capas de mapas**
(imágenes o generadores procedurales, con modos de fusión, máscaras y transformación), y encima
van **capas de material** (barniz, pintura con raspones, suciedad) mezcladas por su máscara. El
motor lo hornea en la GPU y arma un `MeshPhysicalMaterial`.

```js
import { createMaterialEngine } from 'threejs-material-engine/three';

const materiales = createMaterialEngine(renderer);
const chapa = await materiales.material({
  name: 'Chapa pintada', resolution: 1024,
  channels: {
    baseColor: '#9b2d20',
    roughness: 0.45,
    bump: [{ generator: 'noise', params: { scale: 60 }, opacity: 0.3 }],
  },
  layers: [{                                   // raspones: deja ver el metal de abajo
    name: 'raspones',
    mask: { generator: 'noise', params: { scale: 5, octaves: 6 }, remap: [-30, 18.6] },
    channels: { baseColor: '#9aa0a6', metalness: 1, roughness: 0.28 },
  }],
});
mesh.material = chapa;
materiales.help();
```

- **Los canales de un CAD**: `baseColor` (difuso), `alpha` (con `alphaMode` opaque, mask o
  blend), `metalness`, `roughness`, `normal`, `bump`, `displacement`, `ao`, `emissive` (con
  `emissiveIntensity`; en el path tracer ilumina), `specularIntensity`, `specularColor`,
  `transmission`, `thickness`, `clearcoat`, `clearcoatRoughness`, `sheen`, `sheenColor`,
  `sheenRoughness`, `iridescence`, `anisotropy`. Más `ior`, `attenuationColor`, `doubleSided` y
  los demás números del material (`CHANNELS` y `SETTINGS`, en `src/channels.js`).
- **Capas de mapas**: cada capa es una fuente — `{ image }`, `{ generator, params }`,
  `{ color }` o `{ value }` — con `blend` (normal, multiply, add, subtract, screen, overlay,
  darken, lighten, difference), `opacity`, `mask`, `read` (qué canal de la fuente), `invert`,
  `remap`, `tint` y `transform` (`repeat`, `offset`, `rotation`, `wrap`).
- **Capas de material**: `layers: [{ name, mask, opacity, channels }]`, en orden. Sin máscara y
  con valores constantes se resuelven sin hornear.
- **Generadores**: `noise`, `cells`, `checker`, `brushed`, `grain`, `dots`, `tiles`, `gradient`.
  Una app agrega los suyos (sus **plugins**) con `registerGenerator`: GLSL que llena una
  superficie (color, alfa, rugosidad, metálico, altura, normal, emisivo, AO), en espacio UV o como
  textura **sólida 3D** (la veta de una madera calculada en el bloque).
- **Horneado en la GPU, una vez**: lo horneado se cachea por hash (la definición y las versiones
  de sus generadores). Con sobremuestreo para los generadores, y con exportación e importación
  de prehorneados (`exportBaked`, `loadBaked`).
- **Sin build**, módulos ES. **Núcleo puro**: `src/` no importa three ni el DOM; valida, planea y
  hashea en Node. three está en `adapters/three/`.

## Estructura

```
src/
  channels.js      los canales y los números del material, y su mapa de three
  material.js      defineMaterial (validar y normalizar), planMaterial, hashMaterial
  blend.js         los modos de fusión, en JS y en GLSL
  generators.js    el registro de generadores (y plugins) y los de fábrica
  help.js, members.js
adapters/three/
  engine.js        createMaterialEngine: el horneado y el MeshPhysicalMaterial
examples/          una página con materiales típicos
test/              las pruebas, en Node
```

## Un plugin

```js
materiales.registerGenerator({
  name: 'mi-app/madera', version: '1', space: 'solid',
  outputs: ['color', 'roughness', 'normal'],
  params: { especie: { type: 'string', default: 'pino' } },
  vertex: { pars: 'uniform mat4 uVeta; varying vec3 vVeta;', main: 'vVeta = (uVeta * vec4(position, 1.0)).xyz;' },
  fragment: `…GLSL de la app…
    void generate(inout Surface s) { s.color = madera(vVeta); s.roughness = 0.6; }`,
  uniforms: (params, { width, height, supersample }) => ({ uVeta: { value: matrizDe(params.especie) } }),
  plane: (params) => ({ corners: [[0, 0, 0], [120, 0, 0], [120, 30, 0], [0, 30, 0]], normal: [0, 0, 1] }),
});
// y se usa como cualquier generador:
{ channels: { baseColor: [{ generator: 'mi-app/madera', params: { especie: 'roble' } }] } }
```

Un generador **sólido** dice qué plano de su espacio cae sobre la textura (`plane`: las cuatro
esquinas, para uv (0,0), (1,0), (1,1) y (0,1)); el motor le pasa a cada texel su punto `vPos` y su
normal `vNrm`. Los parámetros number, int, bool y color llegan solos como uniforms `p_<nombre>`;
los demás los convierte la función `uniforms`, que se llama en cada horneado. Cambiar `version`
invalida lo horneado con él.

## Usarlo, sin build

```html
<script type="importmap">
  { "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
</script>
```

## Avisos

- **Desplazamiento** mueve vértices: en una caja de 12 triángulos no se ve. Va en mallas densas;
  para relieve fino, `bump` o `normal`. El path tracer de three-gpu-pathtracer no lo usa.
- **bump y normal** terminan en el mismo `normalMap` (three usa uno u otro): el relieve se hornea
  como normal y se suma al mapa de normales, con `bumpStrength`.
- Un generador `uv` no es periódico salvo que lo diga: con `repeat` se repite la textura horneada.

## Pruebas

```
node --test
```

Lo que se hornea se prueba a ojo en `examples/index.html` (por HTTP: `python3 -m http.server` en la
raíz y abrir `/examples/`).

## Licencia

MIT
