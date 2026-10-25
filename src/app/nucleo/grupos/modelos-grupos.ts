/** Contrato de `GET /api/grupos/roles`: un rol posible dentro de un grupo. */
export interface RespuestaRol {
  idRol: number;
  nombreRol: string;
  descripcion: string;
}

/** Contrato de los endpoints de `/api/grupos`: un grupo familiar. */
export interface RespuestaGrupo {
  idGrupo: number;
  nombreGrupo: string;
  notificaCoordinador: boolean;
  idEstado: number;
  /** Rol de la persona autenticada en el grupo; null si es admin sin membresía. */
  miRol: string | null;
  fechaCreacion: string;
}

/** Contrato de los endpoints de integrantes: una membresía de un usuario en un grupo. */
export interface RespuestaIntegrante {
  idIntegrante: number;
  idUsuario: number;
  nombre: string;
  email: string;
  idRol: number;
  nombreRol: string;
  idEstado: number;
  fechaIncorporacion: string;
  fechaDesactivacion: string | null;
}
