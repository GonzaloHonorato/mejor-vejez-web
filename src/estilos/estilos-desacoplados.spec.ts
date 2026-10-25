import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encontrarValoresVisualesLiterales } from './detectar-valores-literales';

const directorioActual = dirname(fileURLToPath(import.meta.url));
const directorioApp = resolve(directorioActual, '..', 'app');

function listarArchivosScss(directorio: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const rutaCompleta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...listarArchivosScss(rutaCompleta));
    } else if (entrada.isFile() && entrada.name.endsWith('.scss')) {
      encontrados.push(rutaCompleta);
    }
  }
  return encontrados;
}

describe('Estilos desacoplados', () => {
  it('componentesNoUsanValoresVisualesLiterales', () => {
    const archivos = listarArchivosScss(directorioApp);
    expect(archivos.length).toBeGreaterThan(0);

    const violaciones = archivos.flatMap((archivo) =>
      encontrarValoresVisualesLiterales(readFileSync(archivo, 'utf-8')).map(
        (detalle) => `${archivo} — ${detalle}`,
      ),
    );

    expect(violaciones, violaciones.join('\n')).toEqual([]);
  });
});

describe('detectarValoresVisualesLiterales (helper puro)', () => {
  it('detectaVariasDeclaracionesLiteralesEnUnaMismaLinea', () => {
    // Caso que un patrón anclado de principio a fin por línea (^...$) deja
    // pasar: dos declaraciones separadas por ";" en una sola línea.
    const scssConDosDeclaracionesEnUnaLinea = `
      .tarjeta {
        width: 10px; background: #fff;
      }
    `;

    const violaciones = encontrarValoresVisualesLiterales(scssConDosDeclaracionesEnUnaLinea);

    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain('background');
    expect(violaciones[0]).toContain('#fff');
  });

  it('detectaFontSizeLiteralYPermiteTokenSemantico', () => {
    // La declaración debe ir en su propia línea: `dividirEnDeclaraciones`
    // sólo reconoce una declaración cuando la línea EMPIEZA con
    // `propiedad:` (ver su comentario). Un `.a { font-size: 14px; }` en una
    // sola línea nunca llega a evaluarse, así que las tres variantes se
    // escriben en 3 líneas (selector, declaración, cierre), como el SCSS
    // real de los componentes.
    const conLiteral = encontrarValoresVisualesLiterales(`
      .a {
        font-size: 14px;
      }
    `);
    const conToken = encontrarValoresVisualesLiterales(`
      .a {
        font-size: var(--mv-texto-base);
      }
    `);
    const conInherit = encontrarValoresVisualesLiterales(`
      .a {
        font-size: inherit;
      }
    `);

    expect(conLiteral).toHaveLength(1);
    expect(conLiteral[0]).toContain('font-size');
    expect(conToken).toEqual([]);
    expect(conInherit).toEqual([]);
  });

  it('permiteValoresNoVisualesComoAnchosYEspaciados', () => {
    const violaciones = encontrarValoresVisualesLiterales(`
      .caja {
        width: 10px; height: 10px;
        padding: var(--mv-espacio-2) var(--mv-espacio-3);
      }
    `);

    expect(violaciones).toEqual([]);
  });
});
