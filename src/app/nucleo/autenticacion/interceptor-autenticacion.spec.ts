import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { configuracionEjecucion } from '../configuracion/configuracion-ejecucion';
import { interceptorAutenticacion } from './interceptor-autenticacion';
import { ServicioAutenticacion } from './servicio-autenticacion';

const URL_API = 'https://api.x.cl';

describe('interceptorAutenticacion', () => {
  let urlApiOriginal: string;

  beforeEach(() => {
    urlApiOriginal = configuracionEjecucion.urlApi;
    configuracionEjecucion.urlApi = URL_API;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorAutenticacion])),
        provideHttpClientTesting(),
        { provide: ServicioAutenticacion, useValue: { tokenId: vi.fn().mockResolvedValue('token-abc') } },
      ],
    });
  });

  afterEach(() => {
    configuracionEjecucion.urlApi = urlApiOriginal;
    TestBed.inject(HttpTestingController).verify();
  });

  async function cabeceraAutorizacionPara(url: string): Promise<string | null> {
    TestBed.inject(HttpClient).get(url).subscribe();
    // El token llega de una promesa: dejamos correr la microtarea antes de buscar la petición.
    await Promise.resolve();
    await Promise.resolve();
    const peticion = TestBed.inject(HttpTestingController).expectOne(url);
    const cabecera = peticion.request.headers.get('Authorization');
    peticion.flush({});
    return cabecera;
  }

  it('agregaElTokenALasLlamadasAlOrigenDeLaApi', async () => {
    expect(await cabeceraAutorizacionPara(`${URL_API}/api/yo`)).toBe('Bearer token-abc');
  });

  it('noAgregaElTokenAUnOrigenQueSoloEmpiezaIgual', async () => {
    expect(await cabeceraAutorizacionPara('https://api.x.cl.otro.com/api/yo')).toBeNull();
  });
});
