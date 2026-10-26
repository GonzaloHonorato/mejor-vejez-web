import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioTareas } from './servicio-tareas';
import {
  RespuestaTarea,
  RespuestaTareaDetallada,
  SolicitudAsignarTarea,
  SolicitudCambiarEstadoTarea,
  SolicitudCrearTareaManual,
} from './modelos-tareas';

function tarea(idTarea: number): RespuestaTarea {
  return {
    idTarea,
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
  };
}

function tareaDetallada(idTarea: number): RespuestaTareaDetallada {
  return { tarea: tarea(idTarea), historial: [], asignaciones: [] };
}

describe('ServicioTareas', () => {
  let servicio: ServicioTareas;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioTareas);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarSinFiltrosNoEnviaParametros', () => {
    servicio.listar(1, {}).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/tareas'),
    );
    expect(peticion.request.params.has('desde')).toBe(false);
    expect(peticion.request.params.has('hasta')).toBe(false);
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    expect(peticion.request.params.has('idEstado')).toBe(false);
    expect(peticion.request.params.has('soloMias')).toBe(false);
    peticion.flush([tarea(1)]);
  });

  it('listarEnviaTodosLosFiltrosIndicados', () => {
    servicio
      .listar(1, { desde: '2026-11-02', hasta: '2026-11-08', idAdulto: 3, idEstado: 2, soloMias: true })
      .subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/tareas'),
    );
    expect(peticion.request.params.get('desde')).toBe('2026-11-02');
    expect(peticion.request.params.get('hasta')).toBe('2026-11-08');
    expect(peticion.request.params.get('idAdulto')).toBe('3');
    expect(peticion.request.params.get('idEstado')).toBe('2');
    expect(peticion.request.params.get('soloMias')).toBe('true');
    peticion.flush([]);
  });

  it('listarEnviaSoloMiasFalseExplicito', () => {
    servicio.listar(1, { soloMias: false }).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/tareas'),
    );
    expect(peticion.request.params.get('soloMias')).toBe('false');
    peticion.flush([]);
  });

  it('obtenerConsultaElDetalleDeLaTarea', () => {
    servicio.obtener(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/tareas/9'),
    );
    peticion.flush(tareaDetallada(9));
  });

  it('cambiarEstadoEnviaElCuerpoAlEndpointDeEstado', () => {
    const solicitud: SolicitudCambiarEstadoTarea = { idEstado: 3, observacion: 'Listo' };
    servicio.cambiarEstado(1, 9, solicitud).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/tareas/9/estado'),
    );
    expect(peticion.request.body).toEqual(solicitud);
    peticion.flush(tarea(9));
  });

  it('asignarEnviaElCuerpoAlEndpointDeAsignacionConPut', () => {
    const solicitud: SolicitudAsignarTarea = { idUsuario: 5, motivo: null };
    servicio.asignar(1, 9, solicitud).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'PUT' && req.url.endsWith('/api/grupos/1/tareas/9/asignacion'),
    );
    expect(peticion.request.body).toEqual(solicitud);
    peticion.flush(tarea(9));
  });

  it('crearManualEnviaElCuerpoAlListadoDeTareasConPost', () => {
    const solicitud: SolicitudCrearTareaManual = {
      tipoTarea: 'CITAS_CONTROLES_MEDICOS',
      idAdultoMayor: 1,
      titulo: 'Control',
      descripcion: null,
      fechaHorario: '2026-11-02T10:00:00-03:00',
      idResponsable: null,
      compra: null,
      cita: { nombreMedico: 'Dr. Pérez', lugarAtencion: 'Clínica', observaciones: null },
    };
    servicio.crearManual(1, solicitud).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/tareas'),
    );
    expect(peticion.request.body).toEqual(solicitud);
    peticion.flush(tarea(10));
  });
});
