import { HttpErrorResponse } from '@angular/common/http';

const MENSAJE_SIN_CONEXION = 'No pudimos conectar con el servidor.';
const MENSAJE_POR_DEFECTO = 'Ocurrió un error inesperado.';

/** Un error de validación de un campo puntual, tal como lo envía la API. */
interface ErrorCampoApi {
  campo?: string;
  mensaje?: string;
}

/** Forma del cuerpo `ProblemDetail` que devuelve la API en los errores. */
interface CuerpoProblema {
  detail?: string;
  errores?: ErrorCampoApi[];
}

function cuerpoProblema(error: unknown): CuerpoProblema | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const cuerpo = error.error;
  return cuerpo !== null && typeof cuerpo === 'object' ? (cuerpo as CuerpoProblema) : null;
}

/**
 * Mensaje listo para mostrar a la persona usuaria a partir de un error de
 * una llamada HTTP: el `detail` del `ProblemDetail` de la API, un aviso de
 * conexión si no hubo respuesta (`status === 0`), o `porDefecto` en
 * cualquier otro caso (incluido un error que no vino de una llamada HTTP).
 */
export function mensajeDeError(error: unknown, porDefecto: string = MENSAJE_POR_DEFECTO): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return MENSAJE_SIN_CONEXION;
    }
    const detalle = cuerpoProblema(error)?.detail;
    if (typeof detalle === 'string' && detalle.length > 0) {
      return detalle;
    }
  }
  return porDefecto;
}

/** Errores de validación por campo (`errores: [{campo, mensaje}]` del `ProblemDetail`). */
export function erroresDeCampos(error: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  const errores = cuerpoProblema(error)?.errores;
  if (!Array.isArray(errores)) {
    return resultado;
  }
  for (const item of errores) {
    if (typeof item.campo === 'string' && typeof item.mensaje === 'string') {
      resultado[item.campo] = item.mensaje;
    }
  }
  return resultado;
}
