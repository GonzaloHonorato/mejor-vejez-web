import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioCatalogos } from './servicio-catalogos';

describe('ServicioCatalogos', () => {
  let servicio: ServicioCatalogos;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioCatalogos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('estadosEnviaTablaYCampo', () => {
    servicio.estados('USUARIO', 'ESTADO').subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/catalogos/estados'),
    );
    expect(peticion.request.params.get('tabla')).toBe('USUARIO');
    expect(peticion.request.params.get('campo')).toBe('ESTADO');
    peticion.flush([]);
  });

  it('opcionesEnviaElTipo', () => {
    servicio.opciones('DIA_SEMANA').subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/catalogos/opciones'),
    );
    expect(peticion.request.params.get('tipo')).toBe('DIA_SEMANA');
    peticion.flush([
      { idOpcion: 1, codigo: 'LUNES', descripcion: 'Lunes', orden: 1 },
    ]);
  });
});
