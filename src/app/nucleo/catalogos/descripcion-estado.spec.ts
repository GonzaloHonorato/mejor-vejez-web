import { descripcionEstado } from './descripcion-estado';
import { RespuestaEstadoCatalogo } from './servicio-catalogos';

function estado(cambios: Partial<RespuestaEstadoCatalogo> = {}): RespuestaEstadoCatalogo {
  return { idEstado: 1, codigo: 'PENDIENTE', descripcion: 'Pendiente', orden: 1, ...cambios };
}

describe('descripcionEstado', () => {
  it('devuelveLaDescripcionDelEstadoEncontrado', () => {
    const estados = [
      estado({ idEstado: 1, descripcion: 'Pendiente' }),
      estado({ idEstado: 2, descripcion: 'Completada' }),
    ];
    expect(descripcionEstado(estados, 2)).toBe('Completada');
  });

  it('devuelveCadenaVaciaSiNoEncuentraElEstado', () => {
    const estados = [estado({ idEstado: 1 })];
    expect(descripcionEstado(estados, 99)).toBe('');
  });

  it('devuelveCadenaVaciaConUnaListaVacia', () => {
    expect(descripcionEstado([], 1)).toBe('');
  });
});
