import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { RespuestaGrupo } from './modelos-grupos';
import { ServicioGrupoActivo } from './servicio-grupo-activo';
import { ServicioGrupos } from './servicio-grupos';

/** Observable que se resuelve manualmente desde la prueba (controla el orden de llegada). */
function observableDiferida<T>(): { observable: Observable<T>; resolver: (valor: T) => void } {
  let resolverInterno: ((valor: T) => void) | null = null;
  const observable = new Observable<T>((suscriptor) => {
    resolverInterno = (valor: T) => {
      suscriptor.next(valor);
      suscriptor.complete();
    };
  });
  return {
    observable,
    resolver: (valor: T) => {
      if (!resolverInterno) {
        throw new Error('El observable aún no fue suscrito');
      }
      resolverInterno(valor);
    },
  };
}

const CLAVE_ALMACENAMIENTO = 'mv.grupoActivo';

function grupo(idGrupo: number): RespuestaGrupo {
  return {
    idGrupo,
    nombreGrupo: `Grupo ${idGrupo}`,
    notificaCoordinador: true,
    idEstado: 1,
    miRol: 'COORDINADOR',
    fechaCreacion: '2026-01-01T00:00:00-03:00',
  };
}

function configurar(grupos: RespuestaGrupo[]): ServicioGrupoActivo {
  TestBed.configureTestingModule({
    providers: [{ provide: ServicioGrupos, useValue: { listar: () => of(grupos) } }],
  });
  return TestBed.inject(ServicioGrupoActivo);
}

describe('ServicioGrupoActivo', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('restauraElGrupoGuardadoSiSigueDisponible', async () => {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, '2');
    const servicio = configurar([grupo(1), grupo(2), grupo(3)]);

    await servicio.cargar();

    expect(servicio.activo()?.idGrupo).toBe(2);
    expect(servicio.grupos().map((g) => g.idGrupo)).toEqual([1, 2, 3]);
  });

  it('grupoActivoInaccesibleSeReemplaza', async () => {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, '99');
    const servicio = configurar([grupo(1), grupo(2)]);

    await servicio.cargar();

    expect(servicio.activo()?.idGrupo).toBe(1);
  });

  it('sinGruposQuedaEnNull', async () => {
    const servicio = configurar([]);

    await servicio.cargar();

    expect(servicio.activo()).toBeNull();
  });

  it('funcionaSinLocalStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage bloqueado');
    });
    const servicio = configurar([grupo(1), grupo(2)]);

    await expect(servicio.cargar()).resolves.toBeUndefined();

    expect(servicio.activo()?.idGrupo).toBe(1);
  });

  it('seleccionarCambiaElActivoYLoGuarda', async () => {
    const servicio = configurar([grupo(1), grupo(2)]);
    await servicio.cargar();

    servicio.seleccionar(2);

    expect(servicio.activo()?.idGrupo).toBe(2);
    expect(localStorage.getItem(CLAVE_ALMACENAMIENTO)).toBe('2');
  });

  it('cargasConcurrentesAplicanSoloLaUltima', async () => {
    const primera = observableDiferida<RespuestaGrupo[]>();
    const segunda = observableDiferida<RespuestaGrupo[]>();
    let llamada = 0;
    const listar = vi.fn(() => (++llamada === 1 ? primera.observable : segunda.observable));
    TestBed.configureTestingModule({ providers: [{ provide: ServicioGrupos, useValue: { listar } }] });
    const servicio = TestBed.inject(ServicioGrupoActivo);

    const promesaPrimera = servicio.cargar();
    const promesaSegunda = servicio.cargar();

    // Responde primero la llamada más reciente (segunda)...
    segunda.resolver([grupo(2)]);
    await promesaSegunda;
    // ...y luego, fuera de orden, la más antigua (primera) con datos distintos.
    primera.resolver([grupo(1)]);
    await promesaPrimera;

    expect(servicio.activo()?.idGrupo).toBe(2);
    expect(servicio.grupos().map((g) => g.idGrupo)).toEqual([2]);
  });

  it('cargarFallidoNoRechazaLaPromesaYDejaEstadoVacioConError', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ServicioGrupos,
          useValue: { listar: () => throwError(() => new Error('boom')) },
        },
      ],
    });
    const servicio = TestBed.inject(ServicioGrupoActivo);

    await expect(servicio.cargar()).resolves.toBeUndefined();

    expect(servicio.activo()).toBeNull();
    expect(servicio.grupos()).toEqual([]);
    expect(servicio.error()).toBeTruthy();
  });

  it('limpiarDejaSinGruposNiActivo', async () => {
    const servicio = configurar([grupo(1)]);
    await servicio.cargar();

    servicio.limpiar();

    expect(servicio.activo()).toBeNull();
    expect(servicio.grupos()).toEqual([]);
    expect(localStorage.getItem(CLAVE_ALMACENAMIENTO)).toBeNull();
  });
});
