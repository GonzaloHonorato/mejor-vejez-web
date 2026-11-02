import { Component, ElementRef, Injector, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { inicialesDe } from '../../compartido/marco-app/identidad-usuario';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { describirCon, erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import {
  AYUDA_TELEFONO,
  formatearControlTelefono,
  formatearTelefono,
  mensajeCampoTelefono,
  normalizarTelefono,
  validadorTelefonoChilenoSalvo,
} from '../../nucleo/telefono';
import { dentroDe, enfocarPrimerCampoInvalido } from '../../nucleo/foco';
import { RespuestaYo, ServicioYo } from '../../nucleo/usuarios/servicio-yo';
import { CanalesNotificacion } from './canales-notificacion/canales-notificacion';

const MENSAJES_ERROR_CLAVE_ACTUAL: Record<string, string> = {
  'auth/wrong-password': 'La contraseña actual no es correcta.',
  'auth/invalid-credential': 'La contraseña actual no es correcta.',
};
const MENSAJES_ERROR_CLAVE_NUEVA: Record<string, string> = {
  'auth/weak-password': 'La nueva contraseña debe tener al menos 8 caracteres.',
};
const MENSAJE_ERROR_CLAVE_GENERICO = 'No pudimos cambiar tu contraseña. Intenta de nuevo.';

/**
 * Página "Mi perfil": correo de solo lectura, nombre y teléfono editables
 * (teléfono chileno opcional, con la regla de `nucleo/telefono`), canales
 * de notificación y cambio de contraseña.
 */
@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, CanalesNotificacion],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
})
export class MiPerfil implements OnInit {
  private readonly servicioYo = inject(ServicioYo);
  protected readonly auth = inject(ServicioAutenticacion);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly iniciales = inicialesDe;
  protected readonly ayudaTelefono = AYUDA_TELEFONO;
  protected readonly describirCon = describirCon;
  protected readonly yo = signal<RespuestaYo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly confirmacion = signal(false);
  /** Falló la carga del perfil (`GET /api/yo`); se ofrece reintentar. */
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    telefono: ['', validadorTelefonoChilenoSalvo(() => this.yo()?.telefono)],
  });

  protected readonly cambiandoClave = signal(false);
  protected readonly confirmacionClave = signal(false);
  protected readonly errorClave = signal<string | null>(null);

  protected readonly formularioClave = inject(NonNullableFormBuilder).group({
    actual: ['', Validators.required],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmacion: ['', Validators.required],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.errorCarga.set(null);
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.yo.set(yo);
        this.formulario.patchValue({ nombre: yo.nombre, telefono: formatearTelefono(yo.telefono) });
      },
      error: (error: unknown) =>
        this.errorCarga.set(mensajeDeError(error, 'No pudimos cargar tu perfil.')),
    });
  }

  protected mensajeCampoTelefono(): string | null {
    return mensajeCampoTelefono(
      this.formulario.controls.telefono,
      this.erroresCampos(),
      'telefono',
    );
  }

  protected formatearTelefono(): void {
    formatearControlTelefono(this.formulario.controls.telefono);
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.confirmacion.set(false);
      this.erroresCampos.set(
        this.formulario.controls.nombre.invalid ? { nombre: 'El nombre es obligatorio.' } : {},
      );
      this.enfocarPrimerInvalido();
      return;
    }

    this.erroresCampos.set({});
    this.errorGeneral.set(null);
    this.confirmacion.set(false);

    const { nombre, telefono } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioYo
      .actualizar({
        nombre,
        telefono: telefono.trim() === '' ? null : (normalizarTelefono(telefono) ?? telefono.trim()),
      })
      .subscribe({
        next: (yo) => {
          this.yo.set(yo);
          this.formulario.controls.telefono.setValue(formatearTelefono(yo.telefono));
          this.guardando.set(false);
          this.confirmacion.set(true);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorGeneral.set(mensajeDeError(error));
          } else {
            this.enfocarPrimerInvalido();
          }
        },
      });
  }

  /** El primer `form` del host es el de datos (canales y contraseña vienen después). */
  private enfocarPrimerInvalido(): void {
    enfocarPrimerCampoInvalido(dentroDe(this.host, 'form'), this.injector);
  }

  /**
   * Reautentica con la contraseña actual y fija la nueva. Oculta este
   * bloque completo (ver plantilla) para cuentas sólo de Google, que no
   * tienen contraseña que cambiar.
   */
  protected async cambiarClave(): Promise<void> {
    if (this.cambiandoClave()) return;
    this.errorClave.set(null);
    this.confirmacionClave.set(false);
    if (this.formularioClave.invalid) {
      this.formularioClave.markAllAsTouched();
      return;
    }

    const { actual, nueva, confirmacion } = this.formularioClave.getRawValue();
    if (nueva !== confirmacion) {
      this.errorClave.set('Las contraseñas nuevas no coinciden.');
      return;
    }

    this.cambiandoClave.set(true);
    try {
      await this.auth.cambiarClave(actual, nueva);
      this.cambiandoClave.set(false);
      this.confirmacionClave.set(true);
      this.formularioClave.reset();
    } catch (error) {
      this.cambiandoClave.set(false);
      const codigo = (error as { code?: string } | null)?.code ?? '';
      this.errorClave.set(
        MENSAJES_ERROR_CLAVE_ACTUAL[codigo] ??
          MENSAJES_ERROR_CLAVE_NUEVA[codigo] ??
          MENSAJE_ERROR_CLAVE_GENERICO,
      );
    }
  }
}
