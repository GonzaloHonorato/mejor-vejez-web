import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Icono } from '../icono/icono';
import { calcularPosicionMenu } from './posicion-menu';

/** Acción principal (el lado izquierdo del botón). */
export interface AccionPrincipal {
  etiqueta: string;
  peligro?: boolean;
}

/** Ítem del menú; las destructivas van con `peligro` y al final. */
export interface AccionMenu {
  id: string;
  etiqueta: string;
  peligro?: boolean;
  deshabilitada?: boolean;
}

export type VarianteBotonDividido = 'primario' | 'secundario';

let siguienteId = 0;

/**
 * Botón dividido: la acción principal y un segmento con flecha que abre un
 * menú con el resto de las acciones. El menú es `position: fixed` (calculado
 * desde el segmento), así que flota sobre el contenido y no lo recorta una
 * grilla con scroll; si no cabe abajo, se abre hacia arriba.
 *
 * Teclado (patrón de botón de menú): Enter, Espacio o flecha abajo abren y
 * enfocan el primer ítem (flecha arriba, el último); flechas, Inicio y Fin
 * recorren; Escape o clic afuera cierran y devuelven el foco al segmento; Tab
 * cierra y deja seguir. Un ítem `deshabilitada` se puede enfocar pero no
 * elegir (`aria-disabled`).
 */
@Component({
  selector: 'app-boton-dividido',
  imports: [Icono],
  templateUrl: './boton-dividido.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mv-boton-dividido',
    '[class.mv-boton-dividido--secundario]': "variante() === 'secundario' && !principal().peligro",
    '[class.mv-boton-dividido--peligro]': 'principal().peligro',
    '[class.mv-boton-dividido--abierto]': 'abierto()',
    '(document:click)': 'clicEnDocumento($event)',
  },
})
export class BotonDividido {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly principal = input.required<AccionPrincipal>();
  readonly acciones = input<readonly AccionMenu[]>([]);
  /** Nombre accesible del segmento, único en la página (p. ej. "Más acciones para Ibuprofeno 500 mg, 20:30"). */
  readonly etiquetaMenu = input.required<string>();
  /**
   * Nombre accesible del botón principal cuando su texto se repite en la
   * página (p. ej. "Editar a Ana Rojas" para el texto visible "Editar"). Debe
   * empezar por el texto visible. Sin ella, el nombre es el texto visible.
   */
  readonly etiquetaPrincipal = input<string | undefined>(undefined);
  readonly deshabilitado = input(false);
  readonly variante = input<VarianteBotonDividido>('primario');

  readonly pulsarPrincipal = output<void>({ alias: 'principal' });
  readonly accion = output<string>();

  protected readonly abierto = signal(false);

  private readonly numero = siguienteId++;
  protected readonly idSegmento = `boton-dividido-${this.numero}-segmento`;
  protected readonly idMenu = `boton-dividido-${this.numero}-menu`;

  private readonly segmento = viewChild.required<ElementRef<HTMLButtonElement>>('segmento');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');

