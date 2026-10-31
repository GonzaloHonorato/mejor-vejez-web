/** Contrato de los endpoints de `/api/usuarios`: una cuenta de usuario. */
export interface RespuestaUsuario {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono: string | null;
  esAdministrador: boolean;
  idEstado: number;
  fechaCreacion: string;
}

/** Contrato genérico de una página de resultados paginados de la API. */
export interface RespuestaPagina<T> {
  elementos: T[];
  pagina: number;
  tamano: number;
  total: number;
}

/** Datos para `POST /api/usuarios` (administrador). */
export interface SolicitudCrearUsuario {
  nombre: string;
  email: string;
  telefono: string | null;
}

/**
 * Contrato de `POST /api/usuarios`: la contraseña temporal viaja una sola
 * vez, en esta respuesta (y en el correo, si `correoEnviado` es `true`).
 */
export interface RespuestaCuentaCreada {
  usuario: RespuestaUsuario;
  claveTemporal: string;
  correoEnviado: boolean;
}

/**
 * Contrato de `POST /api/usuarios/{idUsuario}/reenviar-acceso`: la
 * contraseña temporal nueva viaja una sola vez, en esta respuesta.
 */
export interface RespuestaAccesoReenviado {
  claveTemporal: string;
  correoEnviado: boolean;
}
