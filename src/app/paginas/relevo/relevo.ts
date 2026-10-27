import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { descripcionEstado } from '../../nucleo/catalogos/descripcion-estado';
import {
  RespuestaEstadoCatalogo,
  ServicioCatalogos,
} from '../../nucleo/catalogos/servicio-catalogos';
import { fechaEnSantiago, formatearFecha, formatearHora } from '../../nucleo/fechas';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { RespuestaDetalleRelevo, RespuestaRelevo } from '../../nucleo/relevos/modelos-relevos';
import { ServicioRelevos } from '../../nucleo/relevos/servicio-relevos';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { ReasignarTareas } from './reasignar-tareas/reasignar-tareas';

/** Aviso exacto de la regla 29 del plan: la foto no se vuelve a calcular. */
export const AVISO_FOTO_RELEVO =
  'Este resumen es una foto del momento del relevo; los estados actuales pueden haber cambiado.';

/**
 * Página "Detalle del relevo" (`/relevos/:idRelevo`): datos del relevo y su
 * foto de tareas pendientes/alertas abiertas al momento de registrarlo
 * (regla 29 del plan). "Cancelar relevo" para el creador, el coordinador
 * del grupo o un administrador, y sólo mientras el relevo sigue
 * COMPLETADA.
 *
 * Sigue el mismo patrón de `paginas/alerta`/`paginas/tarea`: el `idRelevo`
 * viene fijo de la URL (`ActivatedRoute.snapshot`), y un `effect()` con el
 * `idGrupo` del grupo activo en el momento de entrar carga el detalle; si el
 * grupo activo cambia de verdad mientras se está viendo, se vuelve a
 * `/relevos` (nunca se muestran datos del grupo anterior).
 */
@Component({
  selector: 'app-relevo',
  imports: [RouterLink, ReasignarTareas],
  templateUrl: './relevo.html',
  styleUrl: './relevo.scss',
})
export class Relevo implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioRelevos = inject(ServicioRelevos);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioYo = inject(ServicioYo);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly formatearFecha = formatearFecha;
  protected readonly formatearHora = formatearHora;
  protected readonly avisoFoto = AVISO_FOTO_RELEVO;

  private readonly idRelevo = Number(this.ruta.snapshot.paramMap.get('idRelevo'));

  protected readonly detalle = signal<RespuestaRelevo | null>(null);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadosRelevo = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly idUsuario = signal<number | null>(null);
  protected readonly esAdministrador = signal(false);

  protected readonly tareasPendientes = computed<RespuestaDetalleRelevo[]>(
    () => this.detalle()?.detalles.filter((item) => item.tipoElemento === 'TAREA') ?? [],
  );
  protected readonly alertasAbiertas = computed<RespuestaDetalleRelevo[]>(
    () => this.detalle()?.detalles.filter((item) => item.tipoElemento === 'ALERTA') ?? [],
  );
  /** Sólo tiene sentido con el relevo ya cargado: en error o cargando, `detalle()` sigue en `null` (regla de `Alerta`). */
  protected readonly sinElementos = computed(() => (this.detalle()?.detalles.length ?? 0) === 0);

  /** Código de estado actual del relevo, resuelto contra el catálogo recibido (igual que `Tarea.codigoActual`). */
  private readonly codigoActual = computed(() => {
    const relevo = this.detalle();
    if (!relevo) return null;
    return (
      this.estadosRelevo().find((estado) => estado.idEstado === relevo.idEstado)?.codigo ?? null
    );
  });

  /**
   * El creador, el coordinador del grupo o un administrador, y sólo
   * mientras el relevo está COMPLETADA (regla 29 del plan + regla 7 de la
   * API, que también deja cancelar a un administrador sin membresía;
   * corrección ronda 1 del controlador).
   */
  protected readonly puedeCancelar = computed(() => {
    const relevo = this.detalle();
    if (!relevo || this.codigoActual() !== 'COMPLETADA') return false;
    const miId = this.idUsuario();
    const esCreador = miId !== null && miId === relevo.creador.idUsuario;
    const esCoordinador = this.activo()?.miRol === 'COORDINADOR';
    return esCreador || esCoordinador || this.esAdministrador();
  });

  /**
   * Reasignar tareas pendientes a quien recibe (HU-11 → HU-06, decisión de
   * Gonzalo 2026-10-27): solo coordinador del grupo o administrador (el rol
   * se resuelve igual que en `puedeCancelar`, pero sin el creador: HU-06 no
   * deja reasignar a un colaborador), con el relevo COMPLETADA y con tareas
   * en el resumen. La API vuelve a validar todo (403/422).
   */
  protected readonly puedeReasignar = computed(() => {
    if (!this.detalle() || this.codigoActual() !== 'COMPLETADA') return false;
    if (this.tareasPendientes().length === 0) return false;
    return this.activo()?.miRol === 'COORDINADOR' || this.esAdministrador();
  });

  protected readonly cancelando = signal(false);
  protected readonly errorCancelar = signal<string | null>(null);

  /** idGrupo con el que ya se cargó (o se intentó cargar) el detalle; ver `Alerta` para el razonamiento completo. */
  private idGrupoCargado: number | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (!grupo) {
          // Sigue sin grupo activo (todavía cargando o no hay ninguno): se espera.
          return;
        }
        this.idGrupoCargado = grupo.idGrupo;
        this.cargar(grupo.idGrupo);
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        // El grupo activo cambió de verdad mientras se veía este relevo:
        // nunca se muestran datos del grupo anterior.
        this.router.navigateByUrl('/relevos');
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.idUsuario.set(yo.idUsuario);
        this.esAdministrador.set(yo.esAdministrador);
      },
      // Defensivo: sin esto no se ofrece "Cancelar relevo" a su creador/administrador.
      error: () => undefined,
    });
    this.servicioCatalogos.estados('TRASPASO_FAMILIAR', 'ESTADO').subscribe({
      next: (estados) => this.estadosRelevo.set(estados),
      error: () => undefined,
    });
  }

  protected descripcionEstadoRelevo(idEstado: number): string {
    return descripcionEstado(this.estadosRelevo(), idEstado);
  }

  /** Fecha y hora de Santiago de un instante ISO, listas para mostrar juntas (ver `Tarea.fechaHora`). */
  protected fechaHora(iso: string): string {
    return `${formatearFecha(fechaEnSantiago(iso))} ${formatearHora(iso)}`;
  }

  protected cancelar(): void {
    const grupo = this.activo();
    if (!grupo || this.cancelando()) return;

    this.errorCancelar.set(null);
    this.cancelando.set(true);
    this.servicioRelevos.cancelar(grupo.idGrupo, this.idRelevo).subscribe({
      next: () => {
        this.cancelando.set(false);
        // Recarga el detalle completo: el estado ya pasó a CANCELADA.
        this.cargar(grupo.idGrupo);
      },
      error: (error: unknown) => {
        this.cancelando.set(false);
        this.errorCancelar.set(mensajeDeError(error));
      },
    });
  }

  private cargar(idGrupo: number): void {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.error.set(null);
    this.servicioRelevos.obtener(idGrupo, this.idRelevo).subscribe({
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
}
