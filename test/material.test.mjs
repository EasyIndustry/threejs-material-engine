// Las pruebas en Node: lo puro (definición, plan, hash, fusión, generadores) y que la tabla de
// help() coincida con la API del adaptador. Lo que se hornea se prueba en un navegador
// (examples/index.html).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHANNELS, SETTINGS, OUTPUTS, isMappable, BLEND_MODES, blendValue, layerValue,
  defineMaterial, planMaterial, hashMaterial, generatorsOf, hexToLinear, linearToHex,
  registerGenerator, getGenerator, listGenerators, resolveParams, paramUniformsGLSL, ENGINE_MEMBERS, memberNames,
} from '../src/index.js';

const fuente = (f) => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('los canales de un CAD están todos, con su tipo y su mapa de three', () => {
  for (const c of ['baseColor', 'alpha', 'metalness', 'roughness', 'normal', 'bump', 'displacement', 'ao', 'emissive', 'transmission', 'clearcoat', 'sheen', 'specularColor']) assert.ok(CHANNELS[c], c);
  for (const [n, c] of Object.entries(CHANNELS)) {
    assert.ok(['color', 'scalar', 'normal'].includes(c.type), n);
    assert.ok(OUTPUTS.includes(c.output), `${n}.output`);
    if (c.type === 'color') assert.ok(c.srgb, `${n}: un color va en sRGB`);
  }
  assert.ok(isMappable('bump') && isMappable('baseColor') && !isMappable('thickness'));
});

test('defineMaterial: los atajos dan siempre la misma forma', () => {
  const d = defineMaterial({ channels: { baseColor: '#C33', roughness: 0.4, normal: 'n.png', bump: [{ generator: 'noise' }] } });
  assert.deepEqual(d.channels.baseColor, { value: '#c33', layers: [] });
  assert.deepEqual(d.channels.roughness, { value: 0.4, layers: [] });
  assert.equal(d.channels.normal.layers[0].source.url, 'n.png');
  assert.equal(d.channels.bump.layers[0].read, 'luminance');
  assert.equal(d.channels.bump.value, CHANNELS.bump.default);
  assert.deepEqual(d.resolution, [1024, 1024]);
  for (const k of Object.keys(SETTINGS)) assert.ok(k in d, k);
  assert.deepEqual(defineMaterial({ resolution: [512, 128] }).resolution, [512, 128]);
});

test('defineMaterial: un error dice dónde está', () => {
  assert.throws(() => defineMaterial({ channels: { colour: '#fff' } }), /canal desconocido: colour/);
  assert.throws(() => defineMaterial({ channels: { roughness: 2 } }), /channels\.roughness: roughness va de 0 a 1/);
  assert.throws(() => defineMaterial({ channels: { baseColor: 0.5 } }), /color/);
  assert.throws(() => defineMaterial({ channels: { roughness: [{ generator: 'noise', blend: 'fundido' }] } }), /channels\.roughness\[0\]\.blend/);
  assert.throws(() => defineMaterial({ channels: { roughness: [{ color: '#fff' }] } }), /es un número/);
  assert.throws(() => defineMaterial({ channels: { roughness: [{ image: 'a.png', generator: 'noise' }] } }), /una fuente, y solo una/);
  assert.throws(() => defineMaterial({ channels: { roughness: [{ value: 1, transform: { scale: 2 } }] } }), /transform: clave desconocida scale/);
  assert.throws(() => defineMaterial({ alphaMode: 'cutout' }), /alphaMode/);
  assert.throws(() => defineMaterial({ layers: [{ name: 'vacía' }] }), /sin canales no cambia nada/);
  assert.throws(() => defineMaterial({ brillo: 1 }), /clave desconocida: brillo/);
});

test('planMaterial: constante si no hay capas; textura con sus pasos si hay', () => {
  const p = planMaterial({ channels: { baseColor: '#808080', roughness: { value: 0.5, layers: [{ generator: 'noise', blend: 'multiply' }] } } });
  assert.deepEqual(p.channels.baseColor, { type: 'constant', value: '#808080' });
  assert.equal(p.channels.roughness.type, 'texture');
  assert.deepEqual(p.channels.roughness.ops.map((o) => o.op), ['fill', 'layer']);
  assert.equal(p.channels.roughness.ops[1].layer.blend, 'multiply');
});

test('planMaterial: una capa de material con máscara se mezcla; sin máscara y constante se resuelve sin hornear', () => {
  const p = planMaterial({
    channels: { baseColor: '#000000', metalness: 0 },
    layers: [
      { name: 'raspones', mask: { generator: 'cells' }, channels: { metalness: 1 } },
      { name: 'velo', opacity: 0.5, channels: { baseColor: '#ffffff' } },
    ],
  });
  assert.equal(p.channels.metalness.type, 'texture');
  assert.deepEqual(p.channels.metalness.ops.map((o) => o.op), ['fill', 'mix']);
  assert.equal(p.channels.metalness.ops[1].name, 'raspones');
  // negro y blanco al 50 % en lineal: 0.5 lineal es #bcbcbc en sRGB (no #808080)
  assert.deepEqual(p.channels.baseColor, { type: 'constant', value: '#bcbcbc' });
});

test('planMaterial: el bump va al mapa de normales, y un canal sin mapa no acepta capas', () => {
  const p = planMaterial({ channels: { bump: [{ generator: 'tiles' }] } });
  assert.ok(p.normal.bump);
  assert.equal(p.normal.from, null);
  assert.throws(() => planMaterial({ channels: { thickness: [{ generator: 'noise' }] } }), /thickness no acepta mapas/);
});

