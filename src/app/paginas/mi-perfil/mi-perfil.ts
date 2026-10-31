import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { erroresDeCampos, mensajeDeError } from '../../nucleo/http/mensaje-de-error';
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

/** Página "Mi perfil": correo de solo lectura, nombre y teléfono editables, canales de notificación y cambio de contraseña. */
@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, CanalesNotificacion],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.scss',
})
export class MiPerfil implements OnInit {
  private readonly servicioYo = inject(ServicioYo);
  protected readonly auth = inject(ServicioAutenticacion);

  protected readonly yo = signal<RespuestaYo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly confirmacion = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresCampos = signal<Record<string, string>>({});

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', Validators.required],
    telefono: [''],
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
    this.servicioYo.obtener().subscribe({
      next: (yo) => {
        this.yo.set(yo);
        this.formulario.patchValue({ nombre: yo.nombre, telefono: yo.telefono ?? '' });
      },
      error: (error: unknown) =>
        this.errorGeneral.set(mensajeDeError(error, 'No pudimos cargar tu perfil.')),
    });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.confirmacion.set(false);
      this.erroresCampos.set(
        this.formulario.controls.nombre.invalid ? { nombre: 'El nombre es obligatorio.' } : {},
      );
      return;
    }

    this.erroresCampos.set({});
    this.errorGeneral.set(null);
    this.confirmacion.set(false);

    const { nombre, telefono } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.servicioYo
      .actualizar({ nombre, telefono: telefono.trim() === '' ? null : telefono })
      .subscribe({
        next: (yo) => {
          this.yo.set(yo);
          this.guardando.set(false);
          this.confirmacion.set(true);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const campos = erroresDeCampos(error);
          this.erroresCampos.set(campos);
          if (Object.keys(campos).length === 0) {
            this.errorGeneral.set(mensajeDeError(error));
          }
        },
      });
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
