import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

const MENSAJES_ERROR: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo en unos minutos.',
};
const MENSAJE_ERROR_GENERICO = 'No pudimos iniciar sesión. Intenta de nuevo.';
/** La persona cerró la ventana de Google: no es un error que haya que mostrar. */
const CODIGOS_CANCELACION = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

@Component({
  selector: 'app-ingreso',
  imports: [ReactiveFormsModule],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.scss',
})
export class Ingreso {
  private readonly auth = inject(ServicioAutenticacion);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly habilitado = this.auth.habilitado;
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mostrarClave = signal(false);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    correo: ['', [Validators.required, Validators.email]],
    clave: ['', Validators.required],
  });

  protected ingresarConGoogle(): Promise<void> {
    return this.intentar(() => this.auth.ingresarConGoogle());
  }

  protected ingresarConCorreo(): Promise<void> {
    if (this.formulario.invalid) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return Promise.resolve();
    }
    const { correo, clave } = this.formulario.getRawValue();
    return this.intentar(() => this.auth.ingresarConCorreo(correo, clave));
  }

  private async intentar(ingresar: () => Promise<void>): Promise<void> {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    try {
      await ingresar();
      await this.router.navigateByUrl(this.urlVolver());
    } catch (e) {
      const codigo = (e as { code?: string } | null)?.code ?? '';
      if (!CODIGOS_CANCELACION.has(codigo)) {
        this.error.set(MENSAJES_ERROR[codigo] ?? MENSAJE_ERROR_GENERICO);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  /** Sólo rutas internas: evita redirigir fuera de la app (`//otro.sitio`). */
  private urlVolver(): string {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  }
}
