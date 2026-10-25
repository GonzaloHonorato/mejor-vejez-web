/**
 * Edad en años cumplidos a partir de una fecha de nacimiento ISO (`YYYY-MM-DD`,
 * como llega `LocalDate` desde la API). Se parsean los componentes a mano
 * en vez de `new Date(fechaNacimiento)` para no depender de la zona horaria
 * del navegador. Sin fecha, devuelve `null` (contacto sin ese dato opcional).
 */
export function edadEnAnios(fechaNacimiento: string | null, hoy: Date = new Date()): number | null {
  if (!fechaNacimiento) {
    return null;
  }

  const [anioNacimiento, mesNacimiento, diaNacimiento] = fechaNacimiento.split('-').map(Number);
  let edad = hoy.getFullYear() - anioNacimiento;
  const cumpleanosEsteAnio = new Date(hoy.getFullYear(), mesNacimiento - 1, diaNacimiento);
  if (hoy < cumpleanosEsteAnio) {
    edad--;
  }
  return edad;
}
