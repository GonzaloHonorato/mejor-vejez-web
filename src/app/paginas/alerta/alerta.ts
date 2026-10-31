import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  ETIQUETA_TIPO_ALERTA,
  MAXIMO_CARACTERES_OBSERVACION,
  observacionValida,
  puedeCerrarAlerta,
} from '../../nucleo/alertas/alertas';
import { RespuestaAlertaDetallada } from '../../nucleo/alertas/modelos-alertas';
import { ServicioAlertas } from '../../nucleo/alertas/servicio-alertas';
import { RespuestaEstadoCatalogo, ServicioCatalogos } from '../../nucleo/catalogos/servicio-catalogos';
import { fechaHoraLegible } from '../../nucleo/fecha-legible';
import { ServicioGrupoActivo } from '../../nucleo/grupos/servicio-grupo-activo';
import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { Icono } from '../../compartido/icono/icono';

/**
 * Página "Detalle de la alerta" (`/alertas/:idAlerta`): datos de la alerta,
 * sus intentos de notificación y, para el coordinador o el administrador
 * mientras está ABIERTA, el formulario de cierre (`puedeCerrarAlerta`).
 *
 * Sigue el mismo patrón de `paginas/tarea`/`paginas/ficha-adulto`: el
 * `idAlerta` viene fijo de la URL (`ActivatedRoute.snapshot`), y un
 * `effect()` con el `idGrupo` del grupo activo en el momento de entrar carga
 * el detalle; si el grupo activo cambia de verdad mientras se está viendo,
 * se vuelve a `/alertas` (nunca se muestran datos del grupo anterior).
 *
 * El enlace del correo manda `?grupo={idGrupo}`: si ese grupo es distinto
 * del activo pero está entre los grupos de la persona, se selecciona antes
 * de cargar. Si no está entre sus
 * grupos, se deja el grupo activo igual: la API responde 404 para un id de
 * alerta de un grupo ajeno, y se muestra el mismo mensaje de "no existe".
 */
