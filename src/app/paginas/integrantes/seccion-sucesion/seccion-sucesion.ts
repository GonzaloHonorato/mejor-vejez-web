import {
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subscription, forkJoin } from 'rxjs';

import { Icono } from '../../../compartido/icono/icono';
import { descripcionEstado } from '../../../nucleo/catalogos/descripcion-estado';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../../nucleo/catalogos/servicio-catalogos';
import { fechaHoraConAnio } from '../../../nucleo/fecha-legible';
import { RespuestaIntegrante } from '../../../nucleo/grupos/modelos-grupos';
import { mensajeDeError } from '../../../nucleo/http/mensaje-de-error';
import { RespuestaPropuesta, SolicitudReasignacion } from '../../../nucleo/sucesion/modelos-sucesion';
import { ServicioSucesion } from '../../../nucleo/sucesion/servicio-sucesion';
import {
  devolverFoco,
  mostrarAviso,
  mostrarSeccion,
  porId,
  rescatarFoco,
} from '../../../nucleo/foco';

/** Rol que se excluye del selector de candidato. */
const ROL_COORDINADOR = 'COORDINADOR';
/** Tope de `SolicitudCancelarSucesion.motivo` en la API. */
export const LARGO_MAXIMO_MOTIVO = 500;

/**
 * Sección "Sucesión de la coordinación" dentro de la página Integrantes.
 * Carga la propuesta activa y el historial del grupo `idGrupo`, y según el
 * estado y quién mira ofrece:
 * - coordinador sin propuesta activa: selector de candidato (integrantes
 *   ACTIVO no coordinadores) y "Proponer sucesor";
 * - PENDIENTE: "Esperando la respuesta de {candidato}"; el candidato ve
 *   Aceptar/Rechazar y el saliente o el administrador "Cancelar propuesta";
 * - ACEPTADA: "Condiciones pendientes" con un selector de nuevo responsable
 *   por tarea (integrantes ACTIVO menos el saliente; por omisión el
 *   candidato) y "Completar transferencia", que envía todas las
 *   reasignaciones; también "Cancelar propuesta".
 *
 * Los permisos de la UI calcan los de la API: proponer solo un
 * coordinador con membresía (`soyCoordinador`, nunca el administrador sin
 * ella); responder solo el candidato; cancelar y completar el saliente o un
 * administrador. La API sigue siendo la que decide.
 *
 * "Cancelar propuesta" pide confirmación con un paso inline (el mismo patrón
 * de "Confirmar"/"Cancelar" del reemplazo de contacto principal en
 * `contactos-adulto`), con el motivo opcional; nunca `window.confirm`.
 *
 * Tras cada acción, con éxito o con error (un 409/422 suele significar que
 * la propuesta o la membresía cambiaron), se recargan la propuesta activa y
 * el historial y se emite `cambio`, para que la página recargue los
 * integrantes (los roles cambian al completar). `procesando` sigue en `true`
 * durante esa recarga (no solo mientras responde la acción): así no queda
 * una ventana entre el éxito y la recarga en la que un segundo clic
 * dispare la misma acción sobre datos todavía viejos. Un `effect()` sobre
 * `idGrupo` dispara la carga con un contador de generación que descarta
 * respuestas tardías de una carga anterior.
 */
@Component({
  selector: 'app-seccion-sucesion',
  imports: [ReactiveFormsModule, Icono],
  templateUrl: './seccion-sucesion.html',
  styleUrl: './seccion-sucesion.scss',
})
export class SeccionSucesion {
  private readonly servicioSucesion = inject(ServicioSucesion);
  private readonly injector = inject(Injector);
  private readonly servicioCatalogos = inject(ServicioCatalogos);

  readonly idGrupo = input.required<number>();
  readonly integrantes = input.required<RespuestaIntegrante[]>();
  readonly idUsuarioActual = input<number | null>(null);
  readonly soyCoordinador = input(false);
  readonly esAdministrador = input(false);
  /** Una acción cambió la sucesión (y quizá los roles): la página recarga los integrantes. */
  readonly cambio = output<void>();

  protected readonly largoMaximoMotivo = LARGO_MAXIMO_MOTIVO;

  protected readonly activa = signal<RespuestaPropuesta | null>(null);
  protected readonly historial = signal<RespuestaPropuesta[]>([]);
  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly cargada = signal(false);
  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal(false);
  protected readonly confirmandoCancelar = signal(false);

