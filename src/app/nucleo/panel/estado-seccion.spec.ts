import { Subject, of, throwError } from 'rxjs';

import { EstadoSeccion } from './estado-seccion';

describe('EstadoSeccion', () => {
  it('primeraCargaExitosaConDatos', () => {
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.cargar(() => of(5), (valor) => valor === 0);

    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(5);
    expect(estadoSeccion.desactualizada()).toBe(false);
  });

  it('primeraCargaVaciaQuedaVacio', () => {
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.cargar(() => of(0), (valor) => valor === 0);

    expect(estadoSeccion.estado()).toBe('vacio');
    expect(estadoSeccion.datos()).toBe(0);
  });

  it('primeraCargaFallidaQuedaError', () => {
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.cargar(() => throwError(() => new Error('falló')), (valor) => valor === 0);

    expect(estadoSeccion.estado()).toBe('error');
    expect(estadoSeccion.datos()).toBeNull();
    expect(estadoSeccion.desactualizada()).toBe(false);
  });

  it('reintentarRepiteLaUltimaFuente', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    let llamadas = 0;
    const fuente = () => {
      llamadas++;
      return llamadas === 1 ? throwError(() => new Error('falló')) : of(7);
    };

    estadoSeccion.cargar(fuente, (valor) => valor === 0);
    expect(estadoSeccion.estado()).toBe('error');

    estadoSeccion.reintentar();

    expect(llamadas).toBe(2);
    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(7);
  });

  it('reintentarSinCargaPreviaNoHaceNada', () => {
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.reintentar();

    expect(estadoSeccion.estado()).toBe('cargando');
    expect(estadoSeccion.datos()).toBeNull();
  });

  it('refrescoFallidoConservaDatosYMarcaDesactualizada', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    let llamadas = 0;
    const fuente = () => {
      llamadas++;
      return llamadas === 1 ? of(5) : throwError(() => new Error('falló'));
    };

    estadoSeccion.cargar(fuente, (valor) => valor === 0);
    expect(estadoSeccion.estado()).toBe('datos');

    estadoSeccion.refrescar();

    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(5);
    expect(estadoSeccion.desactualizada()).toBe(true);
  });

  it('refrescoExitosoQuitaDesactualizada', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    let llamadas = 0;
    const fuente = () => {
      llamadas++;
      return llamadas === 1 ? of(5) : llamadas === 2 ? throwError(() => new Error('falló')) : of(9);
    };

    estadoSeccion.cargar(fuente, (valor) => valor === 0);
    estadoSeccion.refrescar();
    expect(estadoSeccion.desactualizada()).toBe(true);

    estadoSeccion.refrescar();

    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(9);
    expect(estadoSeccion.desactualizada()).toBe(false);
  });

  it('refrescoNoVuelveACargandoMientrasEspera', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    const sujeto = new Subject<number>();

    estadoSeccion.cargar(() => of(5), (valor) => valor === 0);
    expect(estadoSeccion.estado()).toBe('datos');

    estadoSeccion.refrescar();
    // Aún no respondió nada; la sección no debe volver a 'cargando'.
    expect(estadoSeccion.estado()).toBe('datos');
    sujeto.complete();
  });

  it('respuestaDeGeneracionAnteriorSeDescarta', () => {
    const sujetoAntiguo = new Subject<number>();
    const sujetoNuevo = new Subject<number>();
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.cargar(() => sujetoAntiguo.asObservable(), (valor) => valor === 0);
    estadoSeccion.limpiar();
    estadoSeccion.cargar(() => sujetoNuevo.asObservable(), (valor) => valor === 0);

    // Llega tarde: es de la generación anterior (antes de limpiar() + nueva cargar()).
    sujetoAntiguo.next(99);

    expect(estadoSeccion.estado()).toBe('cargando');
    expect(estadoSeccion.datos()).toBeNull();

    sujetoNuevo.next(3);

    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(3);
  });

  it('limpiarVuelveACargandoSinDatos', () => {
    const estadoSeccion = new EstadoSeccion<number>();

    estadoSeccion.cargar(() => of(5), (valor) => valor === 0);
    expect(estadoSeccion.estado()).toBe('datos');

    estadoSeccion.limpiar();

    expect(estadoSeccion.estado()).toBe('cargando');
    expect(estadoSeccion.datos()).toBeNull();
    expect(estadoSeccion.desactualizada()).toBe(false);
  });

  it('reintentarConDatosDesactualizadosNoBorraLosDatos', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    const sujeto = new Subject<number>();
    let llamadas = 0;
    const fuente = () => {
      llamadas++;
      if (llamadas === 1) return of(5);
      if (llamadas === 2) return throwError(() => new Error('falló'));
      return sujeto.asObservable();
    };

    estadoSeccion.cargar(fuente, (valor) => valor === 0);
    estadoSeccion.refrescar();
    expect(estadoSeccion.desactualizada()).toBe(true);
    expect(estadoSeccion.datos()).toBe(5);

    estadoSeccion.reintentar();

    // Mientras espera la respuesta de "Reintentar", los datos nunca desaparecen
    // ni el estado pasa por "cargando": un refresco fallido no borra los
    // datos, y eso también aplica al botón "Reintentar".
    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(5);

    sujeto.next(9);

    expect(estadoSeccion.estado()).toBe('datos');
    expect(estadoSeccion.datos()).toBe(9);
    expect(estadoSeccion.desactualizada()).toBe(false);
  });

  it('limpiarOlvidaLaFuente', () => {
    const estadoSeccion = new EstadoSeccion<number>();
    let llamadas = 0;
    const fuente = () => {
      llamadas++;
      return of(5);
    };

    estadoSeccion.cargar(fuente, (valor) => valor === 0);
    estadoSeccion.limpiar();

    estadoSeccion.refrescar();
    estadoSeccion.reintentar();

    // Sin `cargar()` posterior, `refrescar()` y `reintentar()` no deben pedir
    // de nuevo la fuente del grupo/adulto anterior.
    expect(llamadas).toBe(1);
    expect(estadoSeccion.estado()).toBe('cargando');
    expect(estadoSeccion.datos()).toBeNull();
  });
});
