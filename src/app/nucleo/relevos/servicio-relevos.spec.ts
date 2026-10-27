import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioRelevos } from './servicio-relevos';
import {
  RespuestaRelevo,
  RespuestaRelevoResumen,
  SolicitudRegistrarRelevo,
} from './modelos-relevos';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';

function persona(idUsuario: number, nombre: string) {
  return { idUsuario, nombre };
}

function relevo(idRelevo: number): RespuestaRelevo {
  return {
    idRelevo,
    idGrupo: 1,
    nombreGrupo: 'Grupo',
    idAdulto: 5,
    nombreAdulto: 'Adulto',
    saliente: persona(1, 'Saliente'),
    entrante: persona(2, 'Entrante'),
    creador: persona(1, 'Saliente'),
    fechaTraspaso: '2026-11-02T08:00:00-03:00',
    notas: null,
    idEstado: 1,
    codigoEstado: 'COMPLETADA',
    totalTareas: 2,
    totalAlertas: 1,
    detalles: [],
  };
}

function resumen(idRelevo: number): RespuestaRelevoResumen {
  const { detalles, notas, ...resto } = relevo(idRelevo);
  return resto;
}

function pagina(elementos: RespuestaRelevoResumen[]): RespuestaPagina<RespuestaRelevoResumen> {
  return { elementos, pagina: 0, tamano: 20, total: elementos.length };
}

describe('ServicioRelevos', () => {
  let servicio: ServicioRelevos;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioRelevos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('registrarEnviaLosDatosConPost', () => {
    const datos: SolicitudRegistrarRelevo = {
      idAdulto: 5,
      idUsuarioSaliente: 1,
      idUsuarioEntrante: 2,
      notas: 'Todo en orden',
    };
    servicio.registrar(1, datos).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/relevos'),
    );
    expect(peticion.request.body).toEqual(datos);
    peticion.flush(relevo(9));
  });

  it('listarSinFiltroNoEnviaParametros', () => {
    servicio.listar(1).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/relevos'),
    );
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    expect(peticion.request.params.has('pagina')).toBe(false);
    expect(peticion.request.params.has('tamano')).toBe(false);
    peticion.flush(pagina([resumen(1)]));
  });

  it('listarEnviaElAdultoLaPaginaYElTamanoIndicados', () => {
    servicio.listar(1, { idAdulto: 5, pagina: 1, tamano: 10 }).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/relevos'),
    );
    expect(peticion.request.params.get('idAdulto')).toBe('5');
    expect(peticion.request.params.get('pagina')).toBe('1');
    expect(peticion.request.params.get('tamano')).toBe('10');
    peticion.flush(pagina([]));
  });

  it('obtenerConsultaElRelevoPorId', () => {
    servicio.obtener(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/relevos/9'),
    );
    peticion.flush(relevo(9));
  });

  it('cancelarEnviaUnPostAlEndpointDeCancelacion', () => {
    servicio.cancelar(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/relevos/9/cancelar'),
    );
    expect(peticion.request.body).toEqual({});
    peticion.flush(relevo(9));
  });
});
