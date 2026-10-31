const ETIQUETAS_ROL: Readonly<Record<string, string>> = {
  COORDINADOR: 'Coordinador/a',
  COLABORADOR: 'Colaborador/a',
};

/**
 * Rol en un grupo como se muestra en pantalla (cabecera, grupos,
 * integrantes). Un código desconocido se muestra capitalizado; sin rol, nada.
 */
export function etiquetaRol(codigo: string | null | undefined): string {
  if (!codigo) return '';
  const conocida = ETIQUETAS_ROL[codigo];
  if (conocida) return conocida;
  const texto = codigo.replace(/_/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