  protected readonly controlCandidato = new FormControl<number | null>(null);
  protected readonly controlMotivo = new FormControl('', { nonNullable: true });
  /** Nuevo responsable por tarea de las condiciones pendientes, recreados en cada carga. */
  private controlesDestino = new Map<number, FormControl<number | null>>();

  private generacion = 0;
  private suscripcionCarga: Subscription | null = null;

  private readonly activos = computed(() =>
    this.integrantes().filter((integrante) => integrante.fechaDesactivacion === null),
  );

  /** Candidatos posibles: integrantes ACTIVO que no son coordinadores. */
  protected readonly candidatos = computed(() =>
    this.activos().filter((integrante) => integrante.nombreRol !== ROL_COORDINADOR),
  );

  /** Destinos de una reasignación: integrantes ACTIVO menos el saliente. */
  protected readonly destinos = computed(() => {
    const saliente = this.activa()?.saliente.idUsuario;
    return this.activos().filter((integrante) => integrante.idUsuario !== saliente);
  });

  protected readonly esPendiente = computed(() => this.activa()?.codigoEstado === 'PENDIENTE');
  protected readonly esAceptada = computed(() => this.activa()?.codigoEstado === 'ACEPTADA');

  protected readonly puedeProponer = computed(
    () => this.cargada() && this.activa() === null && this.soyCoordinador(),
  );

  protected readonly soyCandidato = computed(() => {
    const propuesta = this.activa();
    return propuesta !== null && propuesta.candidato.idUsuario === this.idUsuarioActual();
  });

  /** El saliente o un administrador: pueden cancelar y completar. */
  protected readonly puedeGestionar = computed(() => {
    const propuesta = this.activa();
    if (!propuesta) return false;
    return propuesta.saliente.idUsuario === this.idUsuarioActual() || this.esAdministrador();
  });

