import { RespuestaEstadoCatalogo } from './servicio-catalogos';

/**
 * Descripción del estado `idEstado` dentro de `estados` (el catálogo ya
 * cargado, p.ej. con `ServicioCatalogos.estados(...)`). El estado nunca se
 * muestra por su código interno (regla 26 del plan: vale para el estado
 * de un relevo, el de una propuesta de sucesión y el resultado de un
 * evento de auditoría). Sin ese `idEstado` en la lista, cadena vacía.
 */
export function descripcionEstado(estados: RespuestaEstadoCatalogo[], idEstado: number): string {
  return estados.find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
}
