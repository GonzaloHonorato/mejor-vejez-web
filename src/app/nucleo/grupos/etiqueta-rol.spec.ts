import { etiquetaRol } from './etiqueta-rol';

describe('etiquetaRol', () => {
  it('traduceLosRolesConocidos', () => {
    expect(etiquetaRol('COORDINADOR')).toBe('Coordinador/a');
    expect(etiquetaRol('COLABORADOR')).toBe('Colaborador/a');
  });

  it('otroCodigoSeMuestraCapitalizado', () => {
    expect(etiquetaRol('OBSERVADOR')).toBe('Observador');
    expect(etiquetaRol('APOYO_EXTERNO')).toBe('Apoyo externo');
  });

  it('sinRolNoMuestraNada', () => {
    expect(etiquetaRol(null)).toBe('');
    expect(etiquetaRol(undefined)).toBe('');
    expect(etiquetaRol('')).toBe('');
  });
});