  constructor() {
    effect(() => {
      const idGrupo = this.idGrupo();
      untracked(() => this.cargar(idGrupo));
    });
    this.servicioCatalogos.estados('PROPUESTA_SUCESION', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      // Defensivo: sin catálogo, la descripción queda vacía (nunca se muestra el código).
      error: () => undefined,
    });
    inject(DestroyRef).onDestroy(() => this.suscripcionCarga?.unsubscribe());
  }

  protected descripcion(idEstado: number): string {
    return descripcionEstado(this.estados(), idEstado);
  }

  /** Fecha con año y hora de Santiago de un instante ISO: "3 nov 2026 · 10:00". */
  protected fechaHora(iso: string): string {
    return fechaHoraConAnio(iso);
  }

  protected controlDestino(idTarea: number): FormControl<number | null> {
    let control = this.controlesDestino.get(idTarea);
    if (!control) {
      control = new FormControl<number | null>(null);
      this.controlesDestino.set(idTarea, control);
    }
    return control;
  }

  /**
   * Habilitado si no hay condiciones o si todas tienen destino.
   * El destino debe estar entre las opciones visibles: si los integrantes
   * aún no cargaron (o el candidato ya no está activo), el valor por
   * omisión no cuenta como elegido.
   */
  protected puedeCompletar(): boolean {
    const condiciones = this.activa()?.condicionesPendientes ?? [];
    const idsDestino = new Set(this.destinos().map((integrante) => integrante.idUsuario));
    return condiciones.every((tarea) => {
      const destino = this.controlDestino(tarea.idTarea).value;
      return destino !== null && idsDestino.has(destino);
    });
  }

  protected reintentar(): void {
    this.cargar(this.idGrupo());
  }

  protected proponer(): void {
    const idCandidato = this.controlCandidato.value;
    if (idCandidato === null) return;
    this.ejecutar(this.servicioSucesion.proponer(this.idGrupo(), idCandidato));
  }

  protected aceptar(propuesta: RespuestaPropuesta): void {
    this.ejecutar(this.servicioSucesion.aceptar(this.idGrupo(), propuesta.idPropuesta));
  }

  protected rechazar(propuesta: RespuestaPropuesta): void {
    this.ejecutar(this.servicioSucesion.rechazar(this.idGrupo(), propuesta.idPropuesta));
  }

  protected pedirCancelar(): void {
    this.controlMotivo.setValue('');
    this.confirmandoCancelar.set(true);
    mostrarSeccion(porId('sucesion-confirmar'), this.injector);
  }

  protected volverDeCancelar(): void {
    this.confirmandoCancelar.set(false);
    devolverFoco(porId('sucesion-pedir-cancelar'), this.injector);
  }

  protected confirmarCancelar(propuesta: RespuestaPropuesta): void {
    const motivo = this.controlMotivo.value.trim();
    this.ejecutar(
      this.servicioSucesion.cancelar(this.idGrupo(), propuesta.idPropuesta, motivo === '' ? null : motivo),
    );
  }

  protected completar(propuesta: RespuestaPropuesta): void {
    if (!this.puedeCompletar()) return;
    const reasignaciones: SolicitudReasignacion[] = propuesta.condicionesPendientes.map((tarea) => ({
      idTarea: tarea.idTarea,
      idUsuario: this.controlDestino(tarea.idTarea).value!,
    }));
    this.ejecutar(this.servicioSucesion.completar(this.idGrupo(), propuesta.idPropuesta, reasignaciones));
  }

  /**
   * Corre una acción: error en `role="alert"`; con éxito o con error,
   * recarga y emite `cambio` después de cada acción. `procesando`
   * sigue en `true` hasta que esa recarga termina: cierra
   * la ventana de doble envío entre el éxito de la acción y el dato fresco.
   */
  private ejecutar(accion: Observable<RespuestaPropuesta>): void {
    if (this.procesando()) return;
    this.error.set(null);
    this.procesando.set(true);
    accion.subscribe({
      next: () => {
        this.confirmandoCancelar.set(false);
        // El botón pulsado suele desaparecer (la propuesta cambió de estado):
        // el foco va al título de la sección en vez de perderse en `body`.
        this.cargar(this.idGrupo(), () => {
          this.procesando.set(false);
          rescatarFoco(porId('sucesion-titulo'), this.injector);
        });
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        mostrarAviso(porId('sucesion-error'), this.injector);
        // Un 409/422 suele significar que la propuesta o la membresía
        // cambiaron: se recarga el estado real y se avisa igual a la
        // página, para que también recargue los integrantes.
        this.cargar(this.idGrupo(), () => this.procesando.set(false));
        this.cambio.emit();
      },
    });
  }

  private cargar(idGrupo: number, alTerminar?: () => void): void {
    const generacion = ++this.generacion;
    this.suscripcionCarga?.unsubscribe();
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.suscripcionCarga = forkJoin({
      activa: this.servicioSucesion.activa(idGrupo),
      historial: this.servicioSucesion.historial(idGrupo),
    }).subscribe({
      next: ({ activa, historial }) => {
        if (generacion !== this.generacion) return;
        this.activa.set(activa);
        this.prepararDestinos(activa);
        this.historial.set(historial);
        this.controlCandidato.setValue(null);
        this.cargada.set(true);
        this.cargando.set(false);
        alTerminar?.();
      },
      error: (error: unknown) => {
        if (generacion !== this.generacion) return;
        this.activa.set(null);
        this.historial.set([]);
        this.cargada.set(false);
        this.cargando.set(false);
        this.errorCarga.set(mensajeDeError(error));
        alTerminar?.();
      },
    });
  }

  /**
   * Un control nuevo por condición, con el candidato como destino por
   * omisión. Si una tarea sigue en las condiciones pendientes y
   * su destino ya elegido sigue siendo válido (integrante ACTIVO distinto
   * del saliente de la propuesta recargada), se conserva; si no, vuelve al
   * candidato. `this.activa` ya debe estar actualizado (lo usa `destinos()`).
   */
  private prepararDestinos(propuesta: RespuestaPropuesta | null): void {
    const anteriores = this.controlesDestino;
    this.controlesDestino = new Map();
    if (!propuesta) return;

    const idsDestinoValidos = new Set(this.destinos().map((integrante) => integrante.idUsuario));
    for (const tarea of propuesta.condicionesPendientes) {
      const elegidoAntes = anteriores.get(tarea.idTarea)?.value ?? null;
      const destino =
        elegidoAntes !== null && idsDestinoValidos.has(elegidoAntes)
          ? elegidoAntes
          : propuesta.candidato.idUsuario;
      this.controlDestino(tarea.idTarea).setValue(destino);
    }
  }
}
