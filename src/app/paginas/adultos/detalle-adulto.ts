import { edadEnAnios } from '../../nucleo/adultos/edad';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';

/** "78 años · Código AM-001", con solo los datos que el perfil tenga; vacío si no tiene ninguno. */
export function detalleAdulto(adulto: RespuestaAdultoMayor): string {
  const edad = edadEnAnios(adulto.fechaNacimiento);
  const partes: string[] = [];
  if (edad !== null) partes.push(`${edad} años`);
  if (adulto.codigoInterno) partes.push(`Código ${adulto.codigoInterno}`);
  return partes.join(' · ');
}
