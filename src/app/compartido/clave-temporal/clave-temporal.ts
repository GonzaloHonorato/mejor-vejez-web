import { Component, ElementRef, afterNextRender, inject, input, output, signal } from '@angular/core';

/**
 * Diálogo que muestra, una sola vez, la contraseña temporal de una cuenta
 * recién creada o cuyo acceso se reenvió (contratos `RespuestaCuentaCreada`,
 * `RespuestaIntegranteCreado` y `RespuestaAccesoReenviado`). Sigue el mismo
 * patrón accesible que `PanelMas`: modal (`aria-modal`), con foco atrapado
 * (Tab/Shift+Tab giran dentro) y Escape cierra.
 *
 * No decide cuándo cerrarse ni dónde guardar la clave: solo la muestra
 * mientras está montado y avisa `cerrar`. Quien lo usa la mantiene únicamente
 * en el estado de la página (nunca en un servicio, `localStorage` ni log) y
 * la descarta desmontando este componente.
 */
@Component({
  selector: 'app-clave-temporal',
  templateUrl: './clave-temporal.html',
  styleUrl: './clave-temporal.scss',
  host: {
    '(document:keydown.escape)': 'cerrar.emit()',
  },
})
export class ClaveTemporal {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly titulo = input('Contraseña temporal');
  readonly clave = input.required<string>();
  readonly correoEnviado = input.required<boolean>();

  readonly cerrar = output<void>();

  protected readonly copiada = signal(false);
  protected readonly errorCopiar = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      this.elemento.nativeElement.querySelector<HTMLElement>('.clave-temporal__copiar')?.focus();
    });
  }

  /** Sin la API del portapapeles (contexto no seguro, navegador viejo) o si el permiso se rechaza, se avisa en vez de fallar en silencio. */
  protected copiar(): void {
    this.errorCopiar.set(null);
    if (!navigator.clipboard) {
      this.errorCopiar.set('No se pudo copiar; selecciónala y cópiala a mano.');
      return;
    }
    navigator.clipboard
      .writeText(this.clave())
      .then(() => this.copiada.set(true))
      .catch(() => this.errorCopiar.set('No se pudo copiar; selecciónala y cópiala a mano.'));
  }

  /** Trampa de foco: Tab y Shift+Tab giran dentro del diálogo en los dos extremos. */
  protected atraparFoco(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab') return;
    const enfocables = Array.from(
      this.elemento.nativeElement.querySelectorAll<HTMLElement>('.clave-temporal__caja button'),
    );
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
}
