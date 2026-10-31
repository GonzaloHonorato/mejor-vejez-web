import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ServicioAutenticacion } from '../../nucleo/autenticacion/servicio-autenticacion';

/** Código vencido o ya usado: mismo trato, se ofrece pedir otro enlace. */
const MENSAJES_CODIGO_VENCIDO: Record<string, string> = {
  'auth/expired-action-code': 'Este enlace ya venció.',
  'auth/invalid-action-code': 'Este enlace ya se usó o no es válido.',
};
const MENSAJE_SIN_CODIGO = 'Este enlace no es válido.';
const MENSAJE_ERROR_CODIGO_GENERICO = 'No pudimos validar el enlace. Intenta de nuevo.';

const MENSAJES_ERROR_CLAVE: Record<string, string> = {
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
};
const MENSAJE_ERROR_CLAVE_GENERICO = 'No pudimos cambiar tu contraseña. Intenta de nuevo.';

type Estado = 'cargando' | 'listo' | 'vencido' | 'exito';

/**
 * Ruta pública `restablecer-clave`: lee `codigo` (el `oobCode` de Firebase
 * que manda el core en el enlace) de la URL, verifica que siga vigente y,
 * si es así, deja fijar una contraseña nueva.
 */
@Component({
  selector: 'app-restablecer-clave',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restablecer-clave.html',
  styleUrl: './restablecer-clave.scss',
})
export class RestablecerClave implements OnInit {
  private readonly auth = inject(ServicioAutenticacion);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly estado = signal<Estado>('cargando');
  protected readonly correo = signal<string | null>(null);
  protected readonly mensajeVencido = signal(MENSAJE_SIN_CODIGO);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    clave: ['', [Validators.required, Validators.minLength(8)]],
    confirmacion: ['', Validators.required],
  });

  private codigo = '';

  /**
   * El core manda el código en el fragmento (`#codigo=...`): así nunca
   * viaja al servidor ni queda en un log de acceso. `?codigo=` queda como
   * respaldo por compatibilidad con enlaces viejos.
   */
  private leerCodigo(): string | null {
    const fragmento = this.ruta.snapshot.fragment;
    const delFragmento = fragmento ? new URLSearchParams(fragmento).get('codigo') : null;
    return delFragmento ?? this.ruta.snapshot.queryParamMap.get('codigo');
  }

  async ngOnInit(): Promise<void> {
    const codigo = this.leerCodigo();
    // Apenas se lee, se limpia la barra de direcciones: el código no debe
    // quedar en el historial del navegador (el core lo manda en el
    // fragmento justamente para que nunca llegue a un log de acceso).
    history.replaceState(null, '', '/restablecer-clave');
    if (!codigo) {
      this.mensajeVencido.set(MENSAJE_SIN_CODIGO);
      this.estado.set('vencido');
      return;
    }
    this.codigo = codigo;
    try {
      this.correo.set(await this.auth.verificarCodigoRecuperarClave(codigo));
      this.estado.set('listo');
    } catch (error) {
      const codigoError = (error as { code?: string } | null)?.code ?? '';
      this.mensajeVencido.set(MENSAJES_CODIGO_VENCIDO[codigoError] ?? MENSAJE_ERROR_CODIGO_GENERICO);
      this.estado.set('vencido');
    }
  }

  protected async restablecer(): Promise<void> {
    if (this.enviando()) return;
    this.errorFormulario.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const { clave, confirmacion } = this.formulario.getRawValue();
    if (clave !== confirmacion) {
      this.errorFormulario.set('Las contraseñas no coinciden.');
      return;
    }

    this.enviando.set(true);
    try {
      await this.auth.confirmarRecuperarClave(this.codigo, clave);
      this.enviando.set(false);
      this.estado.set('exito');
    } catch (error) {
      this.enviando.set(false);
      const codigoError = (error as { code?: string } | null)?.code ?? '';
      const mensajeVencido = MENSAJES_CODIGO_VENCIDO[codigoError];
      if (mensajeVencido) {
        this.mensajeVencido.set(mensajeVencido);
        this.estado.set('vencido');
        return;
      }
      this.errorFormulario.set(MENSAJES_ERROR_CLAVE[codigoError] ?? MENSAJE_ERROR_CLAVE_GENERICO);
    }
  }
}
