import { signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

/**
 * Intervalo de refresco silencioso del panel (regla 10 del plan): cada 2
 * minutos, y solo mientras la pestaña está visible.
 */
export const INTERVALO_REFRESCO_MS = 120_000;

/** Estado de carga de una sección del panel (regla 9 del plan). */
export type EstadoCarga = 'cargando' | 'datos' | 'vacio' | 'error';

/**
 * Estado de una sección del panel familiar (regla 9 del plan). NO es un
 * servicio: se instancia sin inyección (`new EstadoSeccion<T>()`), una por
 * sección, porque cada sección tiene su propia fuente de datos.
 *
 * - `cargar` arranca una nueva "generación" de carga: cualquier respuesta
 *   (éxito o error) de una generación anterior, que llegue después de
 *   `limpiar()` o de una nueva `cargar()`/`reintentar()`, se descarta.
 * - `refrescar` es silencioso: si ya hay datos no vuelve a "cargando"; si
 *   falla, conserva los datos y marca `desactualizada`.
 * - `reintentar` repite la última fuente: si la sección ya tiene datos
 *   (estado `'datos'` o `'vacio'`, es decir, está `desactualizada`) delega en
 *   `refrescar()` para no borrarlos mientras espera; si no hay datos (estado
 *   `'error'`), repite desde cero como `cargar`.
 * - `limpiar` vuelve a "cargando", borra los datos, invalida cualquier
 *   respuesta en vuelo y olvida la última fuente (`refrescar`/`reintentar`
 *   sin una `cargar()` posterior no hacen nada).
 */
export class EstadoSeccion<T> {
  private readonly estadoSenal = signal<EstadoCarga>('cargando');
  private readonly datosSenal = signal<T | null>(null);
  private readonly desactualizadaSenal = signal(false);

  readonly estado = this.estadoSenal.asReadonly();
  readonly datos = this.datosSenal.asReadonly();
  readonly desactualizada = this.desactualizadaSenal.asReadonly();

  private generacion = 0;
  private suscripcion: Subscription | null = null;
  private ultimaFuente: (() => Observable<T>) | null = null;
  private ultimoEsVacio: ((valor: T) => boolean) | null = null;

  /** Primera carga (o recarga completa) de la sección: vuelve a "cargando". */
  cargar(fuente: () => Observable<T>, esVacio: (valor: T) => boolean): void {
    this.ultimaFuente = fuente;
    this.ultimoEsVacio = esVacio;
    this.suscribir(fuente, esVacio, false);
  }

  /**
   * Repite la última fuente pasada a `cargar` (botón "Reintentar"). Si la
   * sección ya tiene datos (estado `'datos'` o `'vacio'`, es decir, está
   * `desactualizada` tras un refresco fallido), delega en `refrescar()`: así
   * nunca borra los datos que el refresco silencioso conservó (I-1). Si no
   * hay datos (estado `'error'`), repite desde cero como `cargar`.
   */
  reintentar(): void {
    if (!this.ultimaFuente || !this.ultimoEsVacio) {
      return;
    }
    const tieneDatos = this.estadoSenal() === 'datos' || this.estadoSenal() === 'vacio';
    if (tieneDatos) {
      this.refrescar();
      return;
    }
    this.suscribir(this.ultimaFuente, this.ultimoEsVacio, false);
  }

  /**
   * Refresco silencioso (regla 10 del plan): si ya hay datos ('datos' o
   * 'vacio'), no cambia a "cargando" mientras espera. Si falla, conserva los
   * datos actuales y marca `desactualizada`; si tiene éxito, la quita.
   */
  refrescar(): void {
    if (!this.ultimaFuente || !this.ultimoEsVacio) {
      return;
    }
    this.suscribir(this.ultimaFuente, this.ultimoEsVacio, true);
  }

  /**
   * Vuelve a "cargando", borra los datos, invalida las respuestas en vuelo y
   * olvida la última fuente (M-2): sin una `cargar()` posterior, `refrescar()`
   * y `reintentar()` no deben repetir la fuente del grupo/adulto anterior.
   */
  limpiar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.generacion++;
    this.estadoSenal.set('cargando');
    this.datosSenal.set(null);
    this.desactualizadaSenal.set(false);
    this.ultimaFuente = null;
    this.ultimoEsVacio = null;
  }

  /**
   * Arma la suscripción, común a `cargar`/`reintentar` (silencioso = false,
   * vuelve a "cargando" y borra los datos antes de pedir) y a
   * `refrescar`/`reintentar` con datos (silencioso = true, conserva los
   * datos mientras espera y, si falla, los conserva marcando
   * `desactualizada` en vez de pasar a "error").
   *
   * OJO: no lee ninguna señal propia antes de suscribirse (solo escribe). Si
   * `cargar()` corre dentro del `effect()` de la página (regla 11), leer una
   * señal acá quedaría registrada como dependencia de ESE effect, y una
   * escritura posterior (p.ej. el error de esta misma carga) lo volvería a
   * disparar: reiniciaría las 5 secciones en bucle. Por eso `teniaDatos` se
   * calcula recién dentro de `error`, cuando ya no hay ningún effect activo.
   */
  private suscribir(
    fuente: () => Observable<T>,
    esVacio: (valor: T) => boolean,
    silencioso: boolean,
  ): void {
    this.suscripcion?.unsubscribe();
    const generacionActual = ++this.generacion;
    if (!silencioso) {
      this.estadoSenal.set('cargando');
      this.datosSenal.set(null);
      this.desactualizadaSenal.set(false);
    }
    this.suscripcion = fuente().subscribe({
      next: (valor) => {
        if (generacionActual !== this.generacion) {
          return;
        }
        this.desactualizadaSenal.set(false);
        this.datosSenal.set(valor);
        this.estadoSenal.set(esVacio(valor) ? 'vacio' : 'datos');
      },
      error: () => {
        if (generacionActual !== this.generacion) {
          return;
        }
        const teniaDatos =
          silencioso && (this.estadoSenal() === 'datos' || this.estadoSenal() === 'vacio');
        if (teniaDatos) {
          this.desactualizadaSenal.set(true);
        } else {
          this.estadoSenal.set('error');
          this.datosSenal.set(null);
        }
      },
    });
  }
}