  private readonly reposicionar = () => this.posicionar();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dejarDeSeguir());
  }

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar(false);
    } else {
      this.abrir('primero');
    }
  }

  protected teclaEnSegmento(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.abrir(evento.key === 'ArrowDown' ? 'primero' : 'ultimo');
    } else if (evento.key === 'Escape' && this.abierto()) {
      evento.preventDefault();
      this.cerrar(true);
    }
  }

  protected teclaEnMenu(evento: KeyboardEvent): void {
    const items = this.items();
    const actual = items.indexOf(document.activeElement as HTMLElement);
    let destino: number | null = null;

    switch (evento.key) {
      case 'ArrowDown':
        destino = (actual + 1) % items.length;
        break;
      case 'ArrowUp':
        destino = (actual - 1 + items.length) % items.length;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = items.length - 1;
        break;
      case 'Escape':
        evento.preventDefault();
        this.cerrar(true);
        return;
      case 'Tab':
        this.cerrar(false);
        return;
      default:
        return;
    }
    evento.preventDefault();
    items[destino]?.focus();
  }

  /**
   * El clic en la acción principal ocurre dentro del componente, así que el
   * cierre por clic afuera no lo ve: el menú se cierra aquí antes de emitir.
   * No se toca el foco: lo decide la página (p. ej. lo lleva a un formulario).
   */
  protected elegirPrincipal(): void {
    if (this.abierto()) this.cerrar(false);
    this.pulsarPrincipal.emit();
  }

  protected elegir(accion: AccionMenu): void {
    if (accion.deshabilitada) return;
    this.cerrar(true);
    this.accion.emit(accion.id);
  }

  /**
   * Clic fuera del componente: cierra. Devuelve el foco al segmento solo si
   * el clic no lo llevó a otro control (no se le quita a un campo).
   */
  protected clicEnDocumento(evento: MouseEvent): void {
    if (!this.abierto()) return;
    if (this.elemento.nativeElement.contains(evento.target as Node)) return;
    const activo = document.activeElement;
    const focoSinDueno =
      !activo || activo === document.body || this.elemento.nativeElement.contains(activo);
    this.cerrar(focoSinDueno);
  }

  private abrir(enfocar: 'primero' | 'ultimo'): void {
    if (this.deshabilitado()) return;
    this.abierto.set(true);
    afterNextRender(
      () => {
        this.posicionar();
        const items = this.items();
        items[enfocar === 'primero' ? 0 : items.length - 1]?.focus();
      },
      { injector: this.injector },
    );
    window.addEventListener('scroll', this.reposicionar, true);
    window.addEventListener('resize', this.reposicionar);
  }

  private cerrar(devolverFoco: boolean): void {
    this.abierto.set(false);
    this.dejarDeSeguir();
    if (devolverFoco) this.segmento().nativeElement.focus();
  }

  private posicionar(): void {
    if (!this.abierto()) return;
    const segmento = this.segmento().nativeElement;
    const rect = segmento.getBoundingClientRect();
    if (!this.segmentoVisible(segmento, rect)) {
      this.cerrarFueraDeVista();
      return;
    }
    const menu = this.menu().nativeElement;
    const posicion = calcularPosicionMenu(
      rect,
      { ancho: menu.offsetWidth, alto: menu.offsetHeight },
      {
        ancho: document.documentElement.clientWidth || window.innerWidth,
        alto: window.innerHeight,
      },
    );
    menu.style.top = `${posicion.top}px`;
    menu.style.left = `${posicion.left}px`;
    menu.classList.toggle('mv-menu--arriba', posicion.haciaArriba);
  }

  /**
   * El segmento sigue a la vista si su centro está dentro de la ventana y,
   * en una grilla con scroll propio, entre el borde inferior del encabezado
   * fijo y el borde inferior del área visible.
   */
  private segmentoVisible(segmento: HTMLElement, rect: DOMRect): boolean {
    const centroY = (rect.top + rect.bottom) / 2;
    const centroX = (rect.left + rect.right) / 2;
    const anchoVentana = document.documentElement.clientWidth || window.innerWidth;
    if (centroY < 0 || centroY > window.innerHeight || centroX < 0 || centroX > anchoVentana) {
      return false;
    }
    const grilla = segmento.closest<HTMLElement>('.mv-grilla');
    if (!grilla || !/(auto|scroll|hidden)/.test(getComputedStyle(grilla).overflowY)) return true;
    const area = grilla.getBoundingClientRect();
    const encabezado = grilla.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    return centroY >= area.top + encabezado && centroY <= area.bottom;
  }

  /** Cierra sin desplazar la página; el foco vuelve al segmento solo si estaba en el menú. */
  private cerrarFueraDeVista(): void {
    const focoEnMenu = this.menu().nativeElement.contains(document.activeElement);
    this.cerrar(false);
    if (focoEnMenu) this.segmento().nativeElement.focus({ preventScroll: true });
  }

  private dejarDeSeguir(): void {
    window.removeEventListener('scroll', this.reposicionar, true);
    window.removeEventListener('resize', this.reposicionar);
  }

  private items(): HTMLElement[] {
    return Array.from(this.menu().nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
}