test('hashMaterial: igual definición escrita distinto da igual; un cambio da otro', () => {
  const a = { name: 'x', channels: { roughness: { layers: [{ params: { scale: 4 }, generator: 'noise' }], value: 0.4 }, baseColor: '#C33' } };
  const b = { channels: { baseColor: '#c33', roughness: { value: 0.4, layers: [{ generator: 'noise', params: { scale: 4 } }] } }, name: 'x' };
  assert.equal(hashMaterial(a), hashMaterial(b));
  assert.notEqual(hashMaterial(a), hashMaterial({ ...b, channels: { ...b.channels, baseColor: '#c34' } }));
  assert.notEqual(hashMaterial(a), hashMaterial(a, 'noise@2'));
  assert.deepEqual(generatorsOf(defineMaterial({ channels: { bump: [{ generator: 'tiles', mask: { generator: 'noise' } }] }, layers: [{ mask: { generator: 'cells' }, channels: { metalness: 1 } }] })), ['cells', 'noise', 'tiles']);
});

test('modos de fusión: la cuenta de cada uno', () => {
  assert.equal(blendValue('normal', 0.2, 0.7), 0.7);
  assert.equal(blendValue('multiply', 0.5, 0.5), 0.25);
  assert.equal(blendValue('add', 0.7, 0.7), 1);
  assert.equal(blendValue('subtract', 0.2, 0.7), 0);
  assert.equal(blendValue('screen', 0.5, 0.5), 0.75);
  assert.equal(blendValue('overlay', 0.25, 0.5), 0.25);
  assert.equal(blendValue('darken', 0.3, 0.6), 0.3);
  assert.equal(blendValue('lighten', 0.3, 0.6), 0.6);
  assert.ok(Math.abs(blendValue('difference', 0.3, 0.6) - 0.3) < 1e-12);
  assert.equal(layerValue('normal', 0, 1, 0.25), 0.25);
  assert.equal(BLEND_MODES.length, 9);
  assert.throws(() => blendValue('dodge', 0, 0), /desconocido/);
});

test('color: sRGB ↔ lineal ida y vuelta', () => {
  for (const hex of ['#000000', '#ffffff', '#808080', '#c3341f']) assert.equal(linearToHex(hexToLinear(hex)), hex);
  assert.ok(Math.abs(hexToLinear('#808080')[0] - 0.2158) < 1e-3);
});

test('generadores: los de fábrica están y validan sus parámetros', () => {
  const nombres = listGenerators().map((g) => g.name);
  for (const n of ['noise', 'cells', 'checker', 'brushed', 'grain', 'dots', 'tiles', 'gradient']) assert.ok(nombres.includes(n), n);
  const g = getGenerator('noise');
  assert.deepEqual(resolveParams(g, { scale: 3 }), { scale: 3, octaves: 4, persistence: 0.5, lacunarity: 2, seed: 0 });
  assert.throws(() => resolveParams(g, { escala: 3 }), /parámetro desconocido escala/);
  assert.throws(() => resolveParams(g, { octaves: 2.5 }), /entero/);
  assert.throws(() => resolveParams(g, { octaves: 20 }), /va de 1 a 8/);
  assert.match(paramUniformsGLSL(g), /uniform int p_octaves;/);
  assert.throws(() => getGenerator('mármol'), /generador desconocido/);
});

test('un plugin de una app se registra con su prefijo, y se valida', () => {
  const plugin = {
    name: 'mi-app/rayas', version: '1', space: 'solid', outputs: ['color', 'roughness'],
    params: { ancho: { type: 'number', default: 2, min: 0 }, especie: { type: 'select', values: ['a', 'b'], default: 'a' } },
    fragment: 'void generate(inout Surface s) { s.color = vec3(fract(vPos.x / p_ancho)); }',
    plane: () => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1] }),
  };
  registerGenerator(plugin);
  assert.equal(getGenerator('mi-app/rayas').space, 'solid');
  assert.match(paramUniformsGLSL(getGenerator('mi-app/rayas')), /uniform float p_ancho;/);
  assert.doesNotMatch(paramUniformsGLSL(getGenerator('mi-app/rayas')), /p_especie/); // un select lo resuelve el plugin en JS
  assert.throws(() => registerGenerator({ ...plugin, plane: undefined }), /necesita plane/);
  assert.throws(() => registerGenerator({ ...plugin, fragment: 'void main() {}' }), /void generate/);
  assert.throws(() => registerGenerator({ ...plugin, name: 'Mi App' }), /nombre de generador inválido/);
  assert.throws(() => registerGenerator({ ...plugin, outputs: ['brillo'] }), /outputs/);
  assert.throws(() => registerGenerator({ ...plugin, version: '' }), /version/);
});

test('lo puro no importa three ni el DOM', async () => {
  for (const f of ['channels.js', 'blend.js', 'material.js', 'generators.js', 'help.js', 'members.js', 'index.js']) {
    const s = await fuente(`src/${f}`);
    assert.doesNotMatch(s, /from 'three/, f);
    assert.doesNotMatch(s, /\b(document|window)\./, f);
  }
});

test('la tabla de help() y la API del motor coinciden, en las dos direcciones', async () => {
  const s = await fuente('adapters/three/engine.js');
  const i = s.indexOf('const motor = {');
  const cuerpo = s.slice(i, s.indexOf('\n  };', i));
  const api = new Set();
  for (const m of cuerpo.matchAll(/^ {4}(?:async )?([A-Za-z_$][\w$]*)\s*(?:\(|:|,)/gm)) api.add(m[1]);
  const doc = new Set(ENGINE_MEMBERS.flatMap(([sig]) => memberNames(sig)));
  for (const n of api) assert.ok(doc.has(n), `${n} está en la API pero no en la tabla de help()`);
  for (const n of doc) assert.ok(api.has(n), `${n} está en la tabla de help() pero no en la API`);
});
