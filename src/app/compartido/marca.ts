/** Nombre visible de la aplicación. */
export const MARCA = 'Cuida+';

/** Título del documento para una página: `'<Página> · Cuida+'`. */
export function tituloDocumento(pagina: string): string {
  return `${pagina} · ${MARCA}`;
}
