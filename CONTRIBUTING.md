# Contribuir

Este motor se vendoriza en varias apps. La pregunta antes de cada cambio no es "¿le sirve a la
app que lo pidió?" sino "¿le sirve a cualquier app que muestre materiales en three.js?".

## Agnóstico: qué entra y qué no

- **Entra:** los canales PBR que tiene cualquier CAD, las capas, los modos de fusión, las
  máscaras, el horneado, y generadores procedurales genéricos (ruido, celdas, cepillado, grilla…).
- **No entra:** los materiales de una industria (especies de madera, placas, catálogos), sus
  nombres ni sus valores por defecto. Eso es un **plugin** de la app: un generador registrado con
  `registerGenerator`, con su prefijo (`'mi-app/madera'`), que vive en el repo de la app y corre
  en este motor.

## El contrato

1. **Un material es datos**: se puede guardar como JSON, y dos definiciones iguales dan el mismo
   hash.
2. **Lo puro no importa three ni el DOM** (`src/`), y una prueba lo frena si pasa.
3. **Cada miembro de la API tiene su línea en `src/members.js`**: una prueba exige que la tabla
   de `help()` y la API coincidan, en las dos direcciones.
4. **Un generador declara su versión**: cambiar su GLSL sin cambiar la versión deja horneados
   viejos en las cachés.
5. **Los colores se componen en lineal**: los targets de color son sRGB y la GPU convierte.

## Cómo se agrega algo

1. Un canal nuevo: su línea en `CHANNELS`, con su tipo, su rango y su mapa de three.
2. Un modo de fusión: en `BLEND_MODES`, en `blendValue` y en `BLEND_GLSL`, con su prueba.
3. Un generador de fábrica: en `generators.js`, con sus parámetros documentados y su versión.
4. Probado en Node lo puro, y a ojo en `examples/index.html` lo que se hornea.
