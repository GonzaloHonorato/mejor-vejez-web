import { ElementRef, Injector, afterNextRender } from '@angular/core';

/** Un elemento que se resuelve recién tras el render (puede no existir). */
export type Objetivo = () => Element | null | undefined;

/**
 * Campos que cuentan como "primer campo" de una sección: controles de
 * formulario visibles y habilitados.
 */
export const SELECTOR_PRIMER_CAMPO =
  'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)';

/** Mensajes de error de un formulario, de campo o generales. */
const SELECTOR_MENSAJE_ERROR = '.mv-campo__error, .mv-aviso--error';

/**
 * Desplazamiento suave salvo que la persona pida menos movimiento
 * (`prefers-reduced-motion: reduce`), en cuyo caso el salto es inmediato.
 */
export function comportamientoDesplazamiento(): ScrollBehavior {
  const reducir = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return reducir ? 'auto' : 'smooth';
}

/** El elemento con ese `id` en el documento. */
export function porId(id: string): Objetivo {
  return () => document.getElementById(id);
}

/** El primer elemento que calza con `selector` en el documento. */
export function porSelector(selector: string): Objetivo {
  return () => document.querySelector(selector);
}

/** El primero de los objetivos que exista tras el render. */
export function primeroQueExista(...objetivos: Objetivo[]): Objetivo {
  return () => {
    for (const objetivo of objetivos) {
      const elemento = objetivo();
      if (elemento) return elemento;
    }
    return null;
  };
}

/** El elemento de `selector` dentro del host del componente (o el host mismo si no hay selector). */
export function dentroDe(host: ElementRef<HTMLElement>, selector?: string): () => Element | null {
  return () => (selector ? host.nativeElement.querySelector(selector) : host.nativeElement);
}

/** Primer campo de `seccion`; si no tiene, la sección misma cuando es enfocable. */
function primerCampo(seccion: Element): HTMLElement | null {
  const campo = seccion.querySelector<HTMLElement>(SELECTOR_PRIMER_CAMPO);
  if (campo) return campo;
  return seccion.matches('[tabindex]') ? (seccion as HTMLElement) : null;
}

/**
 * Desplaza `elemento` a la vista y luego lo enfoca con `preventScroll`, para
 * que la posición final sea la elegida aquí y no la del navegador. Los
 * márgenes por la barra fija de pestañas (celular) y el aire superior viven
 * en CSS (`scroll-padding` de `html` en `_base.scss`), no aquí.
 * `scrollIntoView` recorre los contenedores anidados: dentro de una
 * `mv-grilla` con scroll propio mueve la grilla y la página.
 */
function desplazarYEnfocar(
  desplazar: Element,
  enfocar: HTMLElement | null,
  bloque: ScrollLogicalPosition,
): void {
  // `?.`: jsdom (pruebas) no implementa `scrollIntoView`.
  desplazar.scrollIntoView?.({ block: bloque, behavior: comportamientoDesplazamiento() });
  enfocar?.focus({ preventScroll: true });
}

/**
 * Tras el render, trae `seccion` (un formulario o bloque recién desplegado) al
 * inicio de la vista y enfoca su primer campo, o `campo` si se indica.
 */
export function mostrarSeccion(seccion: Objetivo, injector: Injector, campo?: Objetivo): void {
  afterNextRender(
    () => {
      const elemento = seccion();
      if (!elemento) return;
      const destino = (campo?.() as HTMLElement | null | undefined) ?? primerCampo(elemento);
      desplazarYEnfocar(elemento, destino, 'start');
    },
    { injector },
  );
}

/**
 * Tras el render, devuelve el foco a `elemento` (normalmente el botón que
 * abrió el formulario) desplazando solo lo necesario (`block: 'nearest'`).
 */
export function devolverFoco(elemento: Objetivo, injector: Injector): void {
  afterNextRender(
    () => {
      const destino = elemento() as HTMLElement | null | undefined;
      if (destino) desplazarYEnfocar(destino, destino, 'nearest');
    },
    { injector },
  );
}

