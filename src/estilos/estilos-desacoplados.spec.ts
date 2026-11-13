import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { encontrarValoresVisualesLiterales } from './detectar-valores-literales';

// Rutas desde la raíz del proyecto (donde corre `ng test`): con `--coverage` el
// archivo de prueba se ejecuta empaquetado y `import.meta.url` ya no apunta a src/estilos.
const directorioActual = resolve(process.cwd(), 'src', 'estilos');
const directorioApp = resolve(directorioActual, '..', 'app');
// La capa de componentes globales vive fuera de `src/app` pero sigue la misma
// regla: sólo tokens semánticos.
const archivoComponentesGlobales = resolve(directorioActual, '_componentes.scss');

function archivosVigilados(): string[] {
  return [...listarArchivosScss(directorioApp), archivoComponentesGlobales];
}

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
    const archivos = archivosVigilados();
    expect(archivos.length).toBeGreaterThan(0);

    const violaciones = archivos.flatMap((archivo) =>
      encontrarValoresVisualesLiterales(readFileSync(archivo, 'utf-8')).map(
        (detalle) => `${archivo} — ${detalle}`,
      ),
    );

    expect(violaciones, violaciones.join('\n')).toEqual([]);
  });

  it('vigilaLaCapaDeComponentesGlobales', () => {
    expect(archivosVigilados()).toContain(archivoComponentesGlobales);

    const contenido = readFileSync(archivoComponentesGlobales, 'utf-8');
    expect(contenido).toContain('.mv-boton');
    expect(encontrarValoresVisualesLiterales(contenido)).toEqual([]);
  });

  it('componentesGlobalesNoUsanPrimitivos', () => {
    // Los primitivos (`--mv-p-…`) sólo se leen desde `_tema.scss`.
    const contenido = readFileSync(archivoComponentesGlobales, 'utf-8');
    expect(contenido.match(/var\(\s*--mv-p-[\w-]+/g) ?? []).toEqual([]);
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

  it('detectaSombraConColorLiteralYPermiteTonoLocalConToken', () => {
    // Patrones propios de la capa de componentes: una sombra con rgba()
    // debe venir de un token, y los tonos locales (`--tono-texto`) sólo
    // pueden apuntar a tokens.
    const conSombraLiteral = encontrarValoresVisualesLiterales(`
      .mv-tarjeta {
        box-shadow: 0 2px 8px rgba(11, 37, 69, 0.06);
      }
    `);
    const conTonoLocal = encontrarValoresVisualesLiterales(`
      .mv-chip {
        --tono-texto: var(--mv-color-exito);
        color: var(--tono-texto);
        box-shadow: var(--mv-sombra-suave);
      }
    `);
    const conTonoLiteral = encontrarValoresVisualesLiterales(`
      .mv-chip {
        --tono-fondo: #e3f1e8;
      }
    `);

    expect(conSombraLiteral).toHaveLength(1);
    expect(conSombraLiteral[0]).toContain('box-shadow');
    expect(conTonoLocal).toEqual([]);
    expect(conTonoLiteral).toHaveLength(1);
  });
});
