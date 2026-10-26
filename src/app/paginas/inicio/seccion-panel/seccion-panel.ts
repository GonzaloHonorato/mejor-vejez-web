import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';

import { EstadoCarga } from '../../../nucleo/panel/estado-seccion';

/**
 * Marco visual de una sección del panel familiar (Tarea 4, Fase 6): título,
 * los 4 estados de `EstadoSeccion` (regla 9 del plan) y el aviso "No se pudo
 * actualizar." cuando `desactualizada`. El contenido propio de cada sección
 * (conteos, listas) se proyecta con `ng-content` y solo se muestra en el
 * estado 'datos'; en 'vacio' se muestra `mensajeVacio` en su lugar.
 *
 * No orquesta nada (no llama a `ServicioPanel` ni conoce `EstadoSeccion`):
 * la página `Inicio` es quien decide cuándo cargar/reintentar/refrescar y le
 * pasa el estado ya resuelto.
 *
 * El título es `<h3>` (M-4): las 5 secciones cuelgan del `<h2>` "Tu panel"
 * de `Inicio`, y usar `<h2>` ahí haría ver 6 títulos al mismo nivel para
 * quien navega por encabezados.
 *
 * Al apretar "Reintentar" (M-3), el foco se mueve al título de la sección
 * (`tabindex="-1"` + `focus()`): sin esto, el botón desaparece al pasar a
 * "cargando" y el foco cae al `<body>`, obligando a recorrer la página desde
 * el principio con teclado o lector de pantalla.
 */
@Component({
  selector: 'app-seccion-panel',
  imports: [],
  templateUrl: './seccion-panel.html',
  styleUrl: './seccion-panel.scss',
})
export class SeccionPanel {
  readonly titulo = input.required<string>();
  readonly estado = input.required<EstadoCarga>();
  readonly mensajeVacio = input.required<string>();
  readonly desactualizada = input(false);
  readonly reintentar = output<void>();

  private readonly elementoTitulo = viewChild<ElementRef<HTMLHeadingElement>>('tituloRef');

  /** Id del `<h3>` para `aria-labelledby`: derivado del título, estable mientras no cambie. */
  protected readonly idTitulo = computed(
    () => `seccion-panel-${this.titulo().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  );

  /** Emite "reintentar" y mueve el foco al título (M-3), para que no se pierda. */
  protected alReintentar(): void {
    this.reintentar.emit();
    this.elementoTitulo()?.nativeElement.focus();
  }
}