/**
 * Tras el render, si el foco se perdió (quedó en `body` porque el elemento
 * enfocado desapareció, p. ej. al eliminar una fila o al quedar una tarea sin
 * acciones), lo lleva a `destino` desplazando solo lo necesario. Si el foco
 * sigue en un elemento vivo, no lo toca.
 */
export function rescatarFoco(destino: Objetivo, injector: Injector): void {
  afterNextRender(
    () => {
      const activo = document.activeElement;
      if (activo && activo !== document.body && activo.isConnected) return;
      const elemento = destino() as HTMLElement | null | undefined;
      if (elemento) desplazarYEnfocar(elemento, elemento, 'nearest');
    },
    { injector },
  );
}

/**
 * Tras el render, trae `objetivo` a la vista desplazando solo lo necesario
 * (`block: 'nearest'`), sin mover el foco. Para bloques que se despliegan sin
 * campos (p. ej. el detalle de un evento, donde el foco sigue en su botón
 * "Ver detalles") o resultados que quedaron fuera de pantalla.
 */
export function traerALaVista(objetivo: Objetivo, injector: Injector): void {
  afterNextRender(
    () =>
      objetivo()?.scrollIntoView?.({ block: 'nearest', behavior: comportamientoDesplazamiento() }),
    { injector },
  );
}

/**
 * Trae a la vista un aviso (error o éxito) que pudo quedar fuera de
 * pantalla, sin mover el foco: el anuncio lo hace su `role="alert"` o
 * `role="status"`.
 */
export function mostrarAviso(aviso: Objetivo, injector: Injector): void {
  traerALaVista(aviso, injector);
}

/** Lo enfocable de una fila: su enlace o su primer botón habilitado. */
const SELECTOR_ACCION_DE_FILA = 'a[href]:not([tabindex="-1"]), button:not(:disabled)';

/**
 * Tras "Cargar más", lleva el foco a la primera fila nueva (la de índice
 * `desde` entre las que calzan con `filas` dentro de `lista`): a su enlace o
 * primer botón, o a la fila misma si es enfocable. Así quien navega con
 * teclado sigue donde iba, aunque el botón "Cargar más" desaparezca.
 */
export function enfocarPrimeraNueva(
  lista: Objetivo,
  filas: string,
  desde: number,
  injector: Injector,
): void {
  afterNextRender(
    () => {
      const fila = lista()?.querySelectorAll(filas)[desde];
      if (!fila) return;
      const destino =
        fila.querySelector<HTMLElement>(SELECTOR_ACCION_DE_FILA) ??
        (fila.matches('[tabindex]') ? (fila as HTMLElement) : null);
      desplazarYEnfocar(destino ?? fila, destino, 'nearest');
    },
    { injector },
  );
}

/**
 * Tras un envío con errores, lleva el foco al primer campo marcado con
 * `aria-invalid="true"` dentro de `contenedor` (normalmente el formulario) y
 * lo centra en la vista, para que se vean también su rótulo y su error.
 * Espera al próximo render, porque los atributos `aria-invalid` se pintan
 * después de `markAllAsTouched()` o de recibir los errores de la API.
 */
export function enfocarPrimerCampoInvalido(
  contenedor: () => ParentNode | null | undefined,
  injector: Injector,
): void {
  afterNextRender(
    () => {
      const raiz = contenedor();
      const campo = raiz?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (campo) {
        desplazarYEnfocar(campo, campo, 'center');
        return;
      }
      // Errores sin campo marcado (un grupo de casillas, un error general):
      // al menos se trae el primer mensaje a la vista, sin mover el foco.
      const mensaje = raiz?.querySelector(SELECTOR_MENSAJE_ERROR);
      if (mensaje) desplazarYEnfocar(mensaje, null, 'center');
    },
    { injector },
  );
}
