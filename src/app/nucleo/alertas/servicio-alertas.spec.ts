import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioAlertas } from './servicio-alertas';
import { RespuestaAlerta, RespuestaAlertaDetallada } from './modelos-alertas';
import { RespuestaPagina } from '../usuarios/modelos-usuarios';

function alerta(idAlerta: number): RespuestaAlerta {
  return {
    idAlerta,
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
    idEstado: 1,
    fechaDeteccion: '2026-11-02T08:30:00-03:00',
    revisor: null,
    fechaRevision: null,
    observacionCierre: null,
  };
}

function pagina(elementos: RespuestaAlerta[]): RespuestaPagina<RespuestaAlerta> {
  return { elementos, pagina: 0, tamano: 20, total: elementos.length };
}

function alertaDetallada(idAlerta: number): RespuestaAlertaDetallada {
  return { alerta: alerta(idAlerta), intentos: [] };
}

describe('ServicioAlertas', () => {
  let servicio: ServicioAlertas;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioAlertas);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarSinFiltroNoEnviaParametros', () => {
    servicio.listar(1, {}).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/alertas'),
    );
    expect(peticion.request.params.has('idEstado')).toBe(false);
    expect(peticion.request.params.has('tipoAlerta')).toBe(false);
    expect(peticion.request.params.has('idAdulto')).toBe(false);
    expect(peticion.request.params.has('pagina')).toBe(false);
    expect(peticion.request.params.has('tamano')).toBe(false);
    peticion.flush(pagina([alerta(1)]));
  });

  it('listarEnviaTodosLosFiltrosIndicados', () => {
    servicio
      .listar(1, { idEstado: 1, tipoAlerta: 'CITA_PROXIMA', idAdulto: 3, pagina: 2, tamano: 10 })
      .subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/alertas'),
    );
    expect(peticion.request.params.get('idEstado')).toBe('1');
    expect(peticion.request.params.get('tipoAlerta')).toBe('CITA_PROXIMA');
    expect(peticion.request.params.get('idAdulto')).toBe('3');
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('tamano')).toBe('10');
    peticion.flush(pagina([]));
  });

  it('obtenerConsultaElDetalleDeLaAlerta', () => {
    servicio.obtener(1, 9).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/grupos/1/alertas/9'),
    );
    peticion.flush(alertaDetallada(9));
  });

  it('cerrarEnviaLaObservacionAlEndpointDeCierreConPost', () => {
    servicio.cerrar(1, 9, 'Ya se confirmó').subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'POST' && req.url.endsWith('/api/grupos/1/alertas/9/cierre'),
    );
    expect(peticion.request.body).toEqual({ observacion: 'Ya se confirmó' });
    peticion.flush(alertaDetallada(9));
  });
});
