import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { mensajeDeError } from '../../nucleo/http/mensaje-de-error';
import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';
import { ServicioRecuperarClave } from '../../nucleo/autenticacion/servicio-recuperar-clave';

const MENSAJES_ERROR: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo en unos minutos.',
};
const MENSAJE_ERROR_GENERICO = 'No pudimos iniciar sesión. Intenta de nuevo.';
/** La persona cerró la ventana de Google: no es un error que haya que mostrar. */
const CODIGOS_CANCELACION = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/**
 * Siempre el mismo texto, exista o no la cuenta: la pantalla nunca revela si
 * un correo tiene cuenta.
 */
const MENSAJE_RECUPERAR_CLAVE = 'Si el correo tiene una cuenta, te enviamos un enlace.';

@Component({
  selector: 'app-ingreso',
  imports: [ReactiveFormsModule],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.scss',
})
export class Ingreso implements OnInit {
  private readonly auth = inject(ServicioAutenticacion);
  private readonly servicioRecuperarClave = inject(ServicioRecuperarClave);
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

  protected readonly mostrarRecuperar = signal(false);
  protected readonly enviandoRecuperar = signal(false);
  protected readonly mensajeRecuperar = signal<string | null>(null);
  protected readonly errorCorreoRecuperar = signal<string | null>(null);
  protected readonly formularioRecuperar = inject(NonNullableFormBuilder).group({
    correo: ['', [Validators.required, Validators.email]],
  });

  /**
   * `restablecer-clave` manda de vuelta con `?recuperar=1` cuando el enlace
   * venció o no es válido: abre el formulario "¿Olvidaste tu contraseña?"
   * directamente, sin que la persona tenga que encontrar el botón de nuevo.
   */
  ngOnInit(): void {
    if (this.ruta.snapshot.queryParamMap.has('recuperar')) {
      this.abrirRecuperar();
    }
  }

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

  protected abrirRecuperar(): void {
    this.mostrarRecuperar.set(true);
    this.mensajeRecuperar.set(null);
    this.errorCorreoRecuperar.set(null);
    this.formularioRecuperar.reset({ correo: '' });
  }

  /**
   * Pide el enlace de restablecimiento. Muestra el mismo mensaje tanto si el
   * correo tiene cuenta como si no, o si la llamada falla por red o error
   * del servidor; solo el 429 ("demasiados intentos") muestra su propio
   * `detail`, porque no revela si la cuenta existe.
   */
  protected recuperarClave(): void {
    if (this.enviandoRecuperar()) return;
    if (this.formularioRecuperar.invalid) {
      this.formularioRecuperar.markAllAsTouched();
      this.errorCorreoRecuperar.set('Escribe un correo válido.');
      return;
    }
    this.enviandoRecuperar.set(true);
    this.errorCorreoRecuperar.set(null);
    this.mensajeRecuperar.set(null);
    const { correo } = this.formularioRecuperar.getRawValue();
    this.servicioRecuperarClave.solicitar(correo).subscribe({
      next: () => this.terminarRecuperar(MENSAJE_RECUPERAR_CLAVE),
      error: (error: unknown) => {
        const demasiadosIntentos = error instanceof HttpErrorResponse && error.status === 429;
        this.terminarRecuperar(
          demasiadosIntentos ? mensajeDeError(error, MENSAJE_RECUPERAR_CLAVE) : MENSAJE_RECUPERAR_CLAVE,
        );
      },
    });
  }

  private terminarRecuperar(mensaje: string): void {
    this.enviandoRecuperar.set(false);
    this.mensajeRecuperar.set(mensaje);
  }

  /** Sólo rutas internas: evita redirigir fuera de la app (`//otro.sitio`). */
  private urlVolver(): string {
    const volver = this.ruta.snapshot.queryParamMap.get('volver');
    return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  }
}
