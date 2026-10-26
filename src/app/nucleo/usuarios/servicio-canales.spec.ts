import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ServicioCanales, RespuestaCanales, SolicitudCanal } from './servicio-canales';

function canales(): RespuestaCanales {
  return {
    canales: [
      { canal: 'CORREO', destino: 'persona@correo.cl', habilitado: true, predeterminado: true },
    ],
    whatsappDisponible: false,
  };
}

describe('ServicioCanales', () => {
  let servicio: ServicioCanales;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServicioCanales);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtenerConsultaMisCanales', () => {
    servicio.obtener().subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'GET' && req.url.endsWith('/api/yo/canales'),
    );
    peticion.flush(canales());
  });

  it('actualizarEnviaElConjuntoCompletoDeCanalesConPut', () => {
    const nuevosCanales: SolicitudCanal[] = [
      { canal: 'CORREO', destino: 'otra@correo.cl', habilitado: true },
      { canal: 'WHATSAPP', destino: '+56912345678', habilitado: true },
    ];
    servicio.actualizar(nuevosCanales).subscribe();

    const peticion = http.expectOne(
      (req) => req.method === 'PUT' && req.url.endsWith('/api/yo/canales'),
    );
    expect(peticion.request.body).toEqual({ canales: nuevosCanales });
    peticion.flush(canales());
  });
});
