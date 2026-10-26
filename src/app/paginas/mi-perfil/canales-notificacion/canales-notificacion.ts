import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { mensajeDeCampo, mensajeDeError } from '../../../nucleo/http/mensaje-de-error';
import {
  RespuestaCanales,
  ServicioCanales,
  SolicitudCanal,
} from '../../../nucleo/usuarios/servicio-canales';

/**
 * "Canales de notificación" en Mi perfil (Tarea 12, regla 17 del plan):
 * correo (siempre aparece, con el predeterminado de la cuenta si no hay fila
 * propia) y WhatsApp (solo aparece si tiene fila; aún no envía mensajes —
 * regla 15 — se guarda igual su configuración). `guardar()` reemplaza el
 * conjunto completo con `PUT /api/yo/canales`; si el número de WhatsApp
 * queda vacío, no se envía ese canal.
 */
@Component({
  selector: 'app-canales-notificacion',
  imports: [ReactiveFormsModule],
  templateUrl: './canales-notificacion.html',
  styleUrl: './canales-notificacion.scss',
})
export class CanalesNotificacion implements OnInit {
  private readonly servicioCanales = inject(ServicioCanales);

  protected readonly cargando = signal(true);
  /** `true` cuando la carga inicial falló: oculta el formulario para que un `guardar()` no reemplace (PUT, regla 17) la configuración real con uno vacío (corrección M1). */
  protected readonly cargaFallida = signal(false);
  protected readonly guardando = signal(false);
  protected readonly confirmacion = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly whatsappDisponible = signal(true);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    correoDestino: ['', [Validators.required, Validators.email]],
    correoHabilitado: [true],
    whatsappDestino: [''],
    whatsappHabilitado: [false],
  });

  ngOnInit(): void {
    this.cargar();
  }

  /** Vuelve a pedir la configuración tras una carga fallida (botón "Reintentar", corrección M1). */
  protected reintentar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.cargaFallida.set(false);
    this.errorGeneral.set(null);
    this.servicioCanales.obtener().subscribe({
      next: (respuesta) => this.aplicar(respuesta),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.cargaFallida.set(true);
        this.errorGeneral.set(
          mensajeDeError(error, 'No pudimos cargar tus canales de notificación.'),
        );
      },
    });
  }

  /**
   * Mensaje del correo de notificación: el error local de "requerido" (igual
   * que `integrantes.html`) o, si no, "correo inválido" cuando el formato no
   * calza — el mismo texto que la API devuelve en el 422 (corrección I1).
   */
  protected mensajeCampoCorreo(): string | null {
    const control = this.formulario.controls.correoDestino;
    const mensaje = mensajeDeCampo(control, {}, 'correoDestino', 'Ingresa tu correo de notificación.');
    if (mensaje) return mensaje;
    return control.touched && control.hasError('email')
      ? 'El correo de notificación no es válido.'
      : null;
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.confirmacion.set(false);
    this.errorGeneral.set(null);
    const { correoDestino, correoHabilitado, whatsappDestino, whatsappHabilitado } =
      this.formulario.getRawValue();

    const canales: SolicitudCanal[] = [
      { canal: 'CORREO', destino: correoDestino.trim(), habilitado: correoHabilitado },
    ];
    const destinoWhatsapp = whatsappDestino.trim();
    if (destinoWhatsapp !== '') {
      canales.push({ canal: 'WHATSAPP', destino: destinoWhatsapp, habilitado: whatsappHabilitado });
    }

    this.guardando.set(true);
    this.servicioCanales.actualizar(canales).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        this.confirmacion.set(true);
        this.aplicar(respuesta);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }

  private aplicar(respuesta: RespuestaCanales): void {
    this.cargando.set(false);
    this.whatsappDisponible.set(respuesta.whatsappDisponible);
    const correo = respuesta.canales.find((canal) => canal.canal === 'CORREO');
    const whatsapp = respuesta.canales.find((canal) => canal.canal === 'WHATSAPP');
    this.formulario.patchValue({
      correoDestino: correo?.destino ?? '',
      correoHabilitado: correo?.habilitado ?? true,
      whatsappDestino: whatsapp?.destino ?? '',
      whatsappHabilitado: whatsapp?.habilitado ?? false,
    });
  }
}
