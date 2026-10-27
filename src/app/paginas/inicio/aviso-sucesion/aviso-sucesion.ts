import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { ServicioGrupoActivo } from '../../../nucleo/grupos/servicio-grupo-activo';
import { mensajeDeError } from '../../../nucleo/http/mensaje-de-error';
import { RespuestaPropuesta } from '../../../nucleo/sucesion/modelos-sucesion';
import { ServicioSucesion } from '../../../nucleo/sucesion/servicio-sucesion';
import { ServicioYo } from '../../../nucleo/usuarios/servicio-yo';

/**
 * Aviso de sucesión en Inicio (regla 25 del plan, HU-13): solo se muestra
 * si la persona es el candidato de una propuesta PENDIENTE del grupo
 * activo, con Aceptar y Rechazar. Al responder, los botones se ocultan (la
 * propuesta deja de estar PENDIENTE) y se deja una confirmación en
 * `role="status"` en su lugar (M-8 de la revisión: sin ella, la persona no
 * sabe si se guardó); el resto del flujo vive en la sección de sucesión de
 * Integrantes.
 *
 * Es autónomo a propósito: `Inicio` solo coloca la etiqueta, sin lógica de
 * sucesión. Un `effect()` sobre el grupo activo pide `GET .../sucesion/activa`
 * con su propio contador de generación (y cancela la petición anterior), así
 * que una respuesta tardía de un grupo ya reemplazado nunca se muestra; lo
 * mismo vale para la respuesta de Aceptar/Rechazar.
 */
@Component({
  selector: 'app-aviso-sucesion',
  imports: [RouterLink],
  templateUrl: './aviso-sucesion.html',
  styleUrl: './aviso-sucesion.scss',
})
export class AvisoSucesion {
  private readonly servicioSucesion = inject(ServicioSucesion);
  private readonly servicioYo = inject(ServicioYo);

  protected readonly activo = inject(ServicioGrupoActivo).activo;

  private readonly propuesta = signal<RespuestaPropuesta | null>(null);
  private readonly idUsuario = signal<number | null>(null);
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Confirmación tras Aceptar/Rechazar (M-8); se limpia en cada `cargar()` (grupo nuevo). */
  protected readonly confirmacion = signal<string | null>(null);

  /** La propuesta a mostrar: PENDIENTE y con la persona como candidato. */
  protected readonly visible = computed(() => {
    const propuesta = this.propuesta();
    const idUsuario = this.idUsuario();
    if (!propuesta || idUsuario === null) return null;
    return propuesta.codigoEstado === 'PENDIENTE' && propuesta.candidato.idUsuario === idUsuario
      ? propuesta
      : null;
  });

  private generacion = 0;
  private suscripcion: Subscription | null = null;

  constructor() {
    effect(() => {
      const grupo = this.activo();
      untracked(() => this.cargar(grupo?.idGrupo ?? null));
    });
    this.servicioYo.obtener().subscribe({
      next: (yo) => this.idUsuario.set(yo.idUsuario),
      // Sin el usuario no se puede saber si es el candidato: el aviso no se muestra.
      error: () => undefined,
    });
    inject(DestroyRef).onDestroy(() => this.suscripcion?.unsubscribe());
  }

  protected aceptar(propuesta: RespuestaPropuesta): void {
    this.responder(
      this.servicioSucesion.aceptar(propuesta.idGrupo, propuesta.idPropuesta),
      `Aceptaste la propuesta. La transferencia se completará cuando ${propuesta.saliente.nombre} la confirme.`,
    );
  }

  protected rechazar(propuesta: RespuestaPropuesta): void {
    this.responder(
      this.servicioSucesion.rechazar(propuesta.idGrupo, propuesta.idPropuesta),
      'Rechazaste la propuesta.',
    );
  }

  private responder(accion: Observable<RespuestaPropuesta>, mensajeConfirmacion: string): void {
    if (this.procesando()) return;
    const generacion = this.generacion;
    this.error.set(null);
    this.procesando.set(true);
    this.suscripcion?.unsubscribe();
    this.suscripcion = accion.subscribe({
      next: (respuesta) => {
        if (generacion !== this.generacion) return;
        this.procesando.set(false);
        // Ya no está PENDIENTE: `visible()` pasa a null; la confirmación ocupa su lugar.
        this.propuesta.set(respuesta);
        this.confirmacion.set(mensajeConfirmacion);
      },
      error: (error: unknown) => {
        if (generacion !== this.generacion) return;
        this.procesando.set(false);
        this.error.set(mensajeDeError(error));
      },
    });
  }

  private cargar(idGrupo: number | null): void {
    const generacion = ++this.generacion;
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.propuesta.set(null);
    this.error.set(null);
    this.procesando.set(false);
    this.confirmacion.set(null);
    if (idGrupo === null) return;
    this.suscripcion = this.servicioSucesion.activa(idGrupo).subscribe({
      next: (propuesta) => {
        if (generacion !== this.generacion) return;
        this.propuesta.set(propuesta);
      },
      // Silencioso: el aviso es secundario en Inicio; el flujo completo está en Integrantes.
      error: () => undefined,
    });
  }
}
