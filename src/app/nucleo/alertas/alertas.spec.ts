import { ETIQUETA_TIPO_ALERTA, observacionValida, puedeCerrarAlerta } from './alertas';
import { RespuestaAlerta } from './modelos-alertas';

const ID_ESTADO_ABIERTA = 1;
const ID_ESTADO_CERRADA = 2;

function alerta(cambios: Partial<RespuestaAlerta> = {}): RespuestaAlerta {
  return {
    idAlerta: 1,
    tipoAlerta: 'ATRASO_TAREA',
    idTarea: 9,
    tituloTarea: 'Tarea',
    idEstadoTarea: 1,
    idDetallePlan: null,
    nombreMedicamento: null,
    idAdultoMayor: 1,
    nombreAdulto: 'Adulto',
    fechaProgramada: '2026-11-02T08:00:00-03:00',
    mensajeAlerta: 'Mensaje',
    idEstado: ID_ESTADO_ABIERTA,
    fechaDeteccion: '2026-11-02T08:30:00-03:00',
    revisor: null,
    fechaRevision: null,
    observacionCierre: null,
    ...cambios,
  };
}

describe('ETIQUETA_TIPO_ALERTA', () => {
  it('tieneLasEtiquetasQueVeElUsuario', () => {
    expect(ETIQUETA_TIPO_ALERTA.ATRASO_TAREA).toBe('Tarea atrasada');
    expect(ETIQUETA_TIPO_ALERTA.REPOSICION_MEDICAMENTO).toBe('Reposición de medicamento');
    expect(ETIQUETA_TIPO_ALERTA.CITA_PROXIMA).toBe('Cita próxima');
  });
});

describe('puedeCerrarAlerta', () => {
  const colaborador = { miRol: 'COLABORADOR', esAdministrador: false };
  const coordinador = { miRol: 'COORDINADOR', esAdministrador: false };
  const administradorSinMembresia = { miRol: null, esAdministrador: true };

  it('elColaboradorNoPuedeCerrar', () => {
    expect(puedeCerrarAlerta(alerta(), colaborador, ID_ESTADO_ABIERTA)).toBe(false);
  });

  it('elCoordinadorPuedeCerrarUnaAlertaAbierta', () => {
    expect(puedeCerrarAlerta(alerta(), coordinador, ID_ESTADO_ABIERTA)).toBe(true);
  });

  it('elAdministradorSinMembresiaPuedeCerrar', () => {
    expect(puedeCerrarAlerta(alerta(), administradorSinMembresia, ID_ESTADO_ABIERTA)).toBe(true);
  });

  it('unaAlertaCerradaNoSePuedeCerrarDeNuevo', () => {
    const cerrada = alerta({ idEstado: ID_ESTADO_CERRADA });
    expect(puedeCerrarAlerta(cerrada, coordinador, ID_ESTADO_ABIERTA)).toBe(false);
  });
});

describe('observacionValida', () => {
  it('elTextoVacioNoEsValido', () => {
    expect(observacionValida('')).toBe(false);
  });

  it('elTextoEnBlancoNoEsValido', () => {
    expect(observacionValida('   ')).toBe(false);
  });

  it('masDe500CaracteresNoEsValido', () => {
    expect(observacionValida('a'.repeat(501))).toBe(false);
  });

  it('exactamente500CaracteresEsValido', () => {
    expect(observacionValida('a'.repeat(500))).toBe(true);
  });

  it('unTextoNormalEsValido', () => {
    expect(observacionValida('ok')).toBe(true);
  });
});
