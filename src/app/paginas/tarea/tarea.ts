import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AccionesTarea } from '../tareas/acciones-tarea/acciones-tarea';
import { puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import {
  RespuestaEstadoCatalogo,
  RespuestaOpcionCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { fechaEnSantiago, formatearFecha, formatearHora } from '../../nucleo/fechas';
import { RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { erroresDeCampos, mensajeDeCampo, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { CodigoEstadoTarea, QuienConfirma, TRANSICIONES } from '../../nucleo/tareas/estados-tarea';
import {
  RespuestaHistorialEstado,
  RespuestaTareaDetallada,
  SolicitudAsignarTarea,
} from '../../nucleo/tareas/modelos-tareas';
import { ServicioTareas } from '../../nucleo/tareas/servicio-tareas';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/** Texto recortado, o `null` si queda en blanco (igual que en `NuevaTarea`). */
function textoONulo(valor: string): string | null {
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Página "Detalle de la tarea" (`/tareas/:idTarea`): datos de la tarea,
 * historial de estados, asignaciones, `AccionesTarea` (Tarea 10) y, para el
 * coordinador o el administrador, el formulario "Reasignar" cuando la tarea
 * todavía no es final.
 *
 * Sigue el mismo patrón de `paginas/ficha-adulto`: el `idTarea` viene fijo
 * de la URL (`ActivatedRoute.snapshot`), y un `effect()` con el `idGrupo`
 * del grupo activo en el momento de entrar carga el detalle; si el grupo
 * activo cambia de verdad mientras se está viendo, se vuelve a `/tareas`
 * (nunca se muestran datos del grupo anterior).
 */
@Component({
  selector: 'app-tarea',
  imports: [ReactiveFormsModule, RouterLink, AccionesTarea],
  templateUrl: './tarea.html',
  styleUrl: './tarea.scss',
})
export class Tarea implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioTareas = inject(ServicioTareas);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly formatearFecha = formatearFecha;
  protected readonly formatearHora = formatearHora;

  private readonly idTarea = Number(this.ruta.snapshot.paramMap.get('idTarea'));

  protected readonly detalle = signal<RespuestaTareaDetallada | null>(null);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estados = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly estadosAsignacion = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly unidades = signal<RespuestaOpcionCatalogo[]>([]);

  protected readonly esAdministrador = signal(false);
  private readonly idUsuario = signal<number | null>(null);

  /** Integrantes del grupo tal cual los devuelve la API (todos los estados). */
  private readonly integrantesTodos = signal<RespuestaIntegrante[]>([]);
  /** idEstado de "ACTIVO" para INTEGRANTE_GRUPO; null hasta que llegue el catálogo. */
  private readonly idEstadoActivoIntegrante = signal<number | null>(null);

  /** Sin grupo activo no hay nada que administrar, aunque la persona sea admin. */
  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  /** `quien` para `AccionesTarea`: el usuario autenticado y su rol en el grupo activo. */
  protected readonly quien = computed<QuienConfirma>(() => ({
    idUsuario: this.idUsuario() ?? -1,
    miRol: this.activo()?.miRol ?? null,
    esAdministrador: this.esAdministrador(),
  }));

  /** Código de estado actual de la tarea, resuelto contra el catálogo recibido. */
  protected readonly codigoActual = computed<CodigoEstadoTarea | null>(() => {
    const tarea = this.detalle()?.tarea;
    if (!tarea) return null;
    const estado = this.estados().find((candidato) => candidato.idEstado === tarea.idEstado);
    return (estado?.codigo as CodigoEstadoTarea | undefined) ?? null;
  });

  /** Una tarea es final (`COMPLETADA`/`NO_REALIZADA`/`CANCELADA`) cuando no tiene transiciones (regla 10). */
  protected readonly esFinal = computed(() => {
    const codigo = this.codigoActual();
    return codigo !== null && TRANSICIONES[codigo].length === 0;
  });

  /**
   * "Reasignar" sólo para quien administra el grupo y mientras la tarea no
   * sea final. Exige `codigoActual() !== null` (catálogo de estados ya
   * cargado): sin eso no se puede saber si la tarea es final, y mostrar el
   * formulario para ocultarlo enseguida es un parpadeo (hallazgo T11-1).
   */
  protected readonly puedeReasignar = computed(
    () =>
      this.puedeAdministrar() &&
      this.detalle() !== null &&
      this.codigoActual() !== null &&
      !this.esFinal(),
  );

  /** Integrantes ACTIVOS del grupo, sin el responsable actual (no tiene sentido reasignarle a sí mismo). */
  protected readonly integrantesParaReasignar = computed(() => {
    const idActivo = this.idEstadoActivoIntegrante();
    if (idActivo === null) return [];
    const idResponsableActual = this.detalle()?.tarea.responsable?.idUsuario ?? null;
    return this.integrantesTodos().filter(
      (integrante) =>
        integrante.idEstado === idActivo && integrante.idUsuario !== idResponsableActual,
    );
  });

  protected readonly formularioReasignar = this.fb.group({
    idUsuario: this.fb.control<number | null>(null, Validators.required),
    motivo: ['', Validators.maxLength(500)],
  });

  protected readonly reasignando = signal(false);
  protected readonly errorReasignar = signal<string | null>(null);
  protected readonly erroresReasignar = signal<Record<string, string>>({});
  protected readonly confirmacionReasignar = signal<string | null>(null);

  /** idGrupo con el que ya se cargó (o se intentó cargar) el detalle; ver `FichaAdulto` para el razonamiento completo. */
  private idGrupoCargado: number | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (grupo) {
          this.idGrupoCargado = grupo.idGrupo;
          this.cargar(grupo.idGrupo);
          this.cargarIntegrantes(grupo.idGrupo);
        }
        // Sigue sin grupo activo (todavía cargando o no hay ninguno): se espera.
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        // El grupo activo cambió de verdad mientras se veía este detalle:
        // nunca se muestran datos del grupo anterior.
        this.router.navigateByUrl('/tareas');
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.idUsuario.set(yo.idUsuario);
        this.esAdministrador.set(yo.esAdministrador);
      },
      // Defensivo: sin esto no se muestran acciones de coordinador/admin.
      error: () => undefined,
    });
    this.servicioCatalogos.estados('TAREA_CUIDADO', 'ESTADO').subscribe({
      next: (estados) => this.estados.set(estados),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('ASIGNACION_TAREA', 'ESTADO').subscribe({
      next: (estados) => this.estadosAsignacion.set(estados),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('INTEGRANTE_GRUPO', 'ESTADO').subscribe({
      next: (estados) => {
        const activo = estados.find((estado) => estado.codigo === 'ACTIVO');
        this.idEstadoActivoIntegrante.set(activo?.idEstado ?? null);
      },
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('UNIDAD_DOSIS').subscribe({
      next: (opciones) => this.unidades.set(opciones),
      error: () => undefined,
    });
  }

  protected descripcionEstado(idEstado: number): string {
    return this.estados().find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
  }

  protected descripcionEstadoAsignacion(idEstado: number): string {
    return this.estadosAsignacion().find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
  }

  protected descripcionUnidad(idUnidadCantidad: number): string {
    return this.unidades().find((opcion) => opcion.idOpcion === idUnidadCantidad)?.descripcion ?? '';
  }

  /** "<anterior o Creada> → <nuevo>" de una fila del historial (regla del brief de la Tarea 11). */
  protected etiquetaTransicion(item: RespuestaHistorialEstado): string {
    const anterior =
      item.idEstadoAnterior === null ? 'Creada' : this.descripcionEstado(item.idEstadoAnterior);
    return `${anterior} → ${this.descripcionEstado(item.idEstadoNuevo)}`;
  }

  /**
   * Fecha y hora de Santiago de un instante ISO, listas para mostrar juntas.
   * El día se calcula con `fechaEnSantiago` (nunca con `formatearFecha`
   * directo sobre el ISO, que corta la parte de fecha del texto y puede dar
   * el día del offset en que llegó serializado el instante, no el de Chile;
   * hallazgo I1).
   */
  protected fechaHora(iso: string): string {
    return `${formatearFecha(fechaEnSantiago(iso))} ${formatearHora(iso)}`;
  }

  protected mensajeReasignar(): string | null {
    return mensajeDeCampo(
      this.formularioReasignar.controls.idUsuario,
      this.erroresReasignar(),
      'idUsuario',
      'Elige un integrante',
    );
  }

  /** Se llama cuando `AccionesTarea` emite `actualizada`: recarga el detalle completo (historial y asignaciones incluidos). */
  protected recargar(): void {
    const grupo = this.activo();
    if (!grupo) return;
    this.cargar(grupo.idGrupo);
  }

  protected reasignar(): void {
    const grupo = this.activo();
    if (!grupo || this.reasignando()) return;
    this.formularioReasignar.markAllAsTouched();
    if (this.formularioReasignar.invalid) return;

    const { idUsuario, motivo } = this.formularioReasignar.getRawValue();
    const solicitud: SolicitudAsignarTarea = { idUsuario: idUsuario!, motivo: textoONulo(motivo) };

    this.errorReasignar.set(null);
    this.erroresReasignar.set({});
    this.confirmacionReasignar.set(null);
    this.reasignando.set(true);
    this.servicioTareas.asignar(grupo.idGrupo, this.idTarea, solicitud).subscribe({
      next: () => {
        this.reasignando.set(false);
        this.formularioReasignar.reset({ idUsuario: null, motivo: '' });
        this.confirmacionReasignar.set('Responsable actualizado.');
        // "Al terminar recarga el detalle" (brief): vuelve a pedir el
        // detalle completo, no sólo la tarea que devuelve `asignar()`.
        this.cargar(grupo.idGrupo);
      },
      error: (error: unknown) => {
        this.reasignando.set(false);
        const campos = erroresDeCampos(error);
        this.erroresReasignar.set(campos);
        if (Object.keys(campos).length === 0) {
          this.errorReasignar.set(mensajeDeError(error));
        }
      },
    });
  }

  private cargar(idGrupo: number): void {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.error.set(null);
    this.servicioTareas.obtener(idGrupo, this.idTarea).subscribe({
      next: (detalle) => {
        this.detalle.set(detalle);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.noEncontrado.set(true);
        } else {
          this.error.set(mensajeDeError(error));
        }
      },
    });
  }

  private cargarIntegrantes(idGrupo: number): void {
    this.servicioGrupos.integrantes(idGrupo).subscribe({
      next: (integrantes) => this.integrantesTodos.set(integrantes),
      // Defensivo: sin esto, "Reasignar" simplemente no ofrece opciones.
      error: () => undefined,
    });
  }
}
