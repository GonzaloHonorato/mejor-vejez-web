/** Borde del disparador en coordenadas de la ventana (como `getBoundingClientRect`). */
export interface BordesDisparador {
  top: number;
  bottom: number;
  right: number;
}

export interface Medidas {
  ancho: number;
  alto: number;
}

export interface PosicionMenu {
  top: number;
  left: number;
  haciaArriba: boolean;
}

/** Separación entre el segmento y el menú. */
export const SEPARACION_MENU = 8;
/** Distancia mínima entre el menú y el borde de la ventana. */
export const MARGEN_VENTANA = 8;

/**
 * Posición `fixed` del menú del botón dividido: bajo el disparador y alineado
 * a su borde derecho. Si no cabe abajo y arriba hay más espacio, se abre hacia
 * arriba. Horizontalmente se mantiene dentro de la ventana.
 */
export function calcularPosicionMenu(
  disparador: BordesDisparador,
  menu: Medidas,
  ventana: Medidas,
  separacion = SEPARACION_MENU,
  margen = MARGEN_VENTANA,
): PosicionMenu {
  const espacioAbajo = ventana.alto - disparador.bottom - separacion - margen;
  const espacioArriba = disparador.top - separacion - margen;
  const haciaArriba = menu.alto > espacioAbajo && espacioArriba > espacioAbajo;

  const top = haciaArriba
    ? disparador.top - separacion - menu.alto
    : disparador.bottom + separacion;

  const maximoIzquierda = ventana.ancho - margen - menu.ancho;
  const left = Math.max(margen, Math.min(disparador.right - menu.ancho, maximoIzquierda));

  return { top, left, haciaArriba };
}
