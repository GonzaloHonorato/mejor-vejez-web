import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioAuditoria } from './servicio-auditoria';
import { RespuestaEventoAuditoria } from './modelos-auditoria';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';

function evento(idEvento: number): RespuestaEventoAuditoria {
  return {
    idEvento,
    fechaEvento: '2026-11-02T08:00:00-03:00',
    nombreServicio: 'relevos',
    tipoEntidad: 'TRASPASO_FAMILIAR',
    idEntidad: '5',
    idGrupo: 1,
    actor: { idUsuario: 9, nombre: 'Actor' },
    codigoAccion: 'REGISTRAR_RELEVO',
    idResultado: 1,
    codigoResultado: 'EXITO',
    idCorrelacion: 'abc-123',
    detalles: { idAdulto: 3 },
  };
}

function pagina(elementos: RespuestaEventoAuditoria[]): RespuestaPagina<RespuestaEventoAuditoria> {
  return { elementos, pagina: 0, tamano: 20, total: elementos.length };
}

describe('ServicioAuditoria', () => {
  let servicio: ServicioAuditoria;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioAuditoria);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consultarGrupoEnviaSiemprePaginaYTamano', () => {
    servicio.consultarGrupo(1, {}, 2, 10).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/auditoria'),
    );
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('tamano')).toBe('10');
    expect(peticion.request.params.has('tipoEntidad')).toBe(false);
    peticion.flush(pagina([evento(1)]));
  });

  it('consultarGrupoEnviaLosFiltrosIndicados', () => {
    servicio
      .consultarGrupo(
        1,
        {
          tipoEntidad: 'TAREA_CUIDADO',
          idEntidad: '9',
          codigoAccion: 'REGISTRAR_RELEVO',
          codigoResultado: 'EXITO',
          desde: '2026-10-01',
          hasta: '2026-10-31',
        },
        0,
        20,
      )
      .subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/auditoria'),
    );
    expect(peticion.request.params.get('tipoEntidad')).toBe('TAREA_CUIDADO');
    expect(peticion.request.params.get('idEntidad')).toBe('9');
    expect(peticion.request.params.get('codigoAccion')).toBe('REGISTRAR_RELEVO');
    expect(peticion.request.params.get('codigoResultado')).toBe('EXITO');
    expect(peticion.request.params.get('desde')).toBe('2026-10-01');
    expect(peticion.request.params.get('hasta')).toBe('2026-10-31');
    expect(peticion.request.params.has('idGrupo')).toBe(false);
    peticion.flush(pagina([]));
  });

  it('losFiltrosVaciosNuloOCadenaVaciaNoSeEnvian', () => {
    servicio
      .consultarGrupo(1, { tipoEntidad: '', idEntidad: null, codigoAccion: undefined }, 0, 20)
      .subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/auditoria'),
    );
    expect(peticion.request.params.has('tipoEntidad')).toBe(false);
    expect(peticion.request.params.has('idEntidad')).toBe(false);
    expect(peticion.request.params.has('codigoAccion')).toBe(false);
    peticion.flush(pagina([]));
  });

  it('consultarGlobalUsaLaRutaGlobalYEnviaElIdGrupoDelFiltroCuandoViene', () => {
    servicio.consultarGlobal({ idGrupo: 7 }, 0, 20).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/auditoria'),
    );
    expect(peticion.request.params.get('idGrupo')).toBe('7');
    peticion.flush(pagina([]));
  });

  it('consultarGlobalSinIdGrupoNoLoEnvia', () => {
    servicio.consultarGlobal({}, 0, 20).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/auditoria'),
    );
    expect(peticion.request.params.has('idGrupo')).toBe(false);
    peticion.flush(pagina([]));
  });
});
