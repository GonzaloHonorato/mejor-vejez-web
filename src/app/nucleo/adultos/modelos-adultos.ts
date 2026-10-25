/** Contrato de los endpoints de contactos de `/api/grupos/{idGrupo}/adultos/{idAdulto}/contactos`: un contacto de emergencia. */
export interface RespuestaContacto {
  idContacto: number;
  idAdultoMayor: number;
  nombreContacto: string;
  parentesco: string | null;
  telefono: string;
  esPrincipal: boolean;
  idEstado: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

/** Contrato de los endpoints de `/api/grupos/{idGrupo}/adultos`: el perfil de un adulto mayor. */
export interface RespuestaAdultoMayor {
  idAdultoMayor: number;
  idGrupo: number;
  codigoInterno: string | null;
  nombreCompleto: string;
  fechaNacimiento: string | null;
  notasEmergencia: string | null;
  observacionesGenerales: string | null;
  idEstado: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  /** Contacto principal activo del adulto; null si no tiene ninguno. */
  contactoPrincipal: RespuestaContacto | null;
}
