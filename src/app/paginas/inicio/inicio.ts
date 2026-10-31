import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AvisoSucesion } from './aviso-sucesion/aviso-sucesion';
import { fechaHoraLegible, fechaLegible } from '../../nucleo/fecha-legible';
import { SeccionPanel } from './seccion-panel/seccion-panel';
import { Icono } from '../../compartido/icono/icono';
import { RespuestaAdultoMayor } from '../../nucleo/adultos/modelos-adultos';
import { ServicioAdultos } from '../../nucleo/adultos/servicio-adultos';
import { ETIQUETA_TIPO_ALERTA } from '../../nucleo/alertas/alertas';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { EstadoSeccion, INTERVALO_REFRESCO_MS } from '../../nucleo/panel/estado-seccion';
import {
  RespuestaPanelAlertas,
  RespuestaPanelCitas,
  RespuestaPanelHorarios,
  RespuestaPanelPreventivas,
  RespuestaPanelTareas,
} from '../../nucleo/panel/modelos-panel';
import { ServicioPanel } from '../../nucleo/panel/servicio-panel';
import { RespuestaYo, ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/**
 * Cómo falló `GET /api/yo`:
 * - `reintentable`: error de red (status 0) o del servidor (5xx); vale la pena reintentar.
 * - `cuenta`: la API rechazó la cuenta (401/403/409/422...); reintentar no
 *   cambia nada, así que se muestra el motivo y se ofrece cerrar sesión.
 */
type Fallo = { tipo: 'reintentable' } | { tipo: 'cuenta'; mensaje: string };

const MENSAJE_CUENTA_GENERICO =
  'No pudimos validar tu cuenta. Cierra sesión e intenta ingresar de nuevo.';

/**
 * Página "Panel familiar": es la página de inicio. Encabezado con saludo y
 * grupo activo, aviso de "sin grupos", accesos a Relevos y "Estado del
 * servicio", y el panel con el selector de adulto y 5 secciones
 * independientes (tareas de hoy, alertas de atraso, próximos horarios,
 * citas y alertas preventivas), cada una con su propio `EstadoSeccion`
 * — así el fallo de una no bloquea a las demás.
 *
 * Tres `effect()` orquestan el panel, en este orden (como en `paginas/tareas`):
 * 1. la lista de adultos del selector solo cambia con el grupo activo;
 * 2. un cambio de grupo (no la carga inicial) hace volver el selector a
 *    "Todos";
 * 3. el grupo activo y el adulto elegido disparan `limpiar()` + `cargar()`
 *    de las 5 secciones en paralelo. El descarte de respuestas tardías de
 *    un grupo/adulto ya reemplazado lo resuelve `EstadoSeccion` por su
 *    cuenta (cada `limpiar()`/`cargar()` invalida la generación anterior).
 *
 * El refresco silencioso usa `setInterval` + `visibilitychange`,
 * limpiados en `DestroyRef`; solo refresca con la pestaña visible. Al volver
 * a visible, refresca solo si pasaron 30 s o más desde la última carga o
 * refresco: evita ráfagas al cambiar de pestaña varias veces rápido.
 * Cuando sí refresca, reinicia el intervalo de 2 minutos desde ese momento.
 *
 * Al destruir la página, se cancelan las peticiones en vuelo de las 5
 * secciones (`EstadoSeccion.limpiar()`) y la del selector de adultos.
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, ReactiveFormsModule, SeccionPanel, AvisoSucesion, Icono],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  private readonly servicioYo = inject(ServicioYo);
  private readonly auth = inject(ServicioAutenticacion);
  private readonly router = inject(Router);
  private readonly servicioAdultos = inject(ServicioAdultos);
  private readonly servicioPanel = inject(ServicioPanel);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;

  protected readonly sinGrupos = computed(() => this.grupoActivo.grupos().length === 0);
  protected readonly yo = signal<RespuestaYo | null>(null);
  protected readonly cargando = signal(false);
  protected readonly fallo = signal<Fallo | null>(null);
  protected readonly falloCerrarSesion = signal(false);

  protected readonly fechaHoraLegible = fechaHoraLegible;
  protected readonly fechaLegible = fechaLegible;
  protected readonly etiquetaTipoAlerta = ETIQUETA_TIPO_ALERTA;
  /** Filas que se muestran de las atrasadas y de las alertas recientes; el resto, con "Ver…". */
  protected readonly maximoFilas = 3;
  /** Filas que se muestran de los próximos horarios. */
  protected readonly maximoHorarios = 5;

  /** Adultos del grupo activo para el selector ("Todos" + cada uno); solo cambia con el grupo. */
  protected readonly adultosSelector = signal<RespuestaAdultoMayor[]>([]);
  protected readonly idAdultoSeleccionado = signal<number | null>(null);
  protected readonly controlAdulto = this.fb.control<number | null>(null);

  protected readonly seccionTareas = new EstadoSeccion<RespuestaPanelTareas>();
  protected readonly seccionAlertas = new EstadoSeccion<RespuestaPanelAlertas>();
  protected readonly seccionHorarios = new EstadoSeccion<RespuestaPanelHorarios>();
  protected readonly seccionCitas = new EstadoSeccion<RespuestaPanelCitas>();
  protected readonly seccionPreventivas = new EstadoSeccion<RespuestaPanelPreventivas>();

  /** idGrupo visto por el efecto de reseteo del selector; undefined hasta la primera corrida (nunca "cambió" ahí). */
  private idGrupoAnterior: number | null | undefined = undefined;
  /** Descarta respuestas de `ServicioAdultos.listar()` obsoletas (el grupo ya cambió de nuevo; mismo patrón de `paginas/tareas`). */
  private generacionAdultosSelector = 0;
  /** Suscripción en vuelo de `ServicioAdultos.listar()`; se cancela al destruir. */
  private suscripcionAdultos: Subscription | null = null;
  /** Momento (`Date.now()`) de la última carga o refresco de las secciones. */
  private ultimoRefrescoMs = 0;

  constructor() {
    // 1) Lista de adultos del selector: solo cambia con el grupo activo. Con
    // generación propia (como `paginas/tareas`): si el grupo cambia dos veces
    // rápido, una respuesta tardía del grupo anterior ya no puede pisar la
    // lista del grupo vigente.
    effect(() => {
      const grupo = this.activo();
      this.adultosSelector.set([]);
      this.suscripcionAdultos?.unsubscribe();
      if (!grupo) return;

      const generacion = ++this.generacionAdultosSelector;
      this.suscripcionAdultos = this.servicioAdultos.listar(grupo.idGrupo).subscribe({
        next: (adultos) => {
          if (generacion !== this.generacionAdultosSelector) return;
          this.adultosSelector.set(adultos);
        },
        // Defensivo: sin la lista simplemente no hay opciones en el selector.
        error: () => undefined,
      });
    });

    // 2) Si el grupo activo cambia de verdad (no en la carga inicial), el
    // selector de adulto vuelve a "Todos": el adulto elegido
    // puede no existir en el grupo nuevo.
    effect(() => {
      const grupo = this.activo();
      const idGrupo = grupo?.idGrupo ?? null;
      if (this.idGrupoAnterior === undefined) {
        this.idGrupoAnterior = idGrupo;
        return;
      }
      if (idGrupo !== this.idGrupoAnterior) {
        this.idGrupoAnterior = idGrupo;
        this.idAdultoSeleccionado.set(null);
        this.controlAdulto.setValue(null);
      }
    });

    // 3) Cambio de grupo o de adulto: limpia y recarga las 5
    // secciones en paralelo. `EstadoSeccion.limpiar()` invalida cualquier
    // respuesta en vuelo de la combinación anterior.
    effect(() => {
      const grupo = this.activo();
      const idAdulto = this.idAdultoSeleccionado();

      this.seccionTareas.limpiar();
      this.seccionAlertas.limpiar();
      this.seccionHorarios.limpiar();
      this.seccionCitas.limpiar();
      this.seccionPreventivas.limpiar();

      if (!grupo) return;
      this.cargarSecciones(grupo.idGrupo, idAdulto);
    });

    // Al destruir la página: cancela las peticiones en vuelo de las 5
    // secciones y la del selector de adultos (escriben señales de un
    // componente ya destruido si se dejan correr).
    this.destroyRef.onDestroy(() => {
      this.suscripcionAdultos?.unsubscribe();
      this.seccionTareas.limpiar();
      this.seccionAlertas.limpiar();
      this.seccionHorarios.limpiar();
      this.seccionCitas.limpiar();
      this.seccionPreventivas.limpiar();
    });
  }

  ngOnInit(): void {
    this.cargar();
    this.iniciarRefresco();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.yo.set(yo);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.fallo.set(clasificarFallo(error));
        this.cargando.set(false);
      },
    });
  }

  protected async cerrarSesion(): Promise<void> {
    this.falloCerrarSesion.set(false);
    try {
      await this.auth.cerrarSesion();
    } catch (error) {
      console.error('No se pudo cerrar la sesión', error);
      this.falloCerrarSesion.set(true);
      return;
    }
    await this.router.navigateByUrl('/ingreso');
  }

  /** Total de atrasadas para el enlace "Ver las N tareas atrasadas": nunca menos que las listadas. */
  protected totalAtrasadas(datos: RespuestaPanelTareas): number {
    return Math.max(datos.atrasadas, datos.tareasAtrasadas.length);
  }

  /**
   * Nombre accesible del enlace de una fila: título, adulto, detalle opcional y
   * fecha, para que dos filas con el mismo título se distingan.
   */
  protected etiquetaEnlace(
    titulo: string,
    nombreAdulto: string,
    fecha: string,
    detalle?: string | null,
  ): string {
    return [titulo, nombreAdulto, detalle, fecha].filter((parte) => !!parte).join(', ');
  }

  /** Etiqueta de un conteo en singular o plural ("1 pendiente", "2 pendientes"). */
  protected plural(cantidad: number, singular: string, plural: string): string {
    return cantidad === 1 ? singular : plural;
  }

  /** Cambio del selector de adulto ("Todos"/un adulto puntual): recarga las 5 secciones. */
  protected cambiarAdulto(): void {
    this.idAdultoSeleccionado.set(this.controlAdulto.value);
  }

  private cargarSecciones(idGrupo: number, idAdulto: number | null): void {
    this.ultimoRefrescoMs = Date.now();
    this.seccionTareas.cargar(
      () => this.servicioPanel.tareas(idGrupo, idAdulto),
      (datos) =>
        datos.pendientes === 0 &&
        datos.enCurso === 0 &&
        datos.completadas === 0 &&
        datos.noRealizadas === 0 &&
        datos.canceladas === 0 &&
        datos.atrasadas === 0,
    );
    this.seccionAlertas.cargar(
      () => this.servicioPanel.alertas(idGrupo, idAdulto),
      (datos) => datos.abiertas === 0 && datos.cerradasUltimos7Dias === 0,
    );
    this.seccionHorarios.cargar(
      () => this.servicioPanel.proximosHorarios(idGrupo, idAdulto),
      (datos) => datos.tareas.length === 0,
    );
    this.seccionCitas.cargar(
      () => this.servicioPanel.citas(idGrupo, idAdulto),
      (datos) => datos.citas.length === 0,
    );
    this.seccionPreventivas.cargar(
      () => this.servicioPanel.alertasPreventivas(idGrupo, idAdulto),
      (datos) => datos.alertas.length === 0,
    );
  }

  /** Refresco silencioso: solo si hay grupo activo; `EstadoSeccion.refrescar()` no hace nada sin una carga previa. */
  private refrescarSecciones(): void {
    if (!this.activo()) return;
    this.ultimoRefrescoMs = Date.now();
    this.seccionTareas.refrescar();
    this.seccionAlertas.refrescar();
    this.seccionHorarios.refrescar();
    this.seccionCitas.refrescar();
    this.seccionPreventivas.refrescar();
  }

  private iniciarRefresco(): void {
    let idIntervalo = this.crearIntervaloDeRefresco();

    // Varios regresos a "visible" en pocos segundos (cambios rápidos de
    // pestaña) no generan una ráfaga de peticiones; solo refresca si pasaron
    // `DEBOUNCE_VISIBILIDAD_MS` o más desde la última carga/refresco, y en
    // ese caso reinicia el intervalo de 2 minutos desde ese momento.
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.ultimoRefrescoMs < DEBOUNCE_VISIBILIDAD_MS) return;
      this.refrescarSecciones();
      clearInterval(idIntervalo);
      idIntervalo = this.crearIntervaloDeRefresco();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    this.destroyRef.onDestroy(() => {
      clearInterval(idIntervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    });
  }

  private crearIntervaloDeRefresco(): ReturnType<typeof setInterval> {
    return setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.refrescarSecciones();
      }
    }, INTERVALO_REFRESCO_MS);
  }
}

/** Antirrebote del refresco al volver a visible: ver `iniciarRefresco`. */
const DEBOUNCE_VISIBILIDAD_MS = 30_000;

function clasificarFallo(error: unknown): Fallo {
  const estado = error instanceof HttpErrorResponse ? error.status : 0;
  if (estado === 0 || estado >= 500) {
    return { tipo: 'reintentable' };
  }
  const detalle = (error as HttpErrorResponse).error?.detail;
  return {
    tipo: 'cuenta',
    mensaje: typeof detalle === 'string' && detalle.trim() ? detalle : MENSAJE_CUENTA_GENERICO,
  };
}