@Component({
  selector: 'app-alerta',
  imports: [ReactiveFormsModule, RouterLink, Icono],
  templateUrl: './alerta.html',
  styleUrl: './alerta.scss',
})
export class Alerta implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicioAlertas = inject(ServicioAlertas);
  private readonly servicioCatalogos = inject(ServicioCatalogos);
  private readonly servicioYo = inject(ServicioYo);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grupoActivo = inject(ServicioGrupoActivo);
  protected readonly activo = this.grupoActivo.activo;
  protected readonly etiquetaTipoAlerta = ETIQUETA_TIPO_ALERTA;
  protected readonly maximoCaracteresObservacion = MAXIMO_CARACTERES_OBSERVACION;
  protected readonly fechaHoraLegible = fechaHoraLegible;

  private readonly idAlerta = Number(this.ruta.snapshot.paramMap.get('idAlerta'));

  protected readonly detalle = signal<RespuestaAlertaDetallada | null>(null);
  protected readonly cargando = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadosAlerta = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly estadosTarea = signal<RespuestaEstadoCatalogo[]>([]);
  protected readonly estadosEnvio = signal<RespuestaEstadoCatalogo[]>([]);

  private readonly idEstadoAbierta = computed(
    () => this.estadosAlerta().find((estado) => estado.codigo === 'ABIERTA')?.idEstado ?? null,
  );

  /** idEstado de "FALLIDO" en `INTENTO_NOTIFICACION/ESTADO_ENVIO`; null hasta que llegue el catálogo. */
  private readonly idEstadoEnvioFallido = computed(
    () => this.estadosEnvio().find((estado) => estado.codigo === 'FALLIDO')?.idEstado ?? null,
  );

  protected readonly esAdministrador = signal(false);

  /** `quien` para `puedeCerrarAlerta`: el usuario autenticado y su rol en el grupo activo. */
  private readonly quien = computed(() => ({
    miRol: this.activo()?.miRol ?? null,
    esAdministrador: this.esAdministrador(),
  }));

  /** Sólo el coordinador del grupo o el administrador, y sólo mientras la alerta está ABIERTA. */
  protected readonly puedeCerrar = computed(() => {
    const alerta = this.detalle()?.alerta ?? null;
    const idAbierta = this.idEstadoAbierta();
    if (!alerta || idAbierta === null) return false;
    return puedeCerrarAlerta(alerta, this.quien(), idAbierta);
  });

  protected readonly formularioCierre = this.fb.group({ observacion: [''] });

  private readonly textoObservacion = toSignal(
    this.formularioCierre.controls.observacion.valueChanges,
    { initialValue: '' },
  );
  protected readonly observacionEsValida = computed(() => observacionValida(this.textoObservacion()));

  protected readonly cerrando = signal(false);
  protected readonly errorCierre = signal<string | null>(null);
  protected readonly confirmacionCierre = signal<string | null>(null);

  /** idGrupo con el que ya se cargó (o se intentó cargar) el detalle; ver `FichaAdulto` para el razonamiento completo. */
  private idGrupoCargado: number | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      if (this.idGrupoCargado === null) {
        if (!grupo) {
          // Sigue sin grupo activo (todavía cargando o no hay ninguno): se espera.
          return;
        }
        const idGrupoUrl = this.idGrupoDesdeUrl();
        if (
          idGrupoUrl !== null &&
          idGrupoUrl !== grupo.idGrupo &&
          this.grupoActivo.grupos().some((candidato) => candidato.idGrupo === idGrupoUrl)
        ) {
          // El enlace del correo trae otro grupo de la persona: se
          // selecciona antes de cargar; el efecto se vuelve a correr solo
          // con el `activo()` nuevo.
          this.grupoActivo.seleccionar(idGrupoUrl);
          return;
        }
        this.idGrupoCargado = grupo.idGrupo;
        this.cargar(grupo.idGrupo);
        return;
      }
      if (!grupo || grupo.idGrupo !== this.idGrupoCargado) {
        // El grupo activo cambió de verdad mientras se veía esta alerta:
        // nunca se muestran datos del grupo anterior.
        this.router.navigateByUrl('/alertas');
      }
    });
  }

  ngOnInit(): void {
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.esAdministrador.set(yo.esAdministrador),
      // Defensivo: sin esto no se ofrece el cierre a un administrador sin membresía.
      error: () => undefined,
    });
    this.servicioCatalogos.estados('ALERTA_CUIDADO', 'ESTADO').subscribe({
      next: (estados) => this.estadosAlerta.set(estados),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('TAREA_CUIDADO', 'ESTADO').subscribe({
      next: (estados) => this.estadosTarea.set(estados),
      error: () => undefined,
    });
    this.servicioCatalogos.estados('INTENTO_NOTIFICACION', 'ESTADO_ENVIO').subscribe({
      next: (estados) => this.estadosEnvio.set(estados),
      error: () => undefined,
    });
  }

  protected titulo(): string {
    const tipo = this.detalle()?.alerta.tipoAlerta;
    return tipo ? this.etiquetaTipoAlerta[tipo] : 'Alerta';
  }

  protected descripcionEstadoAlerta(idEstado: number): string {
    return this.estadosAlerta().find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
  }

  protected descripcionEstadoTarea(idEstado: number): string {
    return this.estadosTarea().find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
  }

  protected descripcionEstadoEnvio(idEstado: number): string {
    return this.estadosEnvio().find((estado) => estado.idEstado === idEstado)?.descripcion ?? '';
  }

  /** Una alerta ABIERTA nunca sale en verde: no es un estado resuelto. */
  protected tonoEstadoAlerta(idEstado: number): string {
    if (this.idEstadoAbierta() === null) return '';
    return idEstado === this.idEstadoAbierta() ? 'mv-chip--alerta' : 'mv-chip--exito';
  }

  /** Un intento FALLIDO sale en tono de peligro; los demás, de éxito. */
  protected tonoEstadoEnvio(idEstado: number): string {
    if (this.idEstadoEnvioFallido() === null) return '';
    return idEstado === this.idEstadoEnvioFallido() ? 'mv-chip--peligro' : 'mv-chip--exito';
  }

  protected reintentar(): void {
    const grupo = this.activo();
    if (grupo) this.cargar(grupo.idGrupo);
  }

  protected contadorObservacion(): string {
    return `${this.textoObservacion().length} / ${MAXIMO_CARACTERES_OBSERVACION}`;
  }

  protected cerrar(): void {
    const grupo = this.activo();
    if (!grupo || this.cerrando() || !this.observacionEsValida()) return;

    this.errorCierre.set(null);
    this.confirmacionCierre.set(null);
    this.cerrando.set(true);
    this.servicioAlertas
      .cerrar(grupo.idGrupo, this.idAlerta, this.textoObservacion().trim())
      .subscribe({
        next: () => {
          this.cerrando.set(false);
          this.formularioCierre.reset({ observacion: '' });
          this.confirmacionCierre.set('Alerta cerrada.');
          // Recarga el detalle completo: revisor, fecha y observación de cierre.
          this.cargar(grupo.idGrupo);
        },
        error: (error: unknown) => {
          this.cerrando.set(false);
          this.errorCierre.set(mensajeDeError(error));
        },
      });
  }

  private cargar(idGrupo: number): void {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.error.set(null);
    this.servicioAlertas.obtener(idGrupo, this.idAlerta).subscribe({
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

  private idGrupoDesdeUrl(): number | null {
    const valor = this.ruta.snapshot.queryParamMap.get('grupo');
    if (valor === null) return null;
    const idGrupo = Number(valor);
    return Number.isFinite(idGrupo) ? idGrupo : null;
  }
}
