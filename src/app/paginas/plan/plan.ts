import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FormularioDetalle } from './formulario-detalle/formulario-detalle';
import { Icono } from '../../compartido/icono/icono';
import { puedeAdministrarGrupo } from '../../nucleo/adultos/permisos-adultos';
import { RespuestaOpcionCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { fechaConAnio } from '../../nucleo/fecha-legible';
import { RespuestaIntegrante } from '../../nucleo/grupos/modelos-grupos';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { ServicioGrupos } from '../../nucleo/grupos/servicio-grupos';
import { erroresDeCampos, mensajeDeCampo, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { reconstruirHorario } from '../../nucleo/planificacion/horario';
import { RespuestaDetallePlan, RespuestaPlan } from '../../nucleo/planificacion/modelos-planificacion';
import { ServicioPlanes } from '../../nucleo/planificacion/servicio-planes';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';

/** Texto exacto de confirmación de "Eliminar" (plan y detalle): solo bajas físicas sin historial. */
const CONFIRMACION_ELIMINAR = 'Solo si fue creado por error. Si tiene historial, desactívalo.';

/** Mensaje local del campo "Cantidad disponible" en línea (sin valor, o negativo). */
const MENSAJE_CANTIDAD_INVALIDA = 'La cantidad debe ser 0 o mayor';

/** Abreviatura de 3 letras por código de `DIA_SEMANA`, para no repetir el nombre completo en la tarjeta. */
const ABREVIATURA_DIA: Record<string, string> = {
  LUNES: 'Lun',
  MARTES: 'Mar',
  MIERCOLES: 'Mié',
  JUEVES: 'Jue',
  VIERNES: 'Vie',
  SABADO: 'Sáb',
  DOMINGO: 'Dom',
};

/**
 * Texto de lectura del horario guardado (`horas` expandidas): reconstruye
 * el contrato con `reconstruirHorario` (igual que `FormularioDetalle` al
 * editar) y lo describe en español.
 */
function textoHorario(horas: string[]): string {
  const horario = reconstruirHorario(horas);
  if (horario.tipo === 'INTERVALO') {
    return `Cada ${horario.frecuencia_horas} h de ${horario.hora_inicio} a ${horario.hora_fin}`;
  }
  return horario.horas.join(' · ');
}

/**
 * Página "Plan de medicamentos" (`/planes/:idPlan`): datos del plan
 * (administración en el lugar, desactivar/reactivar, eliminar), la lista de
 * medicamentos (detalles) con sus acciones, y el formulario de alta/edición
 * (`FormularioDetalle`) montado bajo demanda.
 *
 * Sigue el mismo patrón de `FichaAdulto`: trabaja sobre el `idGrupo` del
 * grupo activo al entrar al plan; si ese grupo cambia de verdad mientras se
 * está viendo, vuelve a `/planes` sin mostrar datos del grupo anterior.
 */
@Component({
  selector: 'app-plan',
  imports: [ReactiveFormsModule, RouterLink, FormularioDetalle, Icono],
  templateUrl: './plan.html',
  styleUrl: './plan.scss',
})
export class Plan implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioPlanes = inject(ServicioPlanes);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioGrupos = inject(ServicioGrupos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly fechaConAnio = fechaConAnio;
  protected readonly textoHorario = textoHorario;

  private readonly idPlan = Number(this.ruta.snapshot.paramMap.get('idPlan'));

  protected readonly plan = signal<RespuestaPlan | null>(null);
  protected readonly detalles = signal<RespuestaDetallePlan[]>([]);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly esAdministrador = signal(false);

  protected readonly presentaciones = signal<RespuestaOpcionCatalogo[]>([]);
  protected readonly unidades = signal<RespuestaOpcionCatalogo[]>([]);
  protected readonly dias = signal<RespuestaOpcionCatalogo[]>([]);

  /** Integrantes del grupo tal cual los devuelve la API (todos los estados). */
  private readonly integrantesTodos = signal<RespuestaIntegrante[]>([]);
  /** idEstado de "ACTIVO" para INTEGRANTE_GRUPO; null hasta que llegue el catálogo. */
  private readonly idEstadoActivoIntegrante = signal<number | null>(null);
  /**
   * Integrantes ACTIVOS del grupo, los únicos que puede ofrecer el
   * formulario de detalle como responsable. Lado seguro: sin el catálogo
   * de estados (null) no se ofrece ningún responsable, en vez de arriesgar
   * uno inactivo.
   */
  protected readonly integrantesActivos = computed(() => {
    const idActivo = this.idEstadoActivoIntegrante();
    if (idActivo === null) return [];
    return this.integrantesTodos().filter((integrante) => integrante.idEstado === idActivo);
  });

  /** idEstado de "INACTIVO" para PLAN_MEDICAMENTOS; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivoPlan = signal<number | null>(null);
  /** true si falló el catálogo de estados del plan: lado seguro, se trata como inactivo (sin acciones de edición). */
  private readonly catalogoEstadoPlanFallo = signal(false);
  /** idEstado de "INACTIVO" para DETALLE_PLAN; null hasta que llegue el catálogo. */
  private readonly idEstadoInactivoDetalle = signal<number | null>(null);
  /** true si falló el catálogo de estados del detalle: lado seguro, se trata como inactivo. */
  private readonly catalogoEstadoDetalleFallo = signal(false);

  protected readonly puedeAdministrar = computed(() =>
    puedeAdministrarGrupo(this.activo()?.miRol, this.esAdministrador()),
  );

  protected readonly planInactivo = computed(() => {
    const plan = this.plan();
    if (!plan) return false;
    if (this.catalogoEstadoPlanFallo()) return true;
    const idInactivo = this.idEstadoInactivoPlan();
    return idInactivo !== null && plan.idEstado === idInactivo;
  });

  /** Coordinador (o admin) Y plan activo: sin esto no hay ninguna acción de edición sobre los medicamentos. */
  protected readonly puedeEditarMedicamentos = computed(
    () => this.puedeAdministrar() && !this.planInactivo(),
  );

  // --- Edición del plan en el lugar ---
  protected readonly editandoPlan = signal(false);
  protected readonly guardandoPlan = signal(false);
  protected readonly confirmacionEdicionPlan = signal(false);
  protected readonly erroresCamposPlan = signal<Record<string, string>>({});
  /** En vuelo "Desactivar plan"/"Reactivar plan": evita el doble tap mientras la API responde. */
  protected readonly cambiandoEstadoPlan = signal(false);
  protected readonly confirmacionEstadoPlan = signal<string | null>(null);
  protected readonly errorAccionPlan = signal<string | null>(null);

  protected readonly formularioPlan = this.fb.group({
    nombrePlan: ['', Validators.required],
    vigenteDesde: ['', Validators.required],
    vigenteHasta: [''],
  });

  // --- Formulario de detalle, montado bajo demanda ---
  protected readonly agregandoDetalle = signal(false);
  protected readonly detalleEnEdicion = signal<RespuestaDetallePlan | null>(null);
  protected readonly editando = computed(
    () => this.agregandoDetalle() || this.detalleEnEdicion() !== null,
  );

  // --- Acciones por detalle ---
  protected readonly errorAccionDetalle = signal<string | null>(null);
  /** idDetallePlan en vuelo (desactivar/reactivar/cantidad): evita el doble tap de ESA fila. */
  private readonly idsEnAccion = signal<ReadonlySet<number>>(new Set());
  private readonly controlesCantidad = new Map<number, FormControl<number | null>>();

  /** idGrupo con el que ya se cargó (o se intentó cargar) el plan; ver `FichaAdulto` para la explicación completa del patrón. */
  private idGrupoCargado: number | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (grupo) {
          this.idGrupoCargado = grupo.idGrupo;
          this.cargarPlan(grupo.idGrupo);
          this.cargarIntegrantes(grupo.idGrupo);
        }
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        this.router.navigateByUrl('/planes');
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('PLAN_MEDICAMENTOS', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivoPlan.set(inactivo?.idEstado ?? null);
      },
      error: () => this.catalogoEstadoPlanFallo.set(true),
    });
    this.servicioCatalogos.estados('DETALLE_PLAN', 'ESTADO').subscribe({
      next: (estados) => {
        const inactivo = estados.find((estado) => estado.codigo === 'INACTIVO');
        this.idEstadoInactivoDetalle.set(inactivo?.idEstado ?? null);
      },
      error: () => this.catalogoEstadoDetalleFallo.set(true),
    });
    this.servicioCatalogos.estados('INTEGRANTE_GRUPO', 'ESTADO').subscribe({
      next: (estados) => {
        const activo = estados.find((estado) => estado.codigo === 'ACTIVO');
        this.idEstadoActivoIntegrante.set(activo?.idEstado ?? null);
      },
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('PRESENTACION_MEDICAMENTO').subscribe({
      next: (opciones) => this.presentaciones.set(opciones),
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('UNIDAD_DOSIS').subscribe({
      next: (opciones) => this.unidades.set(opciones),
      error: () => undefined,
    });
    this.servicioCatalogos.opciones('DIA_SEMANA').subscribe({
      next: (opciones) => this.dias.set(opciones),
      error: () => undefined,
    });
  }

  protected detalleInactivo(detalle: RespuestaDetallePlan): boolean {
    if (this.catalogoEstadoDetalleFallo()) return true;
    const idInactivo = this.idEstadoInactivoDetalle();
    return idInactivo !== null && detalle.idEstado === idInactivo;
  }

  protected estaEnAccion(idDetalle: number): boolean {
    return this.idsEnAccion().has(idDetalle);
  }

  protected presentacionDescripcion(idPresentacion: number): string {
    return this.presentaciones().find((opcion) => opcion.idOpcion === idPresentacion)?.descripcion ?? '';
  }

  protected unidadDescripcion(idUnidadDosis: number): string {
    return this.unidades().find((opcion) => opcion.idOpcion === idUnidadDosis)?.descripcion ?? '';
  }

  protected dosisTexto(detalle: RespuestaDetallePlan): string {
    return `${detalle.dosisCantidad} ${this.unidadDescripcion(detalle.idUnidadDosis)}`;
  }

  protected textoDias(detalle: RespuestaDetallePlan): string {
    if (detalle.diasSemana.length === 7) return 'Todos los días';
    return detalle.diasSemana
      .map((idDia) => this.dias().find((opcion) => opcion.idOpcion === idDia))
      .filter((opcion): opcion is RespuestaOpcionCatalogo => opcion !== undefined)
      .map((opcion) => ABREVIATURA_DIA[opcion.codigo] ?? opcion.descripcion.slice(0, 3))
      .join(', ');
  }

  protected textoTermino(detalle: RespuestaDetallePlan): string {
    if (!detalle.fechaEstimadaTermino) return 'Sin estimación';
    const modo = detalle.modoCalculoTermino === 'AUTOMATICO' ? 'automático' : 'manual';
    return `Término estimado: ${fechaConAnio(detalle.fechaEstimadaTermino)} (${modo})`;
  }

  protected controlCantidad(detalle: RespuestaDetallePlan): FormControl<number | null> {
    let control = this.controlesCantidad.get(detalle.idDetallePlan);
    if (!control) {
      control = this.fb.control<number | null>(detalle.cantidadDisponible, [
        Validators.required,
        Validators.min(0),
      ]);
      this.controlesCantidad.set(detalle.idDetallePlan, control);
    }
    return control;
  }

  /** Mensaje local del campo "Cantidad disponible" en línea, solo si ya se tocó e inválido (sin valor o negativo). */
  protected mensajeCantidad(detalle: RespuestaDetallePlan): string | null {
    const control = this.controlCantidad(detalle);
    return control.touched && control.invalid ? MENSAJE_CANTIDAD_INVALIDA : null;
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin completar el nombre del plan. */
  protected mensajeCampoNombrePlan(): string | null {
    return mensajeDeCampo(
      this.formularioPlan.controls.nombrePlan,
      this.erroresCamposPlan(),
      'nombrePlan',
      'Ingresa el nombre del plan',
    );
  }

  /** Error de la API, o si no un mensaje local cuando se tocó el campo sin la vigencia desde. */
  protected mensajeCampoVigenteDesdePlan(): string | null {
    return mensajeDeCampo(
      this.formularioPlan.controls.vigenteDesde,
      this.erroresCamposPlan(),
      'vigenteDesde',
      'Indica desde cuándo rige el plan',
    );
  }

  protected editarPlan(): void {
    const plan = this.plan();
    if (!plan) return;
    this.confirmacionEdicionPlan.set(false);
    this.confirmacionEstadoPlan.set(null);
    this.errorGeneral.set(null);
    this.erroresCamposPlan.set({});
    this.formularioPlan.patchValue({
      nombrePlan: plan.nombrePlan,
      vigenteDesde: plan.vigenteDesde,
      vigenteHasta: plan.vigenteHasta ?? '',
    });
    this.editandoPlan.set(true);
  }

  protected cancelarEdicionPlan(): void {
    this.editandoPlan.set(false);
    this.erroresCamposPlan.set({});
  }

  protected guardarPlan(): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.guardandoPlan()) return;
    if (this.formularioPlan.invalid) {
      this.formularioPlan.markAllAsTouched();
      return;
    }

    this.erroresCamposPlan.set({});
    const { nombrePlan, vigenteDesde, vigenteHasta } = this.formularioPlan.getRawValue();
    this.guardandoPlan.set(true);
    this.servicioPlanes
      .actualizar(grupo.idGrupo, plan.idPlan, {
        nombrePlan: nombrePlan.trim(),
        vigenteDesde,
        vigenteHasta: vigenteHasta.trim() === '' ? null : vigenteHasta,
      })
      .subscribe({
        next: (actualizado) => {
          this.plan.set(actualizado);
          this.guardandoPlan.set(false);
          this.editandoPlan.set(false);
          this.confirmacionEdicionPlan.set(true);
        },
        error: (error: unknown) => {
          this.guardandoPlan.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCamposPlan.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorGeneral.set(mensajeDeError(error));
          }
        },
      });
  }

  protected desactivarPlan(): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.cambiandoEstadoPlan()) return;
    this.errorAccionPlan.set(null);
    this.confirmacionEstadoPlan.set(null);
    this.cambiandoEstadoPlan.set(true);
    this.servicioPlanes.desactivar(grupo.idGrupo, plan.idPlan).subscribe({
      next: (actualizado) => {
        this.plan.set(actualizado);
        this.cambiandoEstadoPlan.set(false);
        this.confirmacionEstadoPlan.set('Plan desactivado.');
      },
      error: (error: unknown) => {
        this.cambiandoEstadoPlan.set(false);
        this.errorAccionPlan.set(mensajeDeError(error));
      },
    });
  }

  protected reactivarPlan(): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.cambiandoEstadoPlan()) return;
    this.errorAccionPlan.set(null);
    this.confirmacionEstadoPlan.set(null);
    this.cambiandoEstadoPlan.set(true);
    this.servicioPlanes.reactivar(grupo.idGrupo, plan.idPlan).subscribe({
      next: (actualizado) => {
        this.plan.set(actualizado);
        this.cambiandoEstadoPlan.set(false);
        this.confirmacionEstadoPlan.set('Plan reactivado.');
      },
      error: (error: unknown) => {
        this.cambiandoEstadoPlan.set(false);
        this.errorAccionPlan.set(mensajeDeError(error));
      },
    });
  }

  protected eliminarPlan(): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan) return;
    if (!window.confirm(CONFIRMACION_ELIMINAR)) return;

    this.errorAccionPlan.set(null);
    this.servicioPlanes.eliminar(grupo.idGrupo, plan.idPlan).subscribe({
      next: () => this.router.navigateByUrl('/planes'),
      error: (error: unknown) => this.errorAccionPlan.set(mensajeDeError(error)),
    });
  }

  /** Vuelve a pedir el plan tras un error de carga. */
  protected reintentar(): void {
    if (this.idGrupoCargado === null) return;
    this.cargarPlan(this.idGrupoCargado);
  }

  protected agregarMedicamento(): void {
    this.detalleEnEdicion.set(null);
    this.agregandoDetalle.set(true);
  }

  protected editarDetalle(detalle: RespuestaDetallePlan): void {
    this.agregandoDetalle.set(false);
    this.detalleEnEdicion.set(detalle);
  }

  protected cerrarFormulario(): void {
    this.agregandoDetalle.set(false);
    this.detalleEnEdicion.set(null);
  }

  protected alGuardarDetalle(): void {
    this.cerrarFormulario();
    this.recargarPlan();
  }

  protected desactivarDetalle(detalle: RespuestaDetallePlan): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.estaEnAccion(detalle.idDetallePlan)) return;
    this.errorAccionDetalle.set(null);
    this.marcarEnAccion(detalle.idDetallePlan, true);
    this.servicioPlanes.desactivarDetalle(grupo.idGrupo, plan.idPlan, detalle.idDetallePlan).subscribe({
      next: () => {
        this.marcarEnAccion(detalle.idDetallePlan, false);
        this.recargarPlan();
      },
      error: (error: unknown) => {
        this.marcarEnAccion(detalle.idDetallePlan, false);
        this.errorAccionDetalle.set(mensajeDeError(error));
      },
    });
  }

  protected reactivarDetalle(detalle: RespuestaDetallePlan): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.estaEnAccion(detalle.idDetallePlan)) return;
    this.errorAccionDetalle.set(null);
    this.marcarEnAccion(detalle.idDetallePlan, true);
    this.servicioPlanes.reactivarDetalle(grupo.idGrupo, plan.idPlan, detalle.idDetallePlan).subscribe({
      next: () => {
        this.marcarEnAccion(detalle.idDetallePlan, false);
        this.recargarPlan();
      },
      error: (error: unknown) => {
        this.marcarEnAccion(detalle.idDetallePlan, false);
        this.errorAccionDetalle.set(mensajeDeError(error));
      },
    });
  }

  protected eliminarDetalle(detalle: RespuestaDetallePlan): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan) return;
    if (!window.confirm(CONFIRMACION_ELIMINAR)) return;

    this.errorAccionDetalle.set(null);
    this.servicioPlanes.eliminarDetalle(grupo.idGrupo, plan.idPlan, detalle.idDetallePlan).subscribe({
      next: () => this.recargarPlan(),
      error: (error: unknown) => this.errorAccionDetalle.set(mensajeDeError(error)),
    });
  }

  protected guardarCantidad(detalle: RespuestaDetallePlan): void {
    const grupo = this.activo();
    const plan = this.plan();
    if (!grupo || !plan || this.estaEnAccion(detalle.idDetallePlan)) return;

    const control = this.controlCantidad(detalle);
    if (control.invalid) {
      control.markAsTouched();
      return;
    }
    const valor = control.value;
    if (valor === null) return;

    this.errorAccionDetalle.set(null);
    this.marcarEnAccion(detalle.idDetallePlan, true);
    this.servicioPlanes
      .actualizarCantidad(grupo.idGrupo, plan.idPlan, detalle.idDetallePlan, valor)
      .subscribe({
        next: () => {
          this.marcarEnAccion(detalle.idDetallePlan, false);
          this.recargarPlan();
        },
        error: (error: unknown) => {
          this.marcarEnAccion(detalle.idDetallePlan, false);
          this.errorAccionDetalle.set(mensajeDeError(error));
        },
      });
  }

  private marcarEnAccion(idDetalle: number, enAccion: boolean): void {
    const actuales = new Set(this.idsEnAccion());
    if (enAccion) {
      actuales.add(idDetalle);
    } else {
      actuales.delete(idDetalle);
    }
    this.idsEnAccion.set(actuales);
  }

  private cargarPlan(idGrupo: number): void {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.errorGeneral.set(null);
    this.servicioPlanes.obtener(idGrupo, this.idPlan).subscribe({
      next: (respuesta) => {
        this.plan.set(respuesta.plan);
        this.detalles.set(respuesta.detalles);
        this.resincronizarControlesCantidad(respuesta.detalles);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.noEncontrado.set(true);
        } else {
          this.errorGeneral.set(mensajeDeError(error));
        }
      },
    });
  }

  /** Recarga el plan y sus detalles tras una acción exitosa (alta, edición, cambio de estado, cantidad, eliminación). */
  private recargarPlan(): void {
    const grupo = this.activo();
    if (!grupo) return;
    this.servicioPlanes.obtener(grupo.idGrupo, this.idPlan).subscribe({
      next: (respuesta) => {
        this.plan.set(respuesta.plan);
        this.detalles.set(respuesta.detalles);
        this.resincronizarControlesCantidad(respuesta.detalles);
      },
      error: (error: unknown) => this.errorGeneral.set(mensajeDeError(error)),
    });
  }

  /**
   * Tras cada recarga, los controles de "Cantidad disponible" en línea ya
   * creados (`controlesCantidad`) deben reflejar el valor recién llegado de
   * la API: si no se resincronizan, un detalle que cambió por otra acción
   * (u otra persona) deja el campo mostrando un valor viejo. Se descartan
   * también los controles de detalles que ya no están en la respuesta.
   */
  private resincronizarControlesCantidad(detalles: RespuestaDetallePlan[]): void {
    const idsActuales = new Set(detalles.map((detalle) => detalle.idDetallePlan));
    for (const id of [...this.controlesCantidad.keys()]) {
      if (!idsActuales.has(id)) {
        this.controlesCantidad.delete(id);
      }
    }
    for (const detalle of detalles) {
      this.controlesCantidad.get(detalle.idDetallePlan)?.setValue(detalle.cantidadDisponible);
    }
  }

  private cargarIntegrantes(idGrupo: number): void {
    this.servicioGrupos.integrantes(idGrupo).subscribe({
      next: (integrantes) => this.integrantesTodos.set(integrantes),
      error: () => undefined,
    });
  }
}
