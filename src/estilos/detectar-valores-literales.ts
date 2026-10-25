// Detección pura de valores visuales literales en SCSS: una función de texto
// a lista de violaciones, sin dependencias de Node (fs/path), para poder
// probarla directamente con strings controlados además de con archivos reales.
//
// Garantiza la separación en capas: los componentes SOLO pueden referenciar
// tokens semánticos (`var(--mv-...)`) o palabras permitidas (`inherit`, etc.),
// nunca un valor visual literal. Así, cambiar de diseño (hay 5 opciones en
// evaluación) significa editar únicamente `src/estilos/_tema.scss`.

const PATRON_HEX = /#[0-9a-fA-F]{3,8}\b/;
const PATRON_FUNCION_COLOR = /\b(rgb|rgba|hsl|hsla)\s*\(/i;
const NOMBRES_DE_COLOR = [
  'black', 'silver', 'gray', 'grey', 'white', 'maroon', 'red', 'purple', 'fuchsia',
  'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua', 'orange',
  'pink', 'brown', 'cyan', 'magenta', 'indigo', 'violet', 'turquoise', 'beige',
  'ivory', 'khaki', 'lavender', 'plum', 'tan', 'coral', 'salmon', 'crimson', 'gold',
];
const PATRON_NOMBRE_DE_COLOR = new RegExp(`\\b(${NOMBRES_DE_COLOR.join('|')})\\b`, 'i');

// Propiedades tipográficas que deben resolverse SIEMPRE por token semántico
// (o `inherit`), igual que un color: `font-family` y `font-size`.
const PROPIEDADES_TIPOGRAFICAS_FORZADAS = new Set(['font-family', 'font-size']);

const VALORES_PERMITIDOS = new Set(['inherit', 'unset', 'initial', 'currentcolor', 'transparent', 'none']);

function quitarComentarios(contenido: string): string {
  return contenido.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Valor "desacoplado" = sólo referencia tokens semánticos (`var(--mv-...)`) o palabras permitidas. */
function esValorDesacoplado(valor: string): boolean {
  const sinVar = valor.replace(/var\(\s*--mv-[\w-]+(?:\s*,[^)]*)?\)/g, ' ');
  const resto = sinVar.trim();
  if (resto === '') return true;
  return resto
    .split(/[\s,]+/)
    .filter(Boolean)
    .every((token) => VALORES_PERMITIDOS.has(token.toLowerCase()));
}

/**
 * Una línea puede traer varias declaraciones CSS separadas por `;`
 * (`width: 10px; background: #fff;`). Si sólo se mirara la línea completa
 * con un patrón anclado de principio a fin, la segunda declaración (y
 * cualquier otra después de la primera) nunca se evaluaría → falso negativo.
 * Por eso se separa la línea en declaraciones individuales antes de
 * evaluarlas una por una.
 */
function dividirEnDeclaraciones(linea: string): string[] {
  if (!/^\s*[\w-]+\s*:/.test(linea)) return [];
  return linea
    .split(';')
    .map((segmento) => segmento.trim())
    .filter(Boolean);
}

export function encontrarValoresVisualesLiterales(contenido: string): string[] {
  const violaciones: string[] = [];
  const lineas = quitarComentarios(contenido).split('\n');

  lineas.forEach((linea, indice) => {
    for (const declaracion of dividirEnDeclaraciones(linea)) {
      const coincidencia = declaracion.match(/^([\w-]+)\s*:\s*(.+)$/);
      if (!coincidencia) continue;
      const [, propiedadCruda, valorCrudo] = coincidencia;
      const propiedad = propiedadCruda.toLowerCase();
      const valor = valorCrudo.trim();

      if (PROPIEDADES_TIPOGRAFICAS_FORZADAS.has(propiedad)) {
        if (!esValorDesacoplado(valor)) {
          violaciones.push(`línea ${indice + 1}: ${propiedad} literal → "${valor}"`);
        }
        continue;
      }

      if (PATRON_HEX.test(valor) || PATRON_FUNCION_COLOR.test(valor) || PATRON_NOMBRE_DE_COLOR.test(valor)) {
        violaciones.push(`línea ${indice + 1}: color literal en "${propiedadCruda}" → "${valor}"`);
      }
    }
  });

  return violaciones;
}
