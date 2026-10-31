import { inicialesDe } from './identidad-usuario';

describe('inicialesDe', () => {
  it('tomaLaPrimeraLetraDeHastaDosPalabras', () => {
    expect(inicialesDe('Rosa Elena Rojas Muñoz')).toBe('RE');
    expect(inicialesDe('  maría   pérez ')).toBe('MP');
    expect(inicialesDe('Ana')).toBe('A');
  });

  it('deUnCorreoTomaSuPrimeraLetra', () => {
    expect(inicialesDe('ana.soto@correo.cl')).toBe('A');
  });

  it('sinNombreDevuelveVacio', () => {
    expect(inicialesDe('')).toBe('');
    expect(inicialesDe('   ')).toBe('');
  });
});
