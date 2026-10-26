import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioPlanes } from './servicio-planes';
import { RespuestaDetallePlan } from './modelos-planificacion';

function detalle(idDetallePlan: number): RespuestaDetallePlan {
  return {
    idDetallePlan,
    idPlan: 5,
    idMedicamento: 1,
    nombreMedicamento: 'Paracetamol',
    idPresentacion: 1,
    concentracion: '500 mg',
    instrucciones: null,
    dosisCantidad: 1,
    idUnidadDosis: 1,
    diasSemana: [1],
    horas: ['08:00'],
    fechaInicio: '2026-01-01',
    fechaFin: null,
    cantidadInicial: 30,
    cantidadDisponible: 30,
    fechaEstimadaTermino: null,
    modoCalculoTermino: 'AUTOMATICO',
    idResponsablePredeterminado: null,
    idEstado: 1,
    fechaCreacion: '2026-01-01T00:00:00-03:00',
    fechaActualizacion: null,
  };
}

describe('ServicioPlanes', () => {
  let servicio: ServicioPlanes;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioPlanes);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarEnviaSoloLosFiltrosIndicados', () => {
    servicio.listar(1).subscribe();
    const sinFiltros = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/planes'),
    );
    expect(sinFiltros.request.params.has('idAdulto')).toBe(false);
    expect(sinFiltros.request.params.has('incluirInactivos')).toBe(false);
    sinFiltros.flush([]);

    servicio.listar(1, { idAdulto: 2 }).subscribe();
    const soloAdulto = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/planes'),
    );
    expect(soloAdulto.request.params.get('idAdulto')).toBe('2');
    expect(soloAdulto.request.params.has('incluirInactivos')).toBe(false);
    soloAdulto.flush([]);

    servicio.listar(1, { idAdulto: 2, incluirInactivos: true }).subscribe();
    const ambos = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/planes'),
    );
    expect(ambos.request.params.get('idAdulto')).toBe('2');
    expect(ambos.request.params.get('incluirInactivos')).toBe('true');
    ambos.flush([]);
  });

  it('actualizarCantidadEnviaElCuerpo', () => {
    servicio.actualizarCantidad(1, 5, 9, 12.5).subscribe();

    const peticion = http.expectOne(
      (req) =>
        req.method === 'PUT' && req.url.endsWith('/api/grupos/1/planes/5/detalles/9/cantidad'),
    );
    expect(peticion.request.body).toEqual({ cantidadDisponible: 12.5 });
    peticion.flush(detalle(9));
  });
});
