import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Nombres de los íconos disponibles (navegación, acciones del marco y de las páginas). */
export const NOMBRES_ICONO = [
  'panel',
  'tareas',
  'alertas',
  'remedios',
  'personas',
  'relevos',
  'grupos',
  'perfil',
  'administracion',
  'mas',
  'cerrar',
  'salir',
  'flecha-izquierda',
  'flecha-derecha',
] as const;

export type NombreIcono = (typeof NOMBRES_ICONO)[number];

/**
 * Ícono de trazo (24×24, `stroke="currentColor"`): toma el color del texto
 * que lo rodea, así que la pestaña activa lo pinta con el color primario
 * sin estilos propios. Es decorativo (`aria-hidden`): el texto visible al
 * lado es el que nombra la acción. Trazos simples dibujados para el
 * proyecto, sin dependencias ni conjuntos de íconos externos.
 */
@Component({
  selector: 'app-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (nombre()) {
        @case ('panel') {
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        }
        @case ('tareas') {
          <rect x="3" y="4" width="6" height="6" rx="1" />
          <path d="M4.5 7l1 1 2-2" />
          <rect x="3" y="14" width="6" height="6" rx="1" />
          <path d="M12 7h9M12 17h9" />
        }
        @case ('alertas') {
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
          <path d="M10 21h4" />
        }
        @case ('remedios') {
          <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
          <path d="M9.5 9.5l5 5" />
        }
        @case ('personas') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16.5 14a5 5 0 0 1 5 5" />
        }
        @case ('relevos') {
          <path d="M4 8h14" />
          <path d="M15 5l3 3-3 3" />
          <path d="M20 16H6" />
          <path d="M9 13l-3 3 3 3" />
        }
        @case ('grupos') {
          <circle cx="12" cy="7" r="3" />
          <path d="M7 19a5 5 0 0 1 10 0" />
          <circle cx="5" cy="10" r="2" />
          <path d="M2 18a3.5 3.5 0 0 1 4-3.5" />
          <circle cx="19" cy="10" r="2" />
          <path d="M22 18a3.5 3.5 0 0 0-4-3.5" />
        }
        @case ('perfil') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        }
        @case ('administracion') {
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        }
        @case ('mas') {
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        }
        @case ('cerrar') {
          <path d="M6 6l12 12M18 6L6 18" />
        }
        @case ('salir') {
          <path d="M14 4H6v16h8" />
          <path d="M10 12h11" />
          <path d="M18 9l3 3-3 3" />
        }
        @case ('flecha-izquierda') {
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        }
        @case ('flecha-derecha') {
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        }
      }
    </svg>
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
}
