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
