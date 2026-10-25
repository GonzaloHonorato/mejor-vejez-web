import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioAdultos } from './servicio-adultos';
import { RespuestaContacto } from './modelos-adultos';

function contacto(idContacto: number): RespuestaContacto {
  return {
    idContacto,
    idAdultoMayor: 2,
    nombreContacto: 'Juana Pérez',
    parentesco: 'Hija',
    telefono: '+56911111111',
    esPrincipal: false,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: '2026-01-01T00:00:00-03:00',
  };
}

describe('ServicioAdultos', () => {
  let servicio: ServicioAdultos;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioAdultos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarEnviaIncluirInactivosSoloSiSePide', () => {
    servicio.listar(1).subscribe();
    const sinParametro = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/adultos'),
    );
    expect(sinParametro.request.params.has('incluirInactivos')).toBe(false);
    sinParametro.flush([]);

    servicio.listar(1, true).subscribe();
    const conParametro = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/adultos'),
    );
    expect(conParametro.request.params.get('incluirInactivos')).toBe('true');
    conParametro.flush([]);
  });

  it('desactivarContactoEnviaElNuevoPrincipal', () => {
    servicio.desactivarContacto(1, 2, 3).subscribe();
    const sinReemplazo = http.expectOne(
      (req) =>
        req.method === 'POST' && req.url.endsWith('/api/grupos/1/adultos/2/contactos/3/desactivar'),
    );
    expect(sinReemplazo.request.body).toEqual({});
    sinReemplazo.flush(contacto(3));

    servicio.desactivarContacto(1, 2, 3, 9).subscribe();
    const conReemplazo = http.expectOne(
      (req) =>
        req.method === 'POST' && req.url.endsWith('/api/grupos/1/adultos/2/contactos/3/desactivar'),
    );
    expect(conReemplazo.request.body).toEqual({ idNuevoPrincipal: 9 });
    conReemplazo.flush(contacto(3));
  });
});
