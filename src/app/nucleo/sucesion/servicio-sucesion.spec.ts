import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioSucesion } from './servicio-sucesion';
import { RespuestaPropuesta } from './modelos-sucesion';

function persona(idUsuario: number, nombre: string) {
  return { idUsuario, nombre };
}

function propuesta(idPropuesta: number): RespuestaPropuesta {
  return {
    idPropuesta,
    idGrupo: 1,
    saliente: persona(1, 'Saliente'),
    candidato: persona(2, 'Candidato'),
    idEstado: 1,
    codigoEstado: 'PENDIENTE',
    fechaCreacion: '2026-11-02T08:00:00-03:00',
    fechaRespuesta: null,
    fechaCancelacion: null,
    fechaCompletado: null,
    motivoCancelacion: null,
    condicionesPendientes: [],
  };
}

describe('ServicioSucesion', () => {
  let servicio: ServicioSucesion;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioSucesion);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('proponerEnviaElCandidatoConPost', () => {
    servicio.proponer(1, 2).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion'),
    );
    expect(peticion.request.body).toEqual({ idUsuarioCandidato: 2 });
    peticion.flush(propuesta(9));
  });

  it('activaDevuelveLaPropuestaCuandoLaApiResponde200', () => {
    let resultado: RespuestaPropuesta | null | undefined;
    servicio.activa(1).subscribe((valor) => (resultado = valor));

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/sucesion/activa'),
    );
    peticion.flush(propuesta(9));

    expect(resultado).toEqual(propuesta(9));
  });

  it('activaMapeaEl204ANull', () => {
    let resultado: RespuestaPropuesta | null | undefined;
    servicio.activa(1).subscribe((valor) => (resultado = valor));

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/sucesion/activa'),
    );
    peticion.flush(null, { status: 204, statusText: 'No Content' });

    expect(resultado).toBeNull();
  });

  it('historialConsultaLaListaDelGrupo', () => {
    servicio.historial(1).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/sucesion'),
    );
    peticion.flush([propuesta(1), propuesta(2)]);
  });

  it('obtenerConsultaLaPropuestaPorId', () => {
    servicio.obtener(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/sucesion/9'),
    );
    peticion.flush(propuesta(9));
  });

  it('aceptarEnviaUnPost', () => {
    servicio.aceptar(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/aceptar'),
    );
    peticion.flush(propuesta(9));
  });

  it('rechazarEnviaUnPost', () => {
    servicio.rechazar(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/rechazar'),
    );
    peticion.flush(propuesta(9));
  });

  it('cancelarSinMotivoEnviaMotivoNulo', () => {
    servicio.cancelar(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/cancelar'),
    );
    expect(peticion.request.body).toEqual({ motivo: null });
    peticion.flush(propuesta(9));
  });

  it('cancelarConMotivoLoEnvia', () => {
    servicio.cancelar(1, 9, 'Ya no es necesario').subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/cancelar'),
    );
    expect(peticion.request.body).toEqual({ motivo: 'Ya no es necesario' });
    peticion.flush(propuesta(9));
  });

  it('completarSinReasignacionesEnviaUnaListaVacia', () => {
    servicio.completar(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/completar'),
    );
    expect(peticion.request.body).toEqual({ reasignaciones: [] });
    peticion.flush(propuesta(9));
  });

  it('completarConReasignacionesLasEnvia', () => {
    const reasignaciones = [{ idTarea: 3, idUsuario: 2 }];
    servicio.completar(1, 9, reasignaciones).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/sucesion/9/completar'),
    );
    expect(peticion.request.body).toEqual({ reasignaciones });
    peticion.flush(propuesta(9));
  });
});
