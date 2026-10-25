import { edadEnAnios } from './edad';

describe('edadEnAnios', () => {
  it('calculaLaEdadAntesYDespuesDelCumpleanos', () => {
    const fechaNacimiento = '1950-06-15';

    expect(edadEnAnios(fechaNacimiento, new Date(2026, 5, 14))).toBe(75);
    expect(edadEnAnios(fechaNacimiento, new Date(2026, 5, 15))).toBe(76);
    expect(edadEnAnios(fechaNacimiento, new Date(2026, 5, 16))).toBe(76);
  });

  it('sinFechaDevuelveNull', () => {
    expect(edadEnAnios(null)).toBeNull();
  });
});
