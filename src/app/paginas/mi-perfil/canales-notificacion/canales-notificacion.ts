import { Component, ElementRef, Injector, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  describirCon,
  mensajeDeCampo,
  mensajeDeError,
} from '../../../nucleo/http/mensaje-de-error';
import {
  AYUDA_TELEFONO,
  formatearControlTelefono,
  formatearTelefono,
  mensajeCampoTelefono,
  mismoTelefono,
  normalizarTelefono,
  validadorTelefonoChilenoSalvo,
} from '../../../nucleo/telefono';
import {
  RespuestaCanales,
  ServicioCanales,
  SolicitudCanal,
} from '../../../nucleo/usuarios/servicio-canales';
import { dentroDe, enfocarPrimerCampoInvalido, mostrarAviso, porId } from '../../../nucleo/foco';

/**
 * "Canales de notificación" en Mi perfil: correo (siempre aparece, con el
 * predeterminado de la cuenta si no hay fila propia) y WhatsApp. Mientras la
 * API diga que WhatsApp no está disponible (`whatsappDisponible: false`, el
 * caso del MVP), sus campos quedan deshabilitados con "Próximamente" y se
 * reenvía tal cual lo que ya estuviera guardado. `guardar()` reemplaza el
 * conjunto completo con `PUT /api/yo/canales`; si el número de WhatsApp
 * queda vacío, no se envía ese canal; si viene, debe ser un teléfono
 * chileno (`nucleo/telefono`) y se envía normalizado.
 */
@Component({
  selector: 'app-canales-notificacion',
  imports: [ReactiveFormsModule],
  templateUrl: './canales-notificacion.html',
  styleUrl: './canales-notificacion.scss',
})
export class CanalesNotificacion implements OnInit {
  private readonly servicioCanales = inject(ServicioCanales);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Número de WhatsApp guardado: si llega sin cambios no se valida (puede ser antiguo). */
  private readonly whatsappGuardado = signal<string | null>(null);

  protected readonly cargando = signal(true);
  /** `true` cuando la carga inicial falló: oculta el formulario para que un `guardar()` no reemplace (PUT) la configuración real con una vacía. */
  protected readonly cargaFallida = signal(false);
  protected readonly guardando = signal(false);
  protected readonly confirmacion = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly whatsappDisponible = signal(true);
  protected readonly ayudaTelefono = AYUDA_TELEFONO;
  protected readonly describirCon = describirCon;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    correoDestino: ['', [Validators.required, Validators.email]],
    correoHabilitado: [true],
    whatsappDestino: ['', validadorTelefonoChilenoSalvo(() => this.whatsappGuardado())],
    whatsappHabilitado: [false],
  });

  ngOnInit(): void {
    this.cargar();
  }

  /** Vuelve a pedir la configuración tras una carga fallida (botón "Reintentar"). */
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
   * calza — el mismo texto que la API devuelve en el 422.
   */
  protected mensajeCampoCorreo(): string | null {
    const control = this.formulario.controls.correoDestino;
    const mensaje = mensajeDeCampo(
      control,
      {},
      'correoDestino',
      'Ingresa tu correo de notificación.',
    );
    if (mensaje) return mensaje;
    return control.touched && control.hasError('email')
      ? 'El correo de notificación no es válido.'
      : null;
  }

  protected mensajeCampoWhatsapp(): string | null {
    return mensajeCampoTelefono(this.formulario.controls.whatsappDestino, {}, 'whatsappDestino');
  }

  protected formatearWhatsapp(): void {
    formatearControlTelefono(this.formulario.controls.whatsappDestino);
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      enfocarPrimerCampoInvalido(dentroDe(this.host, 'form'), this.injector);
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
      canales.push({
        canal: 'WHATSAPP',
        destino: mismoTelefono(destinoWhatsapp, this.whatsappGuardado())
          ? (this.whatsappGuardado() ?? destinoWhatsapp)
          : (normalizarTelefono(destinoWhatsapp) ?? destinoWhatsapp),
        habilitado: whatsappHabilitado,
      });
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
        // El aviso va sobre el formulario; "Guardar" queda abajo.
        mostrarAviso(porId('canales-error-general'), this.injector);
      },
    });
  }

  private aplicar(respuesta: RespuestaCanales): void {
    this.cargando.set(false);
    this.whatsappDisponible.set(respuesta.whatsappDisponible);
    const correo = respuesta.canales.find((canal) => canal.canal === 'CORREO');
    const whatsapp = respuesta.canales.find((canal) => canal.canal === 'WHATSAPP');
    this.whatsappGuardado.set(whatsapp?.destino ?? null);
    this.formulario.patchValue({
      correoDestino: correo?.destino ?? '',
      correoHabilitado: correo?.habilitado ?? true,
      whatsappDestino: formatearTelefono(whatsapp?.destino),
      whatsappHabilitado: whatsapp?.habilitado ?? false,
    });
    // Deshabilitados no se validan, pero getRawValue() los incluye: el PUT
    // conserva la configuración de WhatsApp que ya existía.
    const { whatsappDestino, whatsappHabilitado } = this.formulario.controls;
    for (const control of [whatsappDestino, whatsappHabilitado]) {
      if (respuesta.whatsappDisponible) control.enable();
      else control.disable();
    }
  }
}
