import {
  accionesDisponibles,
  ETIQUETA_ACCION,
  requiereObservacion,
  TRANSICIONES,
} from './estados-tarea';
import { RespuestaTarea } from './modelos-tareas';

function tarea(cambios: Partial<RespuestaTarea> = {}): RespuestaTarea {
  return {
    idTarea: 1,
    tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS',
    idAdultoMayor: 1,
    nombreAdulto: 'Adulto',
    idDetallePlan: null,
    titulo: 'Tarea',
    descripcion: null,
    fechaHorario: '2026-11-02T08:00:00-03:00',
    minutosTolerancia: 30,
    idEstado: 1,
    atrasada: false,
    responsable: null,
    observacionCierre: null,
    nombreConfirmador: null,
    fechaConfirmacion: null,
    motivoCancelacion: null,
    compra: [],
    cita: null,
    ...cambios,
  };
}

describe('TRANSICIONES', () => {
  it('pendienteVaATodosLosEstados', () => {
    expect(TRANSICIONES.PENDIENTE).toEqual(
      expect.arrayContaining(['EN_CURSO', 'COMPLETADA', 'NO_REALIZADA', 'CANCELADA']),
    );
    expect(TRANSICIONES.PENDIENTE).toHaveLength(4);
  });

  it('enCursoNoSeCancela', () => {
    expect(TRANSICIONES.EN_CURSO).toEqual(expect.arrayContaining(['COMPLETADA', 'NO_REALIZADA']));
    expect(TRANSICIONES.EN_CURSO).toHaveLength(2);
  });

  it('losEstadosFinalesNoTienenTransiciones', () => {
    expect(TRANSICIONES.COMPLETADA).toEqual([]);
    expect(TRANSICIONES.NO_REALIZADA).toEqual([]);
    expect(TRANSICIONES.CANCELADA).toEqual([]);
  });
});

describe('requiereObservacion', () => {
  it('noRealizadaYCanceladaLaRequieren', () => {
    expect(requiereObservacion('NO_REALIZADA')).toBe(true);
    expect(requiereObservacion('CANCELADA')).toBe(true);
  });

  it('losDemasEstadosNoLaRequieren', () => {
    expect(requiereObservacion('PENDIENTE')).toBe(false);
    expect(requiereObservacion('EN_CURSO')).toBe(false);
    expect(requiereObservacion('COMPLETADA')).toBe(false);
  });
});

describe('ETIQUETA_ACCION', () => {
  it('tieneLasEtiquetasExactasDeLaRegla11', () => {
    expect(ETIQUETA_ACCION.EN_CURSO).toBe('Iniciar');
    expect(ETIQUETA_ACCION.COMPLETADA).toBe('Completar');
    expect(ETIQUETA_ACCION.NO_REALIZADA).toBe('No realizada');
    expect(ETIQUETA_ACCION.CANCELADA).toBe('Cancelar');
  });
});

describe('accionesDisponibles', () => {
  const coordinador = { idUsuario: 200, miRol: 'COORDINADOR', esAdministrador: false };
  const administrador = { idUsuario: 201, miRol: null, esAdministrador: true };
  const colaborador = { idUsuario: 202, miRol: 'COLABORADOR', esAdministrador: false };
  const otroColaborador = { idUsuario: 203, miRol: 'COLABORADOR', esAdministrador: false };

  it('elColaboradorAsignadoVeCompletarPeroNoCancelar', () => {
    const t = tarea({ responsable: { idUsuario: colaborador.idUsuario, nombre: 'Colaborador' } });
    const acciones = accionesDisponibles('PENDIENTE', t, colaborador);

    expect(acciones).toContain('COMPLETADA');
    expect(acciones).toContain('EN_CURSO');
    expect(acciones).toContain('NO_REALIZADA');
    expect(acciones).not.toContain('CANCELADA');
  });

  it('unColaboradorNoAsignadoNoVeNadaEnUnaTareaAsignadaAOtro', () => {
    const t = tarea({
      responsable: { idUsuario: otroColaborador.idUsuario, nombre: 'Otro colaborador' },
    });
    const acciones = accionesDisponibles('PENDIENTE', t, colaborador);

    expect(acciones).toEqual([]);
  });

  it('elCoordinadorNoVeCancelarEnMedicamentos', () => {
    const t = tarea({ tipoTarea: 'MEDICAMENTOS' });
    const acciones = accionesDisponibles('PENDIENTE', t, coordinador);

    expect(acciones).not.toContain('CANCELADA');
    expect(acciones).toContain('COMPLETADA');
  });

  it('elCoordinadorSiVeCancelarEnUnaTareaManual', () => {
    const t = tarea({ tipoTarea: 'COMPRA_RETIRO_MEDICAMENTOS' });
    const acciones = accionesDisponibles('PENDIENTE', t, coordinador);

    expect(acciones).toContain('CANCELADA');
  });

  it('elAdministradorPuedeCancelarUnaTareaManual', () => {
    const t = tarea({ tipoTarea: 'CITAS_CONTROLES_MEDICOS' });
    const acciones = accionesDisponibles('PENDIENTE', t, administrador);

    expect(acciones).toContain('CANCELADA');
  });

  it('sinAsignacionCualquierIntegranteActivoPuedeConfirmar', () => {
    const t = tarea({ responsable: null });
    const acciones = accionesDisponibles('PENDIENTE', t, colaborador);

    expect(acciones).toContain('COMPLETADA');
    expect(acciones).not.toContain('CANCELADA');
  });

  it('noOfreceAccionesDesdeUnEstadoFinal', () => {
    const t = tarea();
    expect(accionesDisponibles('COMPLETADA', t, coordinador)).toEqual([]);
    expect(accionesDisponibles('CANCELADA', t, coordinador)).toEqual([]);
  });

  it('enCursoNoOfreceCancelarNiAlColaboradorNiAlCoordinador', () => {
    const t = tarea({ responsable: { idUsuario: colaborador.idUsuario, nombre: 'Colaborador' } });
    expect(accionesDisponibles('EN_CURSO', t, colaborador)).toEqual(
      expect.arrayContaining(['COMPLETADA', 'NO_REALIZADA']),
    );
    expect(accionesDisponibles('EN_CURSO', t, coordinador)).not.toContain('CANCELADA');
  });
});
