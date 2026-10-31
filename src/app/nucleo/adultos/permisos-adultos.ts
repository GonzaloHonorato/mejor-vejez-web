/**
 * Aviso operativo exacto sobre qué datos se registran.
 * Se muestra en el formulario de alta de "Adultos" y en el editor de la
 * ficha: vive acá (y no duplicado en cada página) porque ambas lo necesitan
 * igual, carácter por carácter.
 */
export const AVISO_OPERATIVO =
  'Registra solo información operativa. No ingreses diagnósticos ni indicaciones médicas.';

/**
 * Regla de "puede administrar" compartida por la lista y la ficha de
 * adultos mayores (y sus contactos): coordinador del grupo activo o
 * administrador global. Sin grupo activo (`miRol` undefined/null y no
 * admin) no administra nada.
 */
export function puedeAdministrarGrupo(
  miRol: string | null | undefined,
  esAdministrador: boolean,
): boolean {
  return miRol === 'COORDINADOR' || esAdministrador;
}
